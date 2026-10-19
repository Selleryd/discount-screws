import bundledProducts from "./data/products.json";
import bundledCoverage from "./data/coverage.json";
import bundledTaxonomy from "./data/taxonomy.json";
import type { CatalogCoverage, CatalogPage, CatalogQuery, CatalogTaxonomy, Product } from "./types";
import { productSearchText, rankProduct, searchTokens, validateProduct } from "./catalog-core";
import { resolveTaxonomySelection, withTaxonomyCounts } from "./taxonomy-core";

// This snapshot is the catalog available to the GitHub Pages storefront.
// Search uses the same attribute ranking, taxonomy and pagination as the hosted store.
const products = (bundledProducts as unknown[]).filter(validateProduct);
const byId = new Map(products.map((product) => [product.id, product]));
const searchText = new Map(products.map((product) => [product.id, productSearchText(product)]));
const taxonomy = bundledTaxonomy as unknown as CatalogTaxonomy;
const rawCoverage = bundledCoverage as unknown as CatalogCoverage & { notes: string | string[] };
const coverage: CatalogCoverage = {
  ...rawCoverage,
  imported: products.length,
  notes: Array.isArray(rawCoverage.notes) ? rawCoverage.notes.join(" ") : rawCoverage.notes,
  notesDetails: rawCoverage.notesDetails || (Array.isArray(rawCoverage.notes) ? rawCoverage.notes : undefined),
};

function fingerprint(input: CatalogQuery): string {
  const value = [input.query || "", input.category || "", input.group || "", input.type || "", input.subcategory || "", input.material || "", input.mode || "catalog", input.sort || "relevance"].join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function cursorOffset(cursor: string | undefined, key: string): number {
  if (!cursor) return 0;
  try {
    const decoded = JSON.parse(atob(cursor.replace(/-/g, "+").replace(/_/g, "/")));
    if (decoded.k !== key || !Number.isInteger(decoded.o) || decoded.o < 0 || decoded.o > 1000000) throw new Error();
    return decoded.o;
  } catch {
    throw new Error("Invalid catalog cursor. Restart your search.");
  }
}

function encodeCursor(offset: number, key: string): string {
  return btoa(JSON.stringify({ o: offset, k: key })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function facets(items: Product[]): CatalogPage["facets"] {
  const categories = new Map<string, number>();
  const materials = new Map<string, number>();
  const subcategories = new Map<string, number>();
  for (const product of items) {
    categories.set(product.category, (categories.get(product.category) || 0) + 1);
    if (product.material) materials.set(product.material, (materials.get(product.material) || 0) + 1);
    const subcategory = product.subcategory || product.specs["Product Category"] || product.category;
    subcategories.set(subcategory, (subcategories.get(subcategory) || 0) + 1);
  }
  const convert = (values: Map<string, number>) => [...values].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  return { categories: convert(categories), materials: convert(materials), subcategories: convert(subcategories) };
}

const allFacets = facets(products);

export function queryCatalog(input: CatalogQuery): CatalogPage {
  const query = (input.query || "").slice(0, 240);
  const category = (input.category || "").slice(0, 120);
  const material = (input.material || "").slice(0, 120);
  const subcategory = (input.subcategory || "").slice(0, 160);
  const selection = resolveTaxonomySelection(taxonomy, { category, group: input.group?.slice(0, 160), type: input.type?.slice(0, 160) });
  const mode = input.mode || "catalog";
  const sort = input.sort || "relevance";
  const key = fingerprint({ query, category: selection.category, group: selection.group || undefined, type: selection.type || undefined, subcategory, material, mode, sort });
  const offset = cursorOffset(input.cursor, key);
  const limit = Math.max(1, Math.min(60, Math.floor(input.limit || 24)));
  const tokens = searchTokens(query);
  let matches = products.filter((product) =>
    (!selection.category || product.category.toLowerCase() === selection.category.toLowerCase()) &&
    (selection.ids === null || selection.ids.has(product.id)) &&
    (!subcategory || (product.subcategory || product.specs["Product Category"] || product.category).toLowerCase() === subcategory.toLowerCase()) &&
    (!material || product.material?.toLowerCase() === material.toLowerCase())
  );
  if (tokens.length) matches = matches.filter((product) => {
    const text = searchText.get(product.id)!;
    return mode === "match" ? tokens.some((token) => text.includes(token)) : tokens.every((token) => text.includes(token));
  });
  matches = matches.map((product) => ({ product, score: rankProduct(product, tokens, query) })).sort((a, b) => {
    const tie = a.product.name.localeCompare(b.product.name) || a.product.id.localeCompare(b.product.id);
    if (sort === "name") return tie;
    if (sort === "price-asc" || sort === "price-desc") {
      if (a.product.price === null) return b.product.price === null ? tie : 1;
      if (b.product.price === null) return -1;
      return (sort === "price-asc" ? a.product.price - b.product.price : b.product.price - a.product.price) || tie;
    }
    return b.score - a.score || tie;
  }).map(({ product }) => product);
  return {
    products: matches.slice(offset, offset + limit),
    total: matches.length,
    nextCursor: offset + limit < matches.length ? encodeCursor(offset + limit, key) : null,
    facets: { ...allFacets, subcategories: facets(matches).subcategories },
    coverage,
    source: "catalog-snapshot",
    filters: { group: selection.group, type: selection.type, subcategory: subcategory || null, category: category || null },
  };
}

export function getTaxonomy(): CatalogTaxonomy {
  return { ...withTaxonomyCounts(taxonomy, new Set(byId.keys())), importedProductCount: products.length, source: "catalog-snapshot" };
}

export function getProduct(id: string): Product | null {
  return byId.get(id) || products.find((product) => product.sku === id) || null;
}

export function getProducts(ids: string[]): Product[] {
  return ids.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
}
