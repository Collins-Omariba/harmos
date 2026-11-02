import { cookies } from "next/headers";
import { z } from "zod";

import { suggestCatalogParts } from "@/lib/ai/tasks/suggest_catalog_parts";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users";
import { isCatalogCategory } from "@/lib/catalog/types";
import { fetchPageText } from "@/lib/fetch-page";

export const dynamic = "force-dynamic";

/**
 * Streaming twin of proposeCatalogPartsAction (which stays for the small
 * "Draft missing" button). Server actions cannot push partial output, so
 * the catalog dialog posts here and reads newline-delimited JSON events:
 * {type:"status"|"reasoning"|"text"|"done"|"error", ...}. Reasoning events
 * only arrive when the provider streams thinking text — usually it does
 * not, and the UI says so instead of faking it.
 */

const bodySchema = z.object({
  request: z.string().trim().min(10, "Describe what to add in a few words."),
  categoryHint: z.string().trim().optional(),
  sourceUrl: z.string().trim().optional(),
  pastedText: z.string().trim().max(20000).optional(),
});

function truncateRawOutput(raw: string, maxChars = 12_000): string {
  const trimmed = raw.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n… [truncated]`;
}

export async function POST(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const sessionUserId = verifySessionToken(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const user = sessionUserId ? await getUserById(sessionUserId) : null;
  if (!user) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Check the request." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        let modelRequest = parsed.data.request;
        let fetchNote: string | null = null;
        if (parsed.data.sourceUrl) {
          send({ type: "status", message: "Reading the linked page…" });
          const fetched = await fetchPageText(parsed.data.sourceUrl);
          if ("text" in fetched) {
            modelRequest = [
              parsed.data.request,
              "",
              `Reference page (${fetched.url}):`,
              fetched.text,
            ].join("\n");
          } else {
            fetchNote = fetched.error;
          }
        }
        if (parsed.data.pastedText) {
          modelRequest = `${modelRequest}\n\nPasted reference text:\n${parsed.data.pastedText}`;
        }

        const categoryHint =
          parsed.data.categoryHint && isCatalogCategory(parsed.data.categoryHint)
            ? parsed.data.categoryHint
            : null;

        send({
          type: "status",
          message: "Asking the model — reasoning can take a while…",
        });
        const text = await suggestCatalogParts(
          { request: modelRequest, categoryHint },
          {
            onDelta: (delta) => {
              if (delta.reasoning) {
                send({ type: "reasoning", delta: delta.reasoning });
              }
              if (delta.text) {
                send({ type: "text", delta: delta.text });
              }
            },
          },
        );

        if (!text.trim()) {
          send({
            type: "error",
            message: "The model returned no text. Rephrase and try again.",
          });
          return;
        }

        send({
          type: "done",
          message: `Here's what the model suggested — verify everything against a datasheet, then copy what you want into the add-part form below.${fetchNote ? ` Link note: ${fetchNote}.` : ""}`,
          rawOutput: truncateRawOutput(text),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "ai_request_failed";
        send({
          type: "error",
          message: message.includes("AI_API_KEY")
            ? "Set AI_API_KEY in .env to propose parts with the AI."
            : message.startsWith("ai_empty_reply") &&
                message.includes("finish_reason=length")
              ? "The model returned no visible text: it used its whole output budget on hidden reasoning. Raise AI_MAX_TOKENS in .env, switch to a non-reasoning AI_MODEL, or add the part manually."
              : `The AI call failed: ${message.slice(0, 200)}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
