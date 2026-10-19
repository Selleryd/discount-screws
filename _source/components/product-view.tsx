"use client";
import { apiFetch } from '@/lib/pages-api';

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, MapPin, MessageCircle, Minus, Phone, Plus, Ruler, ShieldCheck, Truck, Wrench } from "lucide-react";
import type { Product } from "@/lib/types";
import { getReferencePackPrice } from "@/lib/catalog-core";
import "./catalog.css";
import "./product-enhanced.css";
import ProductGallery from "./product-gallery";
import ValueComparison from "./value-comparison";
import { ProductSectionNav } from "./product-cinematic";
import AddToRequestButton from "./add-to-request-button";
import "./product-opening.css";
import PanZoomPhoto from "./pan-zoom-photo";

export interface ProductViewProps {
  product: Product;
  onAdd: (product: Product, quantity?: number) => void;
  onBrowse: (category?: string) => void;
  onOrder: () => void;
  onGuide: () => void;
  onOpen?: (product: Product) => void;
}

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export function ProductView({ product, onAdd, onBrowse, onOrder, onGuide, onOpen }: ProductViewProps) {
  const [quantity, setQuantity] = useState("1");
  const [activeTab, setActiveTab] = useState("specifications");
  const [showSticky, setShowSticky] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setQuantity("1"); setActiveTab("specifications"); }, [product.id]);
  const count = Math.min(9999, Math.max(1, Number.parseInt(quantity, 10) || 1));
  const packPrice = getReferencePackPrice(product, count);
  const subtotal = packPrice === null ? null : packPrice * count;
  const perPiece = packPrice !== null && product.packQuantity ? packPrice / product.packQuantity : null;
  const setCount = (next: number) => setQuantity(String(Math.min(9999, Math.max(1, next))));
  const addToRequest = () => {
    onAdd(product, count);
    setQuantity(String(count));
  };
  const requestQuote = () => { onAdd(product, count); onOrder(); };
  const specs = Object.entries(product.specs).filter(([, value]) => value !== "" && value != null);
  const title = product.name.split(" / ")[0];
  const featureSpecs = [{ name: "Diameter / thread", value: product.diameter }, { name: "Length", value: product.length }, { name: "Material", value: product.material }, { name: "Drive", value: product.drive || product.head }].filter((item) => item.value);

  useEffect(() => {
    if (!heroRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, [product.id]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = page.querySelectorAll<HTMLElement>(".pc-reveal, .product-section-intro, .px-dimensions .px-section-title, .px-planner-heading, .px-faq .px-section-title, .px-related-heading, .px-human");
    page.dataset.pcMotion = "on";
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }), { threshold: .08 });
    sections.forEach((section) => { section.classList.add("pc-reveal"); observer.observe(section); });
    return () => { observer.disconnect(); delete page.dataset.pcMotion; sections.forEach((section) => section.classList.add("is-visible")); };
  }, [product.id, activeTab]);

  return <div className="product-view product-enhanced product-cinematic-page" ref={pageRef}>
    <ProductSectionNav product={product} onQuote={requestQuote}/>
    <div className="product-opening-dark">
    <div className="pc-content pc-opening">
    <nav className="product-breadcrumb" aria-label="Breadcrumb"><button onClick={() => onBrowse()}><ArrowLeft size={15}/>Catalog</button><ChevronRight size={13}/><button onClick={() => onBrowse(product.category)}>{product.category}</button><ChevronRight size={13}/><span>Part {product.sku}</span></nav>
    <section className="product-hero" ref={heroRef} id="product-overview">
      <div className="product-heading">
        <p className="eyebrow">{product.subcategory || product.category} <span> / </span> PART {product.sku}</p>
        <h1>{title}</h1>
        <p className="product-subtitle">{[product.head, product.drive, product.material, product.finish].filter(Boolean).join(" · ")}</p>
      </div>
      <ProductGallery key={product.id} product={product}/>
      <div className="product-summary">
        <div className="product-price"><strong>{packPrice === null ? "Let’s quote your project." : money(packPrice)}</strong><span>{packPrice === null ? "Ask our team for current pricing." : product.packQuantity ? `per pack of ${product.packQuantity.toLocaleString()} pieces` : "Reference pack price"}</span>{perPiece !== null && <small>{unitMoney(perPiece)} per piece{packPrice !== product.price ? " · quantity tier applied" : ""}</small>}</div>
        {product.sourceAvailability === "out-of-stock" && <p className="px-stock-note">Source marked out of stock. Request current availability.</p>}
        {featureSpecs.length > 0 && <dl className="product-key-specs">{featureSpecs.map((item) => <div key={item.name}><dt>{item.name}</dt><dd>{item.value}</dd></div>)}</dl>}
        <div className="product-order-controls"><div className="product-quantity-label"><label htmlFor={`quantity-${product.id}`}>Packs</label>{product.packQuantity && <span>{(count * product.packQuantity).toLocaleString()} pieces total</span>}</div><div className="product-add-row"><div className="product-quantity"><button aria-label="Decrease packs" disabled={count <= 1} onClick={() => setCount(count - 1)}><Minus size={16}/></button><input id={`quantity-${product.id}`} type="number" min="1" max="9999" inputMode="numeric" value={quantity} onChange={(event) => { const value = event.target.value; if (value === "" || /^\d+$/.test(value)) setQuantity(value.slice(0, 4)); }} onBlur={() => setCount(count)} aria-label="Number of packs"/><button aria-label="Increase packs" disabled={count >= 9999} onClick={() => setCount(count + 1)}><Plus size={16}/></button></div><AddToRequestButton className="btn product-add-button" productName={product.name} label="Add to order request" onAdd={addToRequest}/></div><button className="product-whatsapp-button" onClick={requestQuote}><MessageCircle size={18}/>Get a WhatsApp quote<ArrowRight size={17}/></button></div>
        <div className="product-quote-note"><ShieldCheck size={18} strokeWidth={1.3}/><p>No payment taken online. Our team confirms current pricing, availability, shipping and tax before you pay.</p></div>
        <div className="product-match-help"><span>Need to check the fit?</span><button onClick={onGuide}>Find my fastener <ArrowRight size={15}/></button></div>
      </div>
    </section>
    </div>
    </div>
    <div className="pc-content pc-trust-content">
    <section className="px-trust-strip" aria-label="Ordering confidence"><div><ShieldCheck size={20} strokeWidth={1.2}/><span><strong>No card details needed</strong><small>Review your quote before payment</small></span></div><div><Ruler size={20} strokeWidth={1.2}/><span><strong>Specifications first</strong><small>Dimensions and materials listed</small></span></div><a href="tel:+18454999269"><Phone size={20} strokeWidth={1.2}/><span><strong>Talk to a real person</strong><small>845-499-9269</small></span></a><div><Truck size={23} strokeWidth={1.2}/><span><strong>Ships fast with</strong><small>UPS · USPS · FedEx</small><small>Timing confirmed with your quote</small></span></div></section>
    </div>
    <div className="pc-content pc-details-content">
    <section className="product-details" id="product-details">
      <div className="product-detail-tabs" role="tablist" aria-label="Product information"><button id="product-spec-tab" role="tab" aria-selected={activeTab === "specifications"} aria-controls="product-spec-panel" className={activeTab === "specifications" ? "active" : ""} onClick={() => setActiveTab("specifications")}>Dimensions & specifications</button><button id="product-order-tab" role="tab" aria-selected={activeTab === "ordering"} aria-controls="product-order-panel" className={activeTab === "ordering" ? "active" : ""} onClick={() => setActiveTab("ordering")}>Ordering & delivery</button></div>
      {activeTab === "specifications" ? <div id="product-spec-panel" role="tabpanel" aria-labelledby="product-spec-tab" className="product-spec-panel"><div className="product-section-intro"><p className="eyebrow">BUILT ON THE DETAILS</p><h2>Know your part.<br/>Build with confidence.</h2><p>Check the measurements and material before ordering. A close visual match can still have a different thread or fit.</p><button onClick={onGuide}>Get help matching a part <ArrowRight size={16}/></button></div><div className="product-spec-table-wrap"><table className="product-spec-table"><caption className="catalog-sr-only">Specifications for {product.name}</caption><tbody>{specs.length ? specs.map(([key, value]) => <tr key={key}><th scope="row">{key}</th><td>{value}</td></tr>) : <tr><th scope="row">Detailed specifications</th><td>Ask our team to confirm the dimensions for this part.</td></tr>}</tbody></table><p className="product-spec-footnote">Values are shown as supplied in the product listing. Where units or tolerances are not specified, request confirmation before ordering.{product.retrievedAt ? ` Product information retrieved ${product.retrievedAt.slice(0, 10)}.` : ""}</p></div></div> : <div id="product-order-panel" role="tabpanel" aria-labelledby="product-order-tab" className="product-order-panel"><div className="product-section-intro"><p className="eyebrow">FROM YOUR LIST TO YOUR BUILD</p><h2>One request.<br/>A real conversation.</h2><p>Add the parts and quantities you need. We prepare your order request so our team can confirm the details.</p></div><div className="product-order-steps"><div><span>01</span><section><h3>Build your request</h3><p>Select the number of packs. Review every part, size and quantity in your order list.</p></section></div><div><span>02</span><section><h3>Review it with our team</h3><p>Send your prepared request on WhatsApp. Your parts, pack quantities and notes arrive together for our team to review.</p></section></div><div><span>03</span><section><h3>Confirm, then get building</h3><p>We confirm availability, final pricing, shipping options and delivery timing before payment.</p></section></div></div></div>}
    </section>
    <DimensionExplorer product={product}/>
    <QuantityGraph product={product} quantity={count} setQuantity={setCount}/>
    {product.pricingTiers && product.pricingTiers.length > 1 && <section className="product-volume"><div><p className="eyebrow">MORE FOR YOUR NEXT BUILD</p><h2>Planning a bigger order?</h2><p>Reference volume pricing from the product listing. Ask us to confirm your final quote.</p></div><div className="product-volume-table"><table><thead><tr><th>Packs</th><th>Pieces / pack</th><th>Price / pack</th></tr></thead><tbody>{product.pricingTiers.map((tier, index) => <tr key={`${tier.cartons}-${index}`} className={tier.price === packPrice && tier.packQuantity === product.packQuantity ? "px-selected-tier" : ""}><td>{tier.cartons}</td><td>{tier.packQuantity.toLocaleString()}</td><td>{money(tier.price)}</td></tr>)}</tbody></table></div></section>}
    <div id="product-comparison"><ValueComparison onFind={onGuide} onQuote={requestQuote}/></div>
    <ProductEnrichment product={product} quantity={count} onBrowse={onBrowse} onOpen={onOpen}/>
    <section className="product-bottom-cta pc-reveal"><p>Your next build.<br/><span>One message away.</span></p><div className="pc-final-actions"><button className="btn btn-dark" onClick={requestQuote}>Get a WhatsApp quote<ArrowRight size={17}/></button><button className="pc-final-explore" onClick={() => onBrowse(product.category)}>Keep exploring {product.category.toLowerCase()}<ArrowRight size={15}/></button></div></section>
    </div>
    <div className={`px-sticky-order ${showSticky ? "visible" : ""}`} aria-hidden={!showSticky}><div className="px-sticky-inner"><div className="px-sticky-product"><span><small>PART {product.sku}</small><strong>{title}</strong></span></div><div className="px-sticky-price"><small>{count} {count === 1 ? "pack" : "packs"} · reference subtotal</small><strong>{subtotal === null ? "Request pricing" : money(subtotal)}</strong></div><button className="btn" tabIndex={showSticky ? 0 : -1} onClick={requestQuote}>WhatsApp quote<ArrowRight size={17}/></button></div></div>
  </div>;
}

export default ProductView;

const unitMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
const compactNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);

// Convert explicit linear units only, never infer a thread designation or missing unit.
function convertDimension(value: string, unit: "original" | "mm" | "in"): string {
  if (unit === "original") return value;
  const match = value.trim().replace(/[″”]/g, '"').match(/^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s*("|inches|inch|in|mm)$/i);
  if (!match) return value;
  let amount = 0;
  for (const piece of match[1].split(/\s+/)) {
    const fraction = piece.split("/");
    if (fraction.length === 2 && Number(fraction[1]) > 0) amount += Number(fraction[0]) / Number(fraction[1]);
    else if (fraction.length === 1) amount += Number(piece);
    else return value;
  }
  if (!Number.isFinite(amount)) return value;
  const metric = match[2].toLowerCase() === "mm";
  return `${compactNumber(unit === "mm" ? metric ? amount : amount * 25.4 : metric ? amount / 25.4 : amount)} ${unit}`;
}

function DimensionExplorer({ product }: { product: Product }) {
  const [unit, setUnit] = useState<"original" | "mm" | "in">("original");
  useEffect(() => setUnit("original"), [product.id]);
  const hasLinearMeasurement = Boolean(product.length || product.diameter);
  if (!hasLinearMeasurement) return null;
  return <section className="px-dimensions"><div className="px-section-title"><p className="eyebrow">A CLOSER LOOK AT THE FIT</p><h2>In the details.<br/><span>In your units.</span></h2><p>Switch between the listed dimensions, millimeters and inches. Thread designations stay exactly as specified.</p><div className="px-unit-picker" aria-label="Dimension display units">{([['original','As listed'],['mm','Millimeters'],['in','Inches']] as const).map(([value,label]) => <button key={value} className={unit === value ? "active" : ""} aria-pressed={unit === value} onClick={() => setUnit(value)}>{label}</button>)}</div><p className="px-conversion-note">Only explicit inch or mm measurements are converted. Dimensions without units stay as listed. Converted values are rounded to four decimals, not tolerance limits.</p></div><figure className="px-dimension-visual"><div className="px-dimension-top"><span>LISTED LENGTH</span><strong>{product.length ? convertDimension(product.length, unit) : "Confirm with team"}</strong></div><div className="px-dimension-rule"><span/><i/><span/></div><div className="px-dimension-product">{product.image ? <PanZoomPhoto src={product.image} alt={product.name} className="pc-dimension-photo" loading="lazy"/> : <Wrench size={70} strokeWidth={.7}/>}</div><div className="px-dimension-bottom"><span>LISTED DIAMETER / THREAD</span><strong>{product.diameter ? convertDimension(product.diameter, unit) : "Confirm with team"}</strong></div><figcaption>Illustrative specification callouts. Not to scale; not an engineering drawing.</figcaption></figure></section>;
}

function QuantityGraph({ product, quantity, setQuantity }: { product: Product; quantity: number; setQuantity: (value: number) => void }) {
  const [metric, setMetric] = useState<"total" | "unit">("total");
  const [expandedExtent, setExpandedExtent] = useState(10);
  useEffect(() => { setExpandedExtent(10); setMetric("total"); }, [product.id]);
  useEffect(() => { setExpandedExtent((previous) => Math.max(previous, quantity)); }, [quantity]);
  const tierStarts = (product.pricingTiers || []).filter((tier) => tier.packQuantity === product.packQuantity).map((tier) => Number(tier.cartons.match(/^\s*(\d+)/)?.[1] || 1)).filter((value) => Number.isFinite(value) && value > 0);
  const extent = Math.min(9999, Math.max(10, expandedExtent, quantity, ...tierStarts.map((value) => Math.min(50, value * 2))));
  const graphQuantities = [...new Set([1, quantity, extent, ...tierStarts.flatMap((value) => [Math.max(1, value - 1), value]), ...Array.from({ length: 11 }, (_, index) => Math.max(1, Math.round(1 + index * (extent - 1) / 10)))])].filter((value) => value <= extent).sort((a, b) => a - b);
  const series = graphQuantities.map((q) => { const rate = getReferencePackPrice(product, q); return { q, value: rate === null ? null : metric === "unit" && product.packQuantity ? rate / product.packQuantity : rate * q }; });
  const available = series.filter((point): point is { q: number; value: number } => point.value !== null);
  const max = Math.max(...available.map((point) => point.value), .001) * 1.12;
  const x = (q: number) => 60 + (q - 1) / (extent - 1 || 1) * 480;
  const y = (value: number) => 174 - value / max * 132;
  const selectedRate = getReferencePackPrice(product, quantity);
  const selectedValue = selectedRate === null ? null : metric === "unit" && product.packQuantity ? selectedRate / product.packQuantity : selectedRate * quantity;
  const points = available.map((point) => `${x(point.q)},${y(point.value)}`).join(" ");
  const hasTiers = (product.pricingTiers || []).some((tier) => tier.packQuantity === product.packQuantity && getReferencePackPrice(product, Number(tier.cartons.match(/^\s*(\d+)/)?.[1] || 0)) === tier.price);

  return <section className="px-planner" aria-labelledby="quantity-planner-title"><div className="px-planner-heading"><div><p className="eyebrow">PLAN THE WHOLE BUILD</p><h2 id="quantity-planner-title">The right quantity.<br/><span>A clearer picture.</span></h2><p>See how your listed reference price changes as you plan your order.</p></div><div className="px-metric-switch" aria-label="Chart value"><button aria-pressed={metric === "total"} className={metric === "total" ? "active" : ""} onClick={() => setMetric("total")}>Order total</button>{product.packQuantity && <button aria-pressed={metric === "unit"} className={metric === "unit" ? "active" : ""} onClick={() => setMetric("unit")}>Per piece</button>}</div></div>
    <div className="px-planner-body"><div className="px-planner-stats"><span>{metric === "total" ? "REFERENCE SUBTOTAL" : "REFERENCE PRICE / PIECE"}</span><strong>{selectedValue === null ? "Let’s quote it" : metric === "unit" ? unitMoney(selectedValue) : money(selectedValue)}</strong><p>{quantity.toLocaleString()} {quantity === 1 ? "pack" : "packs"}{product.packQuantity ? ` · ${(quantity * product.packQuantity).toLocaleString()} pieces` : ""}</p><label htmlFor="px-quantity-slider">Adjust your quantity <span>{quantity} packs</span></label><input id="px-quantity-slider" type="range" min="1" max={extent} step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}/><div className="px-slider-ends"><span>1 pack</span><span>{extent.toLocaleString()} packs</span></div></div>
      <div className="px-chart">{available.length ? <svg viewBox="0 0 580 215" role="img" aria-label={`Reference ${metric === "total" ? "subtotal" : "price per piece"} across one to ${extent} packs. Selected ${quantity} packs: ${selectedValue === null ? "quote required" : unitMoney(selectedValue)}.`}>{[0, .5, 1].map((fraction) => <g key={fraction}><line x1="60" x2="540" y1={y(max * fraction)} y2={y(max * fraction)} stroke="#ffffff19" strokeDasharray="3 5"/><text x="50" y={y(max * fraction) + 4} textAnchor="end" fill="#929987" fontSize="9">{metric === "unit" ? unitMoney(max * fraction) : money(max * fraction)}</text></g>)}<polygon points={`60,174 ${points} ${x(available[available.length - 1].q)},174`} fill="#d6ee8a" opacity=".045"/><polyline points={points} fill="none" stroke="#d6ee8a" strokeWidth="2.5" strokeLinejoin="round"/>{available.map((point) => <g key={point.q}><circle cx={x(point.q)} cy={y(point.value)} r="3" fill="#d6ee8a"/><title>{point.q} packs: {metric === "unit" ? unitMoney(point.value) : money(point.value)}</title></g>)}{selectedValue !== null && <g><line x1={x(quantity)} x2={x(quantity)} y1={y(selectedValue)} y2="174" stroke="#d6ee8a" opacity=".3" strokeDasharray="3 4"/><circle cx={x(quantity)} cy={y(selectedValue)} r="7" fill="#d6ee8a22" stroke="#d6ee8a"/><circle cx={x(quantity)} cy={y(selectedValue)} r="3" fill="#d6ee8a"/></g>}{[1, Math.round(extent / 2), extent].map((q) => <text key={q} x={x(q)} y="197" textAnchor="middle" fill="#929987" fontSize="10">{q} {q === 1 ? "pack" : "packs"}</text>)}</svg> : <div className="px-chart-empty"><MessageCircle size={32} strokeWidth={1}/><p>Pricing for this part is available by quote.</p></div>}<p>{hasTiers ? "Uses listed carton-price tiers where quantity and pack size match." : "Illustrates the listed pack price; additional volume pricing is not confirmed."} Tax and shipping excluded. Lines connect sampled quantities; final pricing is confirmed by our team.</p></div>
    </div></section>;
}

function ProductEnrichment({ product, quantity, onBrowse, onOpen }: { product: Product; quantity: number; onBrowse: (category?: string) => void; onOpen?: (product: Product) => void }) {
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setRelated([]);
    const params = new URLSearchParams({ category: product.category, limit: "16", sort: "relevance" });
    apiFetch(`/api/catalog?${params}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Catalog unavailable");
      const result = await response.json() as { products?: Product[] };
      if (controller.signal.aborted) return;
      const score = (item: Product) => Number(item.subcategory === product.subcategory) * 3 + Number(item.material === product.material) + Number(item.diameter === product.diameter);
      setRelated((result.products || []).filter((item) => item.id !== product.id).sort((a, b) => score(b) - score(a)).slice(0, 4));
    }).catch(() => { if (!controller.signal.aborted) setRelated([]); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [product.id, product.category, product.subcategory, product.material, product.diameter]);
  const faqs = [
    { question: "How do I know this is the right fit?", answer: `Compare the diameter/thread${product.diameter ? ` (${product.diameter})` : ""}, length${product.length ? ` (${product.length})` : ""}, head, drive and material with your existing part or specification. A similar-looking fastener may have a different pitch or tolerance. Send the part number and your requirements if you need help.` },
    { question: "How many pieces am I ordering?", answer: product.packQuantity ? `Each listed pack contains ${product.packQuantity.toLocaleString()} pieces. Your current selection is ${quantity.toLocaleString()} ${quantity === 1 ? "pack" : "packs"}, totaling ${(quantity * product.packQuantity).toLocaleString()} pieces. Quantities in the request are packs, not individual pieces.` : "The pack quantity for this part needs confirmation. Tell us how many individual pieces you need when preparing your request." },
    { question: "Is the displayed price my final price?", answer: "Prices and quantity tiers are reference prices from the product listing. Our team confirms current pricing, availability, shipping and applicable tax before payment. Preparing a request does not charge you or place a paid order." },
    { question: "Can I identify a part from a photo?", answer: "Photo identification is coming next. For now, describe your part in the finder or share a photo with our team on WhatsApp. Confirm the dimensions, thread and material before ordering." },
    { question: "How will my order be shipped?", answer: "Shipping options include UPS, USPS and FedEx. The carrier, cost and delivery timing are confirmed with your quote based on the order and destination." },
    { question: "Can I request a different quantity or specification?", answer: "Yes. Include the quantity, material, dimensions and any drawing or part reference in your request. Our team can review what you need and confirm the available options. Smaller packs or alternative specifications are not guaranteed." },
  ];

  return <>
    <section className="px-faq"><div className="px-section-title"><p className="eyebrow">A FEW USEFUL ANSWERS</p><h2>Less guesswork.<br/><span>More getting it done.</span></h2><a href="tel:+18454999269" className="px-contact-link"><Phone size={17}/>Speak with our team<ArrowUpRight size={15}/></a></div><div className="px-faq-items">{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<Plus size={18}/></summary><p>{faq.answer}</p></details>)}</div></section>
    <section className="px-related"><div className="px-related-heading"><div><p className="eyebrow">KEEP EXPLORING</p><h2>Same category.<br/>Different possibilities.</h2></div><button onClick={() => onBrowse(product.category)}>Explore {product.category.toLowerCase()}<ArrowRight size={17}/></button></div><p className="px-related-note">Related listings to compare. These are not verified replacements or compatible accessories.</p><div className="px-related-grid">{loading ? Array.from({ length: 4 }, (_, index) => <div className="px-related-skeleton" key={index}/>) : related.map((item) => <button key={item.id} className="px-related-card" onClick={() => onOpen ? onOpen(item) : onBrowse(item.category)}><div><PanZoomPhoto src={item.image} alt={item.name} loading="lazy" className="pc-related-photo" compact/><ArrowUpRight size={18}/></div><span>PART {item.sku}</span><h3>{item.name.split(" / ")[0]}</h3><p>{[item.material, item.drive].filter(Boolean).join(" · ")}</p><strong>{item.price === null ? "Request pricing" : money(item.price)}<small>{item.packQuantity ? ` / ${item.packQuantity.toLocaleString()}-piece pack` : " / pack"}</small></strong></button>)}</div>{!loading && related.length === 0 && <button className="btn btn-outline" onClick={() => onBrowse(product.category)}>Browse all {product.category.toLowerCase()}<ArrowRight size={16}/></button>}</section>
    <section className="px-human"><div><p className="eyebrow">REAL PARTS. REAL PEOPLE.</p><h2>Let’s get your<br/>next build moving.</h2><p>Questions about a size, a specification, or a bigger order? Give us the details. We’ll work through them with you.</p></div><div><a href="tel:+18454999269"><Phone size={20} strokeWidth={1}/><span><small>GIVE US A CALL</small><strong>845-499-9269</strong></span><ArrowUpRight size={20}/></a><div className="px-human-address"><MapPin size={20} strokeWidth={1}/><span><small>FIND US</small><strong>245 Quaker Road</strong><p>Pomona, NY, USA</p></span></div></div></section></>;
}
