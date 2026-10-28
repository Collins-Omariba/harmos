import assert from "node:assert/strict";
import test from "node:test";

import {
  hardwareTargetLabel,
  parseFirmwareMeta,
} from "@/lib/firmware/meta";

const VALID = {
  target: "ESP32-S3",
  version: "v0.3.0",
  profile: "release",
  sizeBytes: 184320,
  checksum: "sha256:9f2c1a7e",
  targetHardware: { name: "Tank Monitor Main Board", version: "rev A" },
};

test("a complete firmware record validates", () => {
  const result = parseFirmwareMeta(JSON.stringify(VALID));
  assert.ok("meta" in result, "should validate");
});

test("versions accept v-prefix and prereleases, nothing else", () => {
  for (const version of ["v0.3.0", "1.2.0", "2.0.0-rc.1"]) {
    const result = parseFirmwareMeta(JSON.stringify({ ...VALID, version }));
    assert.ok("meta" in result, version);
  }
  for (const version of ["0.3", "rev A", "latest", "v1.2", ""]) {
    const result = parseFirmwareMeta(JSON.stringify({ ...VALID, version }));
    assert.ok("error" in result, version);
  }
});

test("profile is debug or release, size is a whole non-negative number", () => {
  const badProfile = parseFirmwareMeta(
    JSON.stringify({ ...VALID, profile: "fast" }),
  );
  assert.ok("error" in badProfile);

  const badSize = parseFirmwareMeta(
    JSON.stringify({ ...VALID, sizeBytes: -12 }),
  );
  assert.ok("error" in badSize);

  const minimal = parseFirmwareMeta(
    JSON.stringify({
      target: "RP2040",
      version: "v1.0.0",
      profile: "debug",
    }),
  );
  assert.ok("meta" in minimal, "size and checksum are optional");
});

test("checksums must look like sha256 hashes", () => {
  const bad = parseFirmwareMeta(
    JSON.stringify({ ...VALID, checksum: "abc123" }),
  );
  assert.ok("error" in bad);

  const emptyOk = parseFirmwareMeta(JSON.stringify({ ...VALID, checksum: "" }));
  assert.ok("meta" in emptyOk, "empty checksum means unknown");
});

test("non-JSON and non-objects are rejected", () => {
  assert.ok("error" in parseFirmwareMeta("{nope"));
  assert.ok("error" in parseFirmwareMeta("[1,2]"));
});

test("hardware target labels read naturally", () => {
  assert.equal(
    hardwareTargetLabel({
      targetHardware: { name: "Main Board", version: "rev A" },
    }),
    "Main Board @ rev A",
  );
  assert.equal(hardwareTargetLabel({}), null);
});
