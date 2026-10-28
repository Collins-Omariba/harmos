import Image from "next/image";

/**
 * Fixed, non-interactive backdrop art. Three circuit photos distributed so
 * they read as texture, not content:
 * - circuit-1: tall band along the right edge, feathered on all sides
 * - circuit-2: low accent anchored bottom-left, radially faded
 * - circuit-3: short full-width wash under the header, faded downward
 *
 * Opacity stays in the 5–10% range and edges are CSS-masked so no hard
 * photo rectangles ever appear. circuit-4/5 are unused spares.
 */
export function BackgroundArt() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
    >
      {/* Right-edge band */}
      <div className="absolute inset-y-0 right-0 w-[min(46rem,72vw)] opacity-[0.20] dark:opacity-[0.14]">
        <Image
          src="/backgrounds/circuit-1.jpg"
          alt=""
          fill
          sizes="46rem"
          quality={60}
          loading="eager"
          className="object-cover [mask-image:linear-gradient(to_left,black_25%,transparent_92%),linear-gradient(to_bottom,transparent,black_12%,black_82%,transparent)] [mask-composite:intersect] saturate-50 sepia-[0.15] dark:brightness-[0.8]"
        />
      </div>

      {/* Bottom-left accent */}
      <div className="absolute bottom-0 left-0 h-[min(26rem,44vh)] w-[min(38rem,60vw)] opacity-[0.18] dark:opacity-[0.13]">
        <Image
          src="/backgrounds/circuit-2.jpg"
          alt=""
          fill
          sizes="38rem"
          quality={60}
          className="object-cover [mask-image:radial-gradient(115%_115%_at_18%_92%,black_25%,transparent_72%)] saturate-50 sepia-[0.15] dark:brightness-[0.8]"
        />
      </div>

      {/* Top wash under the header */}
      <div className="absolute inset-x-0 top-0 h-[min(20rem,30vh)] opacity-[0.14] dark:opacity-[0.10]">
        <Image
          src="/backgrounds/circuit-3.jpg"
          alt=""
          fill
          sizes="100vw"
          quality={60}
          className="object-cover [mask-image:linear-gradient(to_bottom,black_10%,transparent_95%)] saturate-50 sepia-[0.15] dark:brightness-[0.8]"
        />
      </div>
    </div>
  );
}
