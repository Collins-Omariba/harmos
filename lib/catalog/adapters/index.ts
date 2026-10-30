import { localCatalogAdapter } from "@/lib/catalog/adapters/local";
import {
  digikeyCatalogAdapter,
  mouserCatalogAdapter,
  octopartCatalogAdapter,
} from "@/lib/catalog/adapters/vendor";
import type { CatalogAdapter } from "@/lib/catalog/types";

export const CATALOG_ADAPTER_NAMES = [
  "local",
  "octopart",
  "digikey",
  "mouser",
] as const;

export type CatalogAdapterName = (typeof CATALOG_ADAPTER_NAMES)[number];

export function getCatalogAdapter(
  name: string | undefined = process.env.HARMOS_CATALOG_ADAPTER,
): CatalogAdapter {
  switch ((name ?? "local").toLowerCase()) {
    case "local":
      return localCatalogAdapter;
    case "octopart":
      return octopartCatalogAdapter;
    case "digikey":
      return digikeyCatalogAdapter;
    case "mouser":
      return mouserCatalogAdapter;
    default:
      throw new Error(
        `unknown_catalog_adapter:${name}: expected one of ${CATALOG_ADAPTER_NAMES.join(", ")}`,
      );
  }
}
