import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import { fetchPageText, pageMeta } from "@/lib/fetch-page";

function startStub(
  respond: (url: string) => { status: number; contentType: string; body: string },
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const { status, contentType, body } = respond(req.url ?? "/");
      res.writeHead(status, { "content-type": contentType });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve({ server, port: address.port });
    });
  });
}

const HTML = `<!doctype html><html><head>
<title>TPS7A02 Low-Dropout Regulator | TI</title>
<meta name="description" content="200 mA LDO with 25 nA quiescent current.">
</head><body>
<script>var x = 1;</script>
<style>.a { color: red; }</style>
<h1>TPS7A02</h1>
<p>200 mA low-dropout linear regulator.</p>
<p>Quiescent current 25 nA typical.</p>
</body></html>`;

test("pageMeta extracts title, description, and readable text", () => {
  const meta = pageMeta(HTML);

  assert.equal(meta.title, "TPS7A02 Low-Dropout Regulator | TI");
  assert.equal(meta.description, "200 mA LDO with 25 nA quiescent current.");
  assert.ok(meta.text.includes("200 mA low-dropout linear regulator."));
  assert.ok(!meta.text.includes("var x = 1;"), "scripts stripped");
  assert.ok(!meta.text.includes("color: red"), "styles stripped");
});

test("fetchPageText reads HTML pages through the stub", async () => {
  const previous = process.env.HARMOS_ALLOW_LOOPBACK_FETCH;
  process.env.HARMOS_ALLOW_LOOPBACK_FETCH = "1";
  const { server, port } = await startStub(() => ({
    status: 200,
    contentType: "text/html",
    body: HTML,
  }));

  try {
    const result = await fetchPageText(`http://127.0.0.1:${port}/tps7a02`);
    assert.ok(!("error" in result), JSON.stringify(result));
    if (!("error" in result)) {
      assert.match(result.title ?? "", /TPS7A02/);
      assert.ok(result.text.includes("25 nA"));
    }
  } finally {
    if (previous === undefined) {
      delete process.env.HARMOS_ALLOW_LOOPBACK_FETCH;
    } else {
      process.env.HARMOS_ALLOW_LOOPBACK_FETCH = previous;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("non-HTML responses fail with guidance", async () => {
  const previous = process.env.HARMOS_ALLOW_LOOPBACK_FETCH;
  process.env.HARMOS_ALLOW_LOOPBACK_FETCH = "1";
  const { server, port } = await startStub(() => ({
    status: 200,
    contentType: "application/pdf",
    body: "%PDF-1.4 fake",
  }));

  try {
    const pdf = await fetchPageText(`http://127.0.0.1:${port}/ds.pdf`);
    assert.ok("error" in pdf);
    if ("error" in pdf) {
      assert.match(pdf.error, /PDF/);
    }

    const bad = await fetchPageText("not a url");
    assert.ok("error" in bad);
  } finally {
    if (previous === undefined) {
      delete process.env.HARMOS_ALLOW_LOOPBACK_FETCH;
    } else {
      process.env.HARMOS_ALLOW_LOOPBACK_FETCH = previous;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("local and private addresses are off limits by default", async () => {
  const previous = process.env.HARMOS_ALLOW_LOOPBACK_FETCH;
  delete process.env.HARMOS_ALLOW_LOOPBACK_FETCH;

  try {
    for (const url of [
      "http://localhost:3000/x",
      "http://127.0.0.1/y",
      "http://192.168.0.1/z",
      "http://169.254.169.254/latest",
    ]) {
      const result = await fetchPageText(url);
      assert.ok("error" in result, url);
      if ("error" in result) {
        assert.match(result.error, /off limits/);
      }
    }

    const fine = await fetchPageText("notaurl");
    assert.ok("error" in fine);
  } finally {
    if (previous !== undefined) {
      process.env.HARMOS_ALLOW_LOOPBACK_FETCH = previous;
    }
  }
});
