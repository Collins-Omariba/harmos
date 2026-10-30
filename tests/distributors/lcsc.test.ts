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

test("detail-endpoint param names map: supply variant, tx/rx current, buses", () => {
  const specs = mapLcscParametersToSpecs([
    { name: "Voltage  -  Supply", value: "3V~3.6V" },
    { name: "Operating Temperature", value: "-40℃~+105℃" },
    { name: "Receive  Current", value: "82mA" },
    { name: "Current Of Transmitting", value: "350mA" },
    { name: "Interface", value: "SPI;UART;I2C;I2S;USB;JTAG" },
    { name: "Wireless Standard", value: "Bluetooth5.0" },
    { name: "Output Power", value: "20.5dBm" },
  ]);

  assert.deepEqual(specs, {
    supplyMinV: 3,
    supplyMaxV: 3.6,
    operatingTempMinC: -40,
    operatingTempMaxC: 105,
    currentTypA: 0.082,
    currentMaxA: 0.35,
    interfaces: ["spi", "uart", "i2c", "i2s", "usb", "jtag"],
    wireless: ["bluetooth"],
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

const DETAIL_FIXTURE = {
  productCode: "C3013922",
  productModel: "ESP32-C3-MINI-1U-H4",
  brandNameEn: "ESPRESSIF",
  productIntroEn: "2.4GHz ESP32-C3FH -104dBm SMD,13.2x12.5mm RF Transceiver Modules and Modems RoHS",
  title: "ESPRESSIF ESP32-C3-MINI-1U-H4",
  parentCatalogList: [{ catalogNameEn: "RF and Wireless" }],
  parentCatalogName: "IoT/Communication Modules",
  catalogName: "RF Transceiver Modules and Modems",
  encapStandard: "SMD,13.2x12.5mm",
  pdfUrl: "https://datasheet.lcsc.com/datasheet/pdf/b85cef.pdf?productCode=C3013922",
  productImages: ["https://assets.lcsc.com/x.jpg"],
  stockNumber: 1382,
  minBuyNumber: 1,
  currencyType: "USD",
  currencySymbol: "$",
  productPriceList: [
    { ladder: 1, productPrice: "3.4819", usdPrice: 3.4819 },
    { ladder: 10, productPrice: "3.1148", usdPrice: 3.1148 },
  ],
  paramVOList: [
    { paramName: "工作电压", paramNameEn: "Voltage - Supply", paramValue: "3V~3.6V", paramValueEn: "3V~3.6V" },
    { paramName: "接口类型", paramNameEn: "Interface", paramValue: "SPI;UART;I2C", paramValueEn: "SPI;UART;I2C" },
    { paramName: "工作温度", paramNameEn: "Operating Temperature", paramValue: "-40℃~+105℃", paramValueEn: "-40℃~+105℃" },
    { paramName: "接收电流", paramNameEn: "Receive Current", paramValue: "82mA", paramValueEn: "82mA" },
  ],
};

const OFFICIAL_FIXTURE = {
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

test("exact codes resolve through the public detail endpoint", async () => {
  const seen: string[] = [];
  const restoreFetch = mockFetch((url) => {
    seen.push(url);
    assert.ok(
      url.includes("ftps/wm/product/detail"),
      `codes must hit the public detail endpoint, got ${url}`,
    );
    return {
      code: 200,
      msg: null,
      ok: true,
      result: url.toUpperCase().includes("C3013922") ? DETAIL_FIXTURE : null,
    };
  });

  try {
    const found = await fetchLcscPartByCode("c3013922");
    assert.ok(found, "exact match resolves");
    assert.equal(found.productCode, "C3013922");
    assert.equal(found.mpn, "ESP32-C3-MINI-1U-H4");
    assert.equal(found.manufacturer, "ESPRESSIF");
    assert.equal(found.packageName, "SMD,13.2x12.5mm");
    assert.equal(found.currency, "USD");
    assert.equal(found.priceBreaks[0]?.unitPrice, 3.4819);
    assert.equal(found.stockAvailable, 1382);
    assert.deepEqual(found.categoryPath, [
      "RF and Wireless",
      "IoT/Communication Modules",
      "RF Transceiver Modules and Modems",
    ]);
    assert.ok(
      found.parameters.some((p) => p.name === "Voltage - Supply"),
      "english params preserved",
    );

    const missing = await fetchLcscPartByCode("C999999");
    assert.equal(missing, null);
    assert.equal(seen.length, 2, "no official-API calls without keys");
  } finally {
    restoreFetch();
  }
});

test("official API is the fallback when the public lookup fails", async () => {
  const restoreCreds = withCreds();
  const seen: string[] = [];
  const restoreFetch = mockFetch((url) => {
    seen.push(url);
    if (url.includes("ftps/wm/product/detail")) {
      return { code: 500, msg: "boom", result: null };
    }
    return {
      success: true,
      code: 200,
      message: "ok",
      result: { productCount: 1, products: [OFFICIAL_FIXTURE] },
    };
  });

  try {
    const found = await fetchLcscPartByCode("C25804");
    assert.ok(found, "official fallback resolves");
    assert.equal(found.productCode, "C25804");
    assert.equal(found.mpn, "0603WAF1002T5E");
    assert.ok(seen.some((u) => u.includes("ftps/wm/product/detail")));
    assert.ok(seen.some((u) => u.includes("api.lcsc.com")));
  } finally {
    restoreFetch();
    restoreCreds();
  }
});

test("without keys a failing public lookup surfaces its error", async () => {
  const savedKey = process.env.LCSC_API_KEY;
  const savedSecret = process.env.LCSC_API_SECRET;
  delete process.env.LCSC_API_KEY;
  delete process.env.LCSC_API_SECRET;
  const restoreFetch = mockFetch(() => ({ code: 500, msg: "boom", result: null }));

  try {
    await assert.rejects(
      fetchLcscPartByCode("C25804"),
      (error: unknown) => {
        assert.ok(error instanceof DistributorError);
        assert.equal(error.code, "bad-response");
        return true;
      },
    );
  } finally {
    restoreFetch();
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});

test("official API error codes map to actionable errors", async () => {
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
        // Non-code keywords go straight to the official API.
        await assert.rejects(searchLcscParts("STM32F103"), (error: unknown) => {
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

test("keyword search without keys explains itself", async () => {
  const savedKey = process.env.LCSC_API_KEY;
  const savedSecret = process.env.LCSC_API_SECRET;
  delete process.env.LCSC_API_KEY;
  delete process.env.LCSC_API_SECRET;

  try {
    await assert.rejects(searchLcscParts("STM32F103"), (error: unknown) => {
      assert.ok(error instanceof DistributorError);
      assert.match(error.message, /exact product code/);
      return true;
    });
  } finally {
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});

test("public detail lookups resolve without keys and stay off the signed API", async () => {
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
      url.includes("ftps/wm/product/detail"),
      `codes must hit the public detail endpoint, got ${url}`,
    );
    return { code: 200, msg: null, ok: true, result: DETAIL_FIXTURE };
  });

  try {
    const found = await fetchLcscPartByCode("c3013922");
    assert.ok(found, "public lookup resolves the code");
    assert.equal(found.productCode, "C3013922");
    assert.equal(found.mpn, "ESP32-C3-MINI-1U-H4");
    assert.equal(found.currency, "USD");
    assert.deepEqual(found.priceBreaks[0], {
      breakQuantity: 1,
      unitPrice: 3.4819,
    });
    assert.equal(
      found.sourceUrl,
      "https://www.lcsc.com/product-detail/C3013922.html",
    );
    assert.equal(
      found.datasheetUrl,
      "https://datasheet.lcsc.com/datasheet/pdf/b85cef.pdf?productCode=C3013922",
    );
    assert.equal(seen.length, 1);
  } finally {
    restoreFetch();
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});

test("public lookups are throttled to one request per 2 seconds", async () => {
  const { PUBLIC_LCSC_MIN_INTERVAL_MS } = await import(
    "@/lib/distributors/lcsc"
  );
  assert.equal(PUBLIC_LCSC_MIN_INTERVAL_MS, 2000);

  const restoreFetch = mockFetch(() => ({ code: 200, result: null }));

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

test("preview over the public endpoint carries verified USD pricing", async () => {
  const savedKey = process.env.LCSC_API_KEY;
  const savedSecret = process.env.LCSC_API_SECRET;
  delete process.env.LCSC_API_KEY;
  delete process.env.LCSC_API_SECRET;

  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({ code: 200, msg: null, ok: true, result: DETAIL_FIXTURE }),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const { previewLcscImportAction } = await import(
      "@/app/actions/distributors"
    );
    const result = await previewLcscImportAction("C3013922");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.part.priceUsd, 3.4819);
      assert.equal(result.part.currency, "USD");
      assert.equal(result.part.listingPrice, null);
      assert.equal(result.part.categoryGuess, "mcu");
      assert.ok(result.part.mappedSpecCount >= 4);
      assert.ok(result.part.parameterCount > 0);
    }
  } finally {
    globalThis.fetch = original;
    if (savedKey !== undefined) process.env.LCSC_API_KEY = savedKey;
    if (savedSecret !== undefined) process.env.LCSC_API_SECRET = savedSecret;
  }
});
