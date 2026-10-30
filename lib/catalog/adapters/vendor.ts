import type {
  CatalogAdapter,
  CatalogFilter,
  CatalogPart,
} from "@/lib/catalog/types";

/**
 * Placeholder distributor adapters. They implement the same interface as the
 * local adapter so selecting one is a configuration change, not a UI rewrite.
 * Until a vendor SDK and credentials are wired, every call fails loudly with
 * a stable error instead of silently returning local data under a vendor name.
 */
export function createUnavailableCatalogAdapter(
  name: string,
  credentialEnv: string,
): CatalogAdapter {
  function unavailable(): never {
    throw new Error(
      `catalog_adapter_not_configured:${name}: set ${credentialEnv} and wire the vendor SDK behind this adapter`,
    );
  }

  return {
    async listParts(_filter?: CatalogFilter): Promise<CatalogPart[]> {
      void _filter;
      return unavailable();
    },
    async getPart(_id: string): Promise<CatalogPart | null> {
      void _id;
      return unavailable();
    },
    async getPartsByIds(_ids: string[]): Promise<CatalogPart[]> {
      void _ids;
      return unavailable();
    },
    async listCategories() {
      return unavailable();
    },
  };
}

export const octopartCatalogAdapter = createUnavailableCatalogAdapter(
  "octopart",
  "OCTOPART_API_KEY",
);
export const digikeyCatalogAdapter = createUnavailableCatalogAdapter(
  "digikey",
  "DIGIKEY_CLIENT_ID",
);
export const mouserCatalogAdapter = createUnavailableCatalogAdapter(
  "mouser",
  "MOUSER_API_KEY",
);
