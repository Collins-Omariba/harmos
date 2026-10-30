import assert from "node:assert/strict";
import test from "node:test";

import {
  createUser,
  normalizeEmail,
  verifyCredentials,
} from "@/lib/auth/users";
import { prisma } from "@/lib/db";

const TEST_EMAIL = "auth-test@example.com";

test("signup validates, dedupes, and logs in with the same password", async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  try {
    assert.deepEqual(normalizeEmail("  Auth-Test@Example.COM "), TEST_EMAIL);

    const badEmail = await createUser("not-an-email", "long-enough-password");
    assert.equal(badEmail.ok, false);

    const shortPassword = await createUser(TEST_EMAIL, "short");
    assert.equal(shortPassword.ok, false);

    const created = await createUser("  AUTH-TEST@example.com ", "correct horse battery staple");
    assert.equal(created.ok, true);
    if (created.ok) assert.equal(created.user.email, TEST_EMAIL);

    const stored = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      select: { passwordHash: true },
    });
    assert.ok(stored && !stored.passwordHash.includes("correct horse"));

    const duplicate = await createUser(TEST_EMAIL, "another long password");
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.match(duplicate.message, /already has an account/);

    const goodLogin = await verifyCredentials(TEST_EMAIL, "correct horse battery staple");
    assert.equal(goodLogin.ok, true);

    const wrongPassword = await verifyCredentials(TEST_EMAIL, "wrong password");
    assert.equal(wrongPassword.ok, false);

    const unknownEmail = await verifyCredentials("nobody@example.com", "whatever-password");
    assert.equal(unknownEmail.ok, false);
    if (!wrongPassword.ok && !unknownEmail.ok) {
      assert.equal(wrongPassword.message, unknownEmail.message, "no account probing");
    }
  } finally {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  }

  await prisma.$disconnect();
});
