import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionToken,
  passwordsMatch,
  verifySessionToken,
} from "@/lib/auth/session";
import { getCatalogAdapter } from "@/lib/catalog/adapters";

test("session tokens verify until expiry and reject tampering", () => {
  const token = createSessionToken("correct horse battery staple", 1000);

  assert.equal(verifySessionToken(token, "correct horse battery staple", 1001), true);
  assert.equal(verifySessionToken(token, "wrong password", 1001), false);
  assert.equal(
    verifySessionToken(token, "correct horse battery staple", 1000 + 8 * 24 * 60 * 60),
    false,
  );
  assert.equal(verifySessionToken(`${token}x`, "correct horse battery staple", 1001), false);
  assert.equal(passwordsMatch("secret", "secret"), true);
  assert.equal(passwordsMatch("secret", "Secret"), false);
});

test("catalog adapter registry defaults local and rejects unknown names", async () => {
  const local = getCatalogAdapter("local");
  assert.ok((await local.listCategories()).length > 0);
  assert.throws(() => getCatalogAdapter("digikye"), /unknown_catalog_adapter/);
  await assert.rejects(
    getCatalogAdapter("digikey").listParts(),
    /catalog_adapter_not_configured:digikey/,
  );
});
