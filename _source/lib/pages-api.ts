import { formatOrder, normalizeCustomer, validateOrderItems } from "./catalog-core";
import { CatalogInputError } from "./taxonomy-core";
import type { CatalogQuery, OrderCustomer, OrderItem } from "./types";

const cacheHeaders = { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" };
const noStoreHeaders = { "Cache-Control": "no-store" };
const WHATSAPP_NUMBER = "18454999269";

function throwIfAborted(signal?: AbortSignal | null): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

// Stop waiting immediately if a component unmounts or starts a newer request.
function abortable<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function readJson(request: Request, maxBytes = 32768): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Please send a JSON request.");
  if (Number(request.headers.get("content-length") || "0") > maxBytes) throw new Error("The request is too large.");
  const text = await abortable(request.text(), request.signal);
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("The request is too large.");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The request must be an object.");
  return value;
}

function methodNotAllowed(allow: string): Response {
  return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: allow } });
}

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/discount-screws(?=\/)/, "");
  const method = request.method;
  // A Pages site has no server-side image service. Keep activation status truthful.
  if (path === "/api/identify") {
    if (method === "GET") return Response.json({ enabled: false, status: "activation-pending", message: "Photo matching will be available after activation." }, { headers: noStoreHeaders });
    if (method === "POST") return Response.json({ code: "AI_NOT_CONFIGURED", aiEnabled: false, message: "Photo matching is not active yet. Describe the part or browse by type and dimensions to find a match.", photoStored: false }, { status: 503, headers: noStoreHeaders });
    return methodNotAllowed("GET, POST");
  }
  if (!["/api/catalog", "/api/taxonomy", "/api/order", "/api/match"].includes(path) && !path.startsWith("/api/products/")) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  const expectedMethod = path === "/api/order" || path === "/api/match" ? "POST" : "GET";
  if (method !== expectedMethod) return methodNotAllowed(expectedMethod);

  const catalog = await abortable(import("./pages-catalog"), request.signal);
  throwIfAborted(request.signal);
  if (path === "/api/catalog") {
    try {
      const params = url.searchParams;
      const rawLimit = Number(params.get("limit") || 24);
      const requestedSort = params.get("sort");
      const sort: CatalogQuery["sort"] = requestedSort === "price-asc" || requestedSort === "price-desc" || requestedSort === "name" ? requestedSort : "relevance";
      const mode = params.get("mode") === "match" ? "match" : "catalog";
      const result = catalog.queryCatalog({ query: params.get("query") || params.get("q") || undefined, category: params.get("category") || undefined, group: params.get("group") || undefined, type: params.get("type") || undefined, subcategory: params.get("subcategory") || undefined, material: params.get("material") || undefined, cursor: params.get("cursor") || undefined, limit: Number.isFinite(rawLimit) ? rawLimit : 24, sort, mode });
      return Response.json({ ...result, searchMode: mode, matchNote: mode === "match" ? "Closest catalog matches. Confirm diameter, length, thread pitch and material before ordering." : undefined }, { headers: cacheHeaders });
    } catch (error) {
      const invalid = error instanceof CatalogInputError || (error instanceof Error && error.message.includes("cursor"));
      return Response.json({ error: invalid ? (error as Error).message : "The catalog is temporarily unavailable. Please try again." }, { status: invalid ? 400 : 503 });
    }
  }
  if (path === "/api/taxonomy") {
    return Response.json(catalog.getTaxonomy(), { headers: cacheHeaders });
  }
  if (path.startsWith("/api/products/")) {
    let id: string;
    try { id = decodeURIComponent(path.slice("/api/products/".length)); } catch { id = ""; }
    const product = id && id.length <= 160 ? catalog.getProduct(id) : null;
    return product ? Response.json({ product, pricingNote: "Reference pricing only. Final price, pack size and availability are confirmed with your order request." }, { headers: { "Cache-Control": "public, max-age=60" } }) : Response.json({ error: "Product not found." }, { status: 404 });
  }
  if (path === "/api/match") {
    let body: Record<string, unknown>;
    try { body = await readJson(request, 4096); } catch {
      throwIfAborted(request.signal);
      return Response.json({ error: "Please send a valid description request." }, { status: 400 });
    }
    if (typeof body.query !== "string" || body.query.trim().length < 2 || body.query.length > 240) return Response.json({ error: "Describe the part in 2 to 240 characters." }, { status: 400 });
    try {
      const result = catalog.queryCatalog({ query: body.query, category: typeof body.category === "string" ? body.category : undefined, material: typeof body.material === "string" ? body.material : undefined, mode: "match", limit: 24 });
      return Response.json({ ...result, method: "catalog-attribute-search", aiEnabled: false, matchNote: "Closest catalog matches based on your description. Confirm diameter, length, thread pitch, head and material before ordering.", exactMatchGuaranteed: false }, { headers: noStoreHeaders });
    } catch { return Response.json({ error: "The catalog search is temporarily unavailable. Please try again." }, { status: 503 }); }
  }

  let items: OrderItem[], customer: OrderCustomer;
  try {
    const body = await readJson(request);
    items = validateOrderItems(body.items);
    customer = normalizeCustomer(body.customer);
  } catch (error) {
    throwIfAborted(request.signal);
    return Response.json({ error: error instanceof SyntaxError ? "Please send a valid order request." : error instanceof Error ? error.message : "Please check your order request." }, { status: 400 });
  }
  const products = catalog.getProducts(items.map((item) => item.id));
  if (products.length !== items.length) return Response.json({ error: "One or more products could not be found. Refresh your request and try again." }, { status: 400 });
  const { text, subtotal } = formatOrder(items, products, customer);
  return Response.json({ text, subtotal, whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, whatsappConfigured: true, sent: false, saved: false, pricingNote: "Reference prices only. The team confirms pricing, availability, shipping and tax before you pay.", message: "Review your message in WhatsApp and tap Send to request your order." }, { headers: noStoreHeaders });
}

/** Browser-local counterpart of the storefront API; no customer data is sent or stored. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  throwIfAborted(init?.signal);
  const origin = typeof window === "undefined" ? "https://selleryd.github.io" : window.location.origin;
  const request = new Request(new URL(input, `${origin}/discount-screws/`), init);
  const response = await abortable(route(request), init?.signal);
  throwIfAborted(init?.signal);
  return response;
}
