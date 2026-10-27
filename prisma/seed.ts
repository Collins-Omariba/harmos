import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_ID = "proj-water-tank-monitor";

async function main() {
  // This is demo data. Every part number and manufacturer below is fictional.
  await prisma.project.deleteMany();

  await prisma.project.create({
    data: {
      id: PROJECT_ID,
      name: "Water Tank Monitor",
      brief:
        "A solar-assisted ESP32 water-tank monitor that reports tank level over Wi-Fi and runs for at least 90 days on a single 18650 cell. This is demo data: every part is fictional.",
      status: "active",
      createdAt: new Date("2026-10-01T09:00:00.000Z"),
      updatedAt: new Date("2026-10-24T16:20:00.000Z"),
      requirements: {
        create: [
          {
            id: "req-01",
            text: "Measure tank level from 0–100% with ±5 mm resolution.",
            kind: "mandatory",
            status: "confirmed",
          },
          {
            id: "req-02",
            text: "Operate for at least 90 days on one 18650 cell at a 15-minute reporting cadence.",
            kind: "mandatory",
            status: "confirmed",
          },
          {
            id: "req-03",
            text: "Use an ESP32-class module with integrated Wi-Fi.",
            kind: "mandatory",
            status: "assumed",
          },
          {
            id: "req-04",
            text: "Report tank level and battery voltage over Wi-Fi every 15 minutes.",
            kind: "preference",
            status: "confirmed",
          },
          {
            id: "req-05",
            text: "Send a low-level alert when the tank drops below 15%.",
            kind: "preference",
            status: "needs_clarification",
          },
          {
            id: "req-06",
            text: "Keep the prototype bill of materials under USD 40.",
            kind: "unknown",
            status: "needs_clarification",
          },
        ],
      },
      components: {
        create: [
          {
            id: "comp-esp32",
            partNumber: "HAR-ESP32-01",
            manufacturer: "Harmos Demo Works",
            package: "HAR-MOD-01",
            datasheetUrl:
              "https://example.com/harmos/datasheets/HAR-ESP32-01.pdf",
            notes:
              "Fictional ESP32-class module with integrated Wi-Fi and a 3.3 V rail.",
          },
          {
            id: "comp-ultrasonic",
            partNumber: "HAR-ULTRA-02",
            manufacturer: "Fictive Sensors Ltd.",
            package: "HAR-SENS-02",
            datasheetUrl:
              "https://example.com/harmos/datasheets/HAR-ULTRA-02.pdf",
            notes:
              "Fictional 40 kHz ultrasonic rangefinder; 3.3 V, 2 cm–4 m range.",
          },
          {
            id: "comp-regulator",
            partNumber: "HAR-REG-03",
            manufacturer: "Placeholder Semiconductor",
            package: "SOT-23-5",
            datasheetUrl:
              "https://example.com/harmos/datasheets/HAR-REG-03.pdf",
            notes:
              "Fictional 3.3 V LDO, 250 mA, 2 µA quiescent current.",
          },
          {
            id: "comp-battery",
            partNumber: "HAR-BAT-04",
            manufacturer: "Demo Cell Co.",
            package: "18650",
            datasheetUrl:
              "https://example.com/harmos/datasheets/HAR-BAT-04.pdf",
            notes:
              "Fictional 3.7 V 2600 mAh Li-ion cell. No real safety claims.",
          },
        ],
      },
      artifacts: {
        create: [
          {
            id: "artifact-firmware",
            kind: "firmware",
            name: "Tank Monitor Firmware",
            version: "v0.3.0",
            hash: "sha256:9f2c1a7e",
            metaJson: JSON.stringify({
              target: "HAR-ESP32-01",
              sizeBytes: 184320,
              build: "demo",
            }),
          },
          {
            id: "artifact-schematic",
            kind: "schematic",
            name: "Tank Monitor Main Board",
            version: "rev A",
            hash: "sha256:4b8d0e21",
            metaJson: JSON.stringify({
              tool: "KiCad 9",
              layers: 2,
              sheets: 3,
            }),
          },
          {
            id: "artifact-datasheet",
            kind: "datasheet",
            name: "HAR-ULTRA-02 Datasheet",
            version: "2026-02",
            hash: "sha256:d41f6c93",
            metaJson: JSON.stringify({
              pages: 28,
              revision: "2026-02",
              source: "fictional",
            }),
          },
        ],
      },
      edges: {
        create: [
          {
            id: "edge-schematic-firmware",
            fromArtifactId: "artifact-schematic",
            toArtifactId: "artifact-firmware",
            kind: "informs",
          },
          {
            id: "edge-datasheet-schematic",
            fromArtifactId: "artifact-datasheet",
            toArtifactId: "artifact-schematic",
            kind: "documents",
          },
        ],
      },
      decisions: {
        create: [
          {
            id: "decision-ldo",
            title: "Regulate with a 3.3 V LDO instead of a buck converter",
            rationale:
              "The radio draws short bursts; a low-quiescent-current LDO keeps sleep current under 15 µA and removes inductor cost. Revisit if the 90-day budget fails during validation.",
            decidedAt: new Date("2026-10-14T11:30:00.000Z"),
          },
        ],
      },
      validationTests: {
        create: [
          {
            id: "test-sleep-current",
            name: "Accelerated 90-day sleep-current run",
            status: "pending",
            notes:
              "Measure average current at a 15-minute report cadence; target ≤ 1.0 mA average.",
          },
        ],
      },
    },
  });

  console.log("Seeded demo project: Water Tank Monitor");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
