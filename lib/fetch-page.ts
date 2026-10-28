/**
 * Minimal server-side page fetch for user-pasted links. No search provider,
 * no AI tokens: plain HTTP with strict caps, HTML extraction, and PDF to
 * markdown conversion for datasheets.
 *
 * Security posture: this is a local single-user tool, but we still refuse
 * to fetch non-http(s) URLs, localhost/private hostnames, and oversized
 * responses. HTML caps at FETCH_MAX_BYTES, PDFs at PDF_MAX_BYTES.
 */

import { pdfBufferToMarkdown, PDF_MAX_BYTES } from "@/lib/pdf-to-markdown";

export const FETCH_MAX_BYTES = 500_000;
export const FETCH_TIMEOUT_MS = 15_000;
export const EXTRACT_MAX_CHARS = 8_000;

/**
 * Users paste bare domains ("ti.com/lit/ds/…") as often as full URLs.
 * Prefix a scheme when none is present so link boxes never punish that.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const BLOCKED_HOSTS = [
  "localhost",
  "127.",
  "10.",
  "169.254.",
  "192.168.",
  "[::1]",
  "[::ffff:127.0.0.1]",
];

function hostBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host === "[::1]") {
    return true;
  }
  return BLOCKED_HOSTS.some(
    (blocked) => blocked !== "localhost" && host.startsWith(blocked),
  );
}

/** Test-only escape hatch: the loopback block exists so pasted URLs can never
 *  reach cloud metadata or LAN hosts. Tests set HARMOS_ALLOW_LOOPBACK_FETCH=1
 *  to exercise the HTTP path against a local stub. */
function loopbackAllowed(): boolean {
  return process.env.HARMOS_ALLOW_LOOPBACK_FETCH === "1";
}

export function pageMeta(html: string): {
  title: string | null;
  description: string | null;
  text: string;
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([\s\S]{0,500}?)["']/i,
  );
  const altDescMatch = html.match(
    /<meta[^>]+content=["']([\s\S]{0,500}?)["'][^>]*?(?:name|property)=["'](?:description|og:description)["']/i,
  );

  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript\s*>/gi, " ");
  const text = withoutScripts
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();

  return {
    title: titleMatch?.[1]?.trim() || null,
    description: (descMatch?.[1] ?? altDescMatch?.[1] ?? "").trim() || null,
    text: text.length > EXTRACT_MAX_CHARS ? `${text.slice(0, EXTRACT_MAX_CHARS)}… [truncated]` : text,
  };
}


export async function fetchPageText(
  rawUrl: string,
): Promise<{ url: string; title: string | null; text: string } | { error: string }> {
  let url: URL;
  try {
    url = new URL(normalizeUrl(rawUrl));
  } catch {
    return { error: "That does not look like a URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Only http(s) links can be fetched." };
  }
  if (!loopbackAllowed() && hostBlocked(url.hostname)) {
    return { error: "Local and private addresses are off limits." };
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "HarmosCatalogBot/1.0 (+local catalog import)" },
    });
  } catch (error) {
    return {
      error: `Could not reach the page (${error instanceof Error ? error.message : "network error"}). Paste the datasheet text instead.`,
    };
  }

  if (!response.ok) {
    return { error: `The page answered HTTP ${response.status}. Paste the datasheet text instead.` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const looksPdf =
    /application\/pdf/i.test(contentType) ||
    /\.pdf([?#]|$)/i.test(url.pathname);

  async function download(maxBytes: number): Promise<Uint8Array | null> {
    const reader = response.body?.getReader();
    if (!reader) {
      return null;
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      received += value.length;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const total = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      total.set(chunk, offset);
      offset += chunk.length;
    }
    return total;
  }

  if (looksPdf) {
    const data = await download(PDF_MAX_BYTES);
    if (!data) {
      return { error: "PDF too large to read (over 8 MB). Paste the relevant table instead." };
    }
    try {
      const converted = await pdfBufferToMarkdown(data);
      return {
        url: url.toString(),
        title: null,
        text: converted.markdown,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unreadable";
      if (reason === "pdf_no_text") {
        return {
          error: "That PDF has no selectable text (likely a scan). Paste the table text instead, or add the part manually.",
        };
      }
      return { error: "Could not read that PDF. Paste the datasheet text instead." };
    }
  }

  if (
    !/text\/html|application\/xhtml/i.test(contentType) &&
    !/\.html?([?#]|$)/i.test(url.pathname)
  ) {
    return {
      error: "Only web pages and PDFs can be read. Paste the datasheet text instead.",
    };
  }

  const raw = await download(FETCH_MAX_BYTES);
  if (!raw) {
    return { error: "Empty response. Paste the datasheet text instead." };
  }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(raw);
  const meta = pageMeta(html);

  if (!meta.text) {
    return { error: "No readable text found. Paste the datasheet text instead." };
  }

  return { url: url.toString(), title: meta.title, text: meta.text };
}
