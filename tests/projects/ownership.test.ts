import assert from "node:assert/strict";
import test from "node:test";

import { requireProjectAccess } from "@/lib/auth/users";
import {
  accessibleProjectFilter,
  listProjectSummaries,
} from "@/lib/projects";
import { prisma } from "@/lib/db";

const EMAIL_A = "owner-a@example.com";
const EMAIL_B = "owner-b@example.com";

test("projects are private to their owner; ownerless rows stay shared", async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [EMAIL_A, EMAIL_B] } },
  });
  await prisma.project.deleteMany({
    where: { id: { in: ["proj-owned-a", "proj-owned-b", "proj-shared-t"] } },
  });

  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: {
        id: "user-owner-a",
        email: EMAIL_A,
        passwordHash: "test-hash",
      },
    }),
    prisma.user.create({
      data: {
        id: "user-owner-b",
        email: EMAIL_B,
        passwordHash: "test-hash",
      },
    }),
  ]);

  try {
    await prisma.project.createMany({
      data: [
        { id: "proj-owned-a", name: "A project", brief: "Owned by A.", status: "draft", ownerId: userA.id },
        { id: "proj-owned-b", name: "B project", brief: "Owned by B.", status: "draft", ownerId: userB.id },
        { id: "proj-shared-t", name: "Shared", brief: "Ownerless demo-style row.", status: "active" },
      ],
    });

    const seenByA = new Set(
      (await listProjectSummaries(userA.id)).map((p) => p.id),
    );
    assert.ok(seenByA.has("proj-owned-a"), "owner sees their project");
    assert.ok(seenByA.has("proj-shared-t"), "owner sees shared rows");
    assert.ok(!seenByA.has("proj-owned-b"), "owner never sees another user's project");

    const seenByB = new Set(
      (await listProjectSummaries(userB.id)).map((p) => p.id),
    );
    assert.ok(seenByB.has("proj-owned-b"));
    assert.ok(seenByB.has("proj-shared-t"));
    assert.ok(!seenByB.has("proj-owned-a"));

    assert.equal(await requireProjectAccess(userA.id, "proj-owned-a"), true);
    assert.equal(await requireProjectAccess(userA.id, "proj-owned-b"), false);
    assert.equal(await requireProjectAccess(userA.id, "proj-shared-t"), true);
    assert.equal(await requireProjectAccess(userB.id, "proj-owned-a"), false);
    assert.equal(await requireProjectAccess(userA.id, "proj-missing"), false);

    // The filter itself only ever selects own + shared rows.
    const scoped = await prisma.project.findMany({
      where: { ...accessibleProjectFilter(userA.id), id: "proj-owned-b" },
    });
    assert.deepEqual(scoped, []);
  } finally {
    await prisma.project.deleteMany({
      where: { id: { in: ["proj-owned-a", "proj-owned-b", "proj-shared-t"] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [EMAIL_A, EMAIL_B] } },
    });
    await prisma.$disconnect();
  }
});
