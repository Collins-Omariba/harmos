import assert from "node:assert/strict";
import test from "node:test";

import { buildMinimalPdf } from "@/tests/pdf-fixture";
import {
  pageTextToMarkdown,
  pdfBufferToMarkdown,
} from "@/lib/pdf-to-markdown";

function minimalPdf(): Uint8Array {
  return buildMinimalPdf([
    "7.3 Electrical Characteristics",
    "Supply voltage range is 1.7 V to 6.0 V.",
    "VOUT   3.267 V   3.3 V   3.333 V",
  ]);
}

test("page text becomes markdown with headings and fenced tables", () => {
  const md = pageTextToMarkdown(
    "7.3 Electrical Characteristics\nSupply voltage range is 1.7 V to 6.0 V.\nVOUT   3.267 V   3.3 V   3.333 V",
    1,
  );

  assert.match(md, /## Page 1/);
  assert.match(md, /### 7\.3 Electrical Characteristics/);
  assert.match(md, /```\nVOUT {2,}3\.267/);
});

test("a real (if tiny) PDF converts end to end", async () => {
  const result = await pdfBufferToMarkdown(minimalPdf());

  assert.equal(result.pages, 1);
  assert.equal(result.truncated, false);
  assert.match(result.markdown, /Electrical Characteristics/);
  assert.match(result.markdown, /1\.7 V to 6\.0 V/);
});

test("garbage bytes fail loudly instead of hanging", async () => {
  await assert.rejects(
    pdfBufferToMarkdown(new TextEncoder().encode("definitely not a pdf at all, just text")),
    /pdf_unreadable/,
  );
});
