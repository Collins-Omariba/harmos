import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  fetchLcscPartByCode,
  guessCatalogCategory,
  lcscAuthHeaders,
  mapLcscParametersToSpecs,
  normalizeLcscCode,
  parseEngineeringValue,
  quotePlus,
  searchLcscParts,
} from "@/lib/distributors/lcsc";
import { DistributorError } from "@/lib/distributors/types";

const GUIDE_KEY = "7dc6035da7874b5b9bc245bd28017290";
const GUIDE_SECRET = "eiru73y343r36fdi";
const GUIDE_NONCE = "63yeike7dy6c2kjd";
const GUIDE_TIMESTAMP = 1524662065;

test("signature matches the usage-guide construction", () => {
  const headers = lcscAuthHeaders(GUIDE_KEY, GUIDE_SECRET, {}, {
    nonce: GUIDE_NONCE,
    timestamp: GUIDE_TIMESTAMP,
  });

  // Pinned against an independent sha256 of the guide's example sign string.
  assert.equal(
    headers.signature,
    "527c9b2bf59f8789d363f256019fa1755edc0d3056bfc575b0767ffcb565f780",
  );
  assert.equal(headers.key, GUIDE_KEY);
  assert.equal(headers.nonce, GUIDE_NONCE);
  assert.equal(headers.timestamp, String(GUIDE_TIMESTAMP));
});

test("business params are sorted and quote_plus-encoded into the signature", () => {
  const headers = lcscAuthHeaders(
    GUIDE_KEY,
    GUIDE_SECRET,
    { keyword: "10kΩ, 1%", limit: 10, offset: 0 },
    { nonce: GUIDE_NONCE, timestamp: GUIDE_TIMESTAMP },
  );

  const expectedBase =
    `key=${GUIDE_KEY}&nonce=${GUIDE_NONCE}&secret=${GUIDE_SECRET}` +
    `&timestamp=${GUIDE_TIMESTAMP}` +
    "&keyword=10k%CE%A9%2C+1%25&limit=10&offset=0";
  assert.equal(
    headers.signature,
    createHash("sha256").update(expectedBase, "utf-8").digest("hex"),
  );
  assert.equal(quotePlus("a b!'()*"), "a+b%21%27%28%29%2A");
});

test("product codes normalize, junk is rejected before any network call", () => {
  assert.equal(normalizeLcscCode("  c25804 "), "C25804");
  for (const bad of ["", "STM32F103", "C", "C12X45"]) {
    assert.throws(
      () => normalizeLcscCode(bad),
      (error: unknown) =>
        error instanceof DistributorError && error.code === "not-found",
      JSON.stringify(bad),
    );
  }
});

test("category guess maps LCSC trees onto catalog categories", () => {
  assert.equal(
    guessCatalogCategory([
      "Power Management",
      "Linear Voltage Regulators (LDO)",
    ]),
    "ldo",
  );
  assert.equal(
    guessCatalogCategory(["Microcontrollers", "ARM Cortex-M"]),
    "mcu",
  );
  assert.equal(
    guessCatalogCategory(["Sensors", "Ultrasonic Sensors"]),
    "level-sensor",
  );
  assert.equal(guessCatalogCategory(["Resistors", "Thick Film"]), null);
  assert.equal(guessCatalogCategory([]), null);
});

test("engineering values parse units and ranges", () => {
  assert.equal(parseEngineeringValue("500mA", "A"), 0.5);
  assert.equal(parseEngineeringValue("10µA", "A"), 0.00001);
  assert.equal(parseEngineeringValue("2.5V ~ 5.5V", "V"), 2.5);
  assert.equal(parseEngineeringValue("-40°C", "C"), -40);
  assert.equal(parseEngineeringValue("nope", "V"), null);

  const specs = mapLcscParametersToSpecs([
    { name: "Operating Temperature", value: "-55℃~+155℃" },
    { name: "Supply Voltage", value: "2.7V~5.5V" },
    { name: "Quiescent Current", value: "1.6µA" },
    { name: "Output Current", value: "300mA" },
    { name: "Resistance", value: "10kΩ" },
  ]);

  assert.deepEqual(specs, {
    operatingTempMinC: -55,
    operatingTempMaxC: 155,
    supplyMinV: 2.7,
    supplyMaxV: 5.5,
    quiescentCurrentA: 0.0000016,
    outputCurrentMaxA: 0.3,
  });
});

function mockFetch(handler: (url: string) => unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown) => {
    const body = handler(String(input));
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

const PRODUCT_FIXTURE = {
  lcscProductNumber: "C25804",
  manufacturerProductNumber: "0603WAF1002T5E",
  manufacturer: { id: 1, name: "UNI-ROYAL" },
  description: "10kΩ ±1% 100mW 0603 Thick Film Resistor",
  productDetailURL: "https://www.lcsc.com/product-detail/C25804.html",
  datasheetURL: "https://datasheet.lcsc.com/x.pdf?productCode=C25804",
  productPhotoURL: ["https://assets.lcsc.com/x.jpg"],
  category: {
    firstCatalogName: "Resistors",
    secondCatalogName: "Thick Film Resistors",
  },
  package: "0603",
  isInStock: true,
  quantityAvailable: 12000,
  minimumOrderQuantity: 10,
  productParameters: [{ paramName: "Resistance", paramValue: "10kΩ" }],
  productPrice: {
    currency: "USD",
    standardPricing: [
      { breakQuantity: 10, unitPrice: 0.0021 },
      { breakQuantity: 100, unitPrice: 0.0016 },
    ],
  },
};

function withCreds() {
  const saved = {
    key: process.env.LCSC_API_KEY,
    secret: process.env.LCSC_API_SECRET,
  };
  process.env.LCSC_API_KEY = "test-key";
  process.env.LCSC_API_SECRET = "test-secret";
  return () => {
    if (saved.key === undefined) delete process.env.LCSC_API_KEY;
    else process.env.LCSC_API_KEY = saved.key;
    if (saved.secret === undefined) delete process.env.LCSC_API_SECRET;
    else process.env.LCSC_API_SECRET = saved.secret;
  };
}

test("search maps the LCSC envelope onto distributor parts", async () => {
  const restoreCreds = withCreds();
  const restoreFetch = mockFetch((url) => ({
    success: true,
    code: 200,
    message: "ok",
    result: {
      productCount: url.toUpperCase().includes("C25804") ? 1 : 0,
      products: url.toUpperCase().includes("C25804") ? [PRODUCT_FIXTURE] : [],
    },
  }));

  try {
    const found = await fetchLcscPartByCode("c25804");
    assert.ok(found, "exact match resolves");
    assert.equal(found.productCode, "C25804");
    assert.equal(found.mpn, "0603WAF1002T5E");
    assert.equal(found.manufacturer, "UNI-ROYAL");
    assert.equal(found.packageName, "0603");
    assert.equal(found.priceBreaks[0]?.unitPrice, 0.0021);
    assert.deepEqual(found.categoryPath, [
      "Resistors",
      "Thick Film Resistors",
    ]);

    const missing = await searchLcscParts("C999999", { limit: 5 });
    assert.deepEqual(missing, []);
  } finally {
    restoreFetch();
    restoreCreds();
  }
});

test("LCSC error codes map to actionable errors", async () => {
  const restoreCreds = withCreds();
  try {
    for (const [code, expected] of [
      [4002, "auth"],
      [429, "rate-limit"],
    ] as const) {
      const restoreFetch = mockFetch(() => ({
        success: false,
        code,
        message: "nope",
        result: null,
      }));
      try {
        await assert.rejects(searchLcscParts("C25804"), (error: unknown) => {
          assert.ok(error instanceof DistributorError);
          assert.equal(error.code, expected);
          return true;
        });
      } finally {
        restoreFetch();
      }
    }
  } finally {
    restoreCreds();
  }
});

test("no keys selects the throttled public fallback, never the signed API", async () => {
  const savedKey = process.env.LCSC_API_KEY;
  const savedSecret = process.env.LCSC_API_SECRET;
  delete process.env.LCSC_API_KEY;
  delete process.env.LCSC_API_SECRET;

  const { getCredentials } = await import("@/lib/distributors/lcsc");
  assert.equal(getCredentials(), null);

  const seen: string[] = [];
  const restoreFetch = mockFetch((url) => {
    seen.push(url);
    assert.ok(
      url.includes("lcsc.com/api/products/search"),
      `fallback must hit the public endpoint, got ${url}`,
    );
    return {
      result: {
        productList: [
          {
            productCode: "C25804",
            productModel: "0603WAF1002T5E",
            brandNameEn: "UNI-ROYAL",
            productStockNumber: 12000,
            productDesc: "10kΩ ±1% 100mW 0603 Thick Film Resistor",
            images: [],
            pdfUrl: "https://datasheet.lcsc.com/x.pdf?productCode=C25804",
            priceList: [
              { modifier: 10, price: "0.0021" },
              { modifier: "100", price: "0.0016" },
            ],
          },
        ],
      },
    };
  });

  try {
    const found = await fetchLcscPartByCode("c25804");
    assert.ok(found, "fallback resolves the code");
    assert.equal(found.productCode, "C25804");
    assert.equal(found.mpn, "0603WAF1002T5E");
    assert.equal(found.currency, "UNK");
    assert.deepEqual(found.priceBreaks, [
      { breakQuantity: 10, unitPrice: 0.0021 },
      { breakQuantity: 100, unitPrice: 0.0016 },
    ]);
    assert.equal(
      found.sourceUrl,
      "https://www.lcsc.com/product-detail/C25804.html",
    );
    assert.equal(found.datasheetUrl, "https://datasheet.lcsc.com/x.pdf?productCode=C25804");
    assert.deepEqual(found.categoryPath, []);
    assert.equal(seen.length, 1);
  } finally {
    restoreFetch();
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});

test("public fallback is throttled to one request per 2 seconds", async () => {
  const { PUBLIC_LCSC_MIN_INTERVAL_MS } = await import(
    "@/lib/distributors/lcsc"
  );
  assert.equal(PUBLIC_LCSC_MIN_INTERVAL_MS, 2000);

  const savedKey = process.env.LCSC_API_KEY;
  const savedSecret = process.env.LCSC_API_SECRET;
  delete process.env.LCSC_API_KEY;
  delete process.env.LCSC_API_SECRET;
  const restoreFetch = mockFetch(() => ({ result: { productList: [] } }));

  try {
    const start = Date.now();
    await fetchLcscPartByCode("C11111");
    await fetchLcscPartByCode("C22222");
    assert.ok(
      Date.now() - start >= 1800,
      "second request waits out the courtesy interval",
    );
  } finally {
    restoreFetch();
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});

test("import actions validate before touching the network", async () => {
  const { previewLcscImportAction, importLcscPartAction } = await import(
    "@/app/actions/distributors"
  );

  const badCode = await previewLcscImportAction("not-a-code");
  assert.equal(badCode.ok, false);
  if (!badCode.ok) assert.match(badCode.message, /product code/);

  const badCategory = await importLcscPartAction("C25804", "resistors");
  assert.equal(badCategory.ok, false);
  if (!badCategory.ok) assert.match(badCategory.message, /category/);
});

test("preview over the public fallback shows unverified pricing, stores none", async () => {
  const savedKey = process.env.LCSC_API_KEY;
  const savedSecret = process.env.LCSC_API_SECRET;
  delete process.env.LCSC_API_KEY;
  delete process.env.LCSC_API_SECRET;

  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        result: {
          productList: [
            {
              productCode: "C25804",
              productModel: "0603WAF1002T5E",
              brandNameEn: "UNI-ROYAL",
              productStockNumber: 500,
              productDesc: "10kΩ ±1% 100mW 0603 Thick Film Resistor",
              images: [],
              pdfUrl: "https://datasheet.lcsc.com/x.pdf",
              priceList: [{ modifier: 10, price: "0.0021" }],
            },
          ],
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const { previewLcscImportAction } = await import(
      "@/app/actions/distributors"
    );
    const result = await previewLcscImportAction("C25804");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.part.priceUsd, null);
      assert.equal(result.part.currency, "UNK");
      assert.match(result.part.listingPrice ?? "", /unverified/);
      assert.equal(result.part.categoryGuess, null);
    }
  } finally {
    globalThis.fetch = original;
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});
