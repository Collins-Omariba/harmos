import { definePDFJSModule, extractText } from "unpdf";

if (typeof (Promise as unknown as Record<string, unknown>).withResolvers !== "function") {
  (Promise as unknown as Record<string, unknown>).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

let pdfjsReady: Promise<void> | null = null;

/**
 * unpdf defaults to its serverless pdf.js bundle, which needs Node 22+
 * globals. Point it at the legacy build instead so this runs on Node 20.
 */
function ensurePdfjs(): Promise<void> {
  if (!pdfjsReady) {
    pdfjsReady = definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
  }
  return pdfjsReady;
}

/**
 * PDF → Markdown for datasheets. Pure JS (pdf.js under the hood), no native
 * binaries, no subprocesses. Output is model-friendly markdown, not a
 * layout-perfect transcription:
 *
 * - one `## Page N` section per page (capped),
 * - numbered section headers ("7.3 Electrical Characteristics") and short
 *   all-caps lines become `###` headings,
 * - runs of whitespace-aligned lines (spec tables) are fenced so columns
 *   survive as monospace,
 * - everything else becomes plain paragraphs.
 *
 * Scanned/image-only PDFs yield no text — callers must handle the empty
 * case by asking for pasted text instead.
 */

export const PDF_MAX_PAGES = 12;
export const PDF_MAX_CHARS = 12_000;
export const PDF_MAX_BYTES = 8_000_000;

type TextLine = {
  text: string;
  tableLike: boolean;
};

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 90) {
    return false;
  }
  if (/^\d+(\.\d+)*\s+\S/.test(trimmed)) {
    return true;
  }
  if (
    trimmed.length <= 60 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    !/[.!?]$/.test(trimmed) &&
    !/\d/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function splitBlocks(pageText: string): TextLine[] {
  return pageText
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
    .filter((line) => line.length > 0)
    .map((line) => ({
      text: line,
      tableLike: / {2,}|\t/.test(line),
    }));
}

export function pageTextToMarkdown(pageText: string, pageNumber: number): string {
  const out: string[] = [`## Page ${pageNumber}`];
  let inTable = false;

  const flushTable = () => {
    if (inTable) {
      out.push("```");
      inTable = false;
    }
  };

  for (const line of splitBlocks(pageText)) {
    if (isHeading(line.text)) {
      flushTable();
      const clean = line.text.replace(/^#+\s*/, "");
      out.push(`### ${clean}`);
    } else if (line.tableLike) {
      if (!inTable) {
        out.push("```");
        inTable = true;
      }
      out.push(line.text);
    } else {
      flushTable();
      out.push(line.text);
      out.push("");
    }
  }
  flushTable();

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type PdfMarkdown = {
  markdown: string;
  pages: number;
  truncated: boolean;
};

export async function pdfBufferToMarkdown(
  data: Uint8Array,
  maxPages = PDF_MAX_PAGES,
  maxChars = PDF_MAX_CHARS,
): Promise<PdfMarkdown> {
  let extracted: { text: string[] | string; totalPages: number };
  try {
    await ensurePdfjs();
    extracted = (await extractText(data, { mergePages: false })) as {
      text: string[] | string;
      totalPages: number;
    };
  } catch {
    throw new Error("pdf_unreadable");
  }

  const pages = Array.isArray(extracted.text)
    ? extracted.text
    : [extracted.text];
  const totalPages = extracted.totalPages ?? pages.length;

  const sections: string[] = [];
  let chars = 0;
  let truncated = totalPages > maxPages;
  const take = Math.min(pages.length, maxPages);

  for (let i = 0; i < take; i += 1) {
    const section = pageTextToMarkdown(pages[i] ?? "", i + 1);
    if (chars + section.length > maxChars) {
      const room = maxChars - chars;
      if (room > 200) {
        sections.push(`${section.slice(0, room)}… [truncated]`);
      }
      truncated = true;
      break;
    }
    sections.push(section);
    chars += section.length;
  }

  const markdown = sections.join("\n\n").trim();
  if (!markdown) {
    throw new Error("pdf_no_text");
  }

  return { markdown, pages: totalPages, truncated };
}
