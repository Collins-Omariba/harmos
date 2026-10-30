import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { getCatalogAdapter } from "@/lib/catalog/adapters";

const SECRET = "test-session-secret";

test("passwords hash with unique salts and verify correctly", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");

  assert.notEqual(first, second, "same password gets different salts");
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("correct horse battery staple", second), true);
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(await verifyPassword("", first), false);
});

test("corrupt password hashes never verify", async () => {
  for (const bad of ["", "plaintext", "scrypt$1$2", "md5$abc$def", "scrypt$not$numbers$here$zz$yy"]) {
    assert.equal(await verifyPassword("anything", bad), false, bad || "(empty)");
  }
});

test("session tokens bind a user id, expire, and reject tampering", () => {
  const token = createSessionToken("user-123", SECRET, 1000);

  assert.equal(verifySessionToken(token, SECRET, 1001), "user-123");
  assert.equal(verifySessionToken(token, "wrong-secret", 1001), null);
  assert.equal(
    verifySessionToken(token, SECRET, 1000 + 8 * 24 * 60 * 60),
    null,
    "expired after 7 days",
  );
  assert.equal(verifySessionToken(`${token}x`, SECRET, 1001), null);
  assert.equal(verifySessionToken("user-123.1001", SECRET, 1001), null);
  assert.equal(verifySessionToken(undefined, SECRET), null);
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
