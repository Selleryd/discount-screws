"use client";

import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, MoveUpRight, Pause, Play } from "lucide-react";
import { classifyHardware } from "@/lib/hardware-types";
import type { Product } from "@/lib/types";
import type { HardwareView } from "./hardware-viewer";
import PanZoomPhoto from "./pan-zoom-photo";
import "./product-cinematic.css";

const HardwareViewer = lazy(() => import("./hardware-viewer"));
const sectionLinks = [
  { id: "product-overview", label: "Overview" },
  { id: "product-details", label: "Details" },
  { id: "product-comparison", label: "Why us" },
] as const;

export function ProductSectionNav({ product, onQuote }: { product: Product; onQuote: () => void }) {
  const [active, setActive] = useState<string>("product-overview");
  useEffect(() => {
    setActive("product-overview");
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const seen = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (seen[0]) setActive(seen[0].target.id);
    }, { rootMargin: "-145px 0px -55% 0px", threshold: [0, .1, .5] });
    for (const { id } of sectionLinks) { const element = document.getElementById(id); if (element) observer.observe(element); }
    return () => observer.disconnect();
  }, [product.id]);
  const jump = (id: string) => {
    setActive(id);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  };
  return <nav className="pc-local-nav" aria-label="On this product page">
    <div className="pc-content pc-local-nav-inner">
    <span>{product.subcategory || product.category}<small>{product.sku}</small></span>
    <div className="pc-local-nav-links">{sectionLinks.map((link) => <button key={link.id} className={active === link.id ? "active" : ""} aria-current={active === link.id ? "location" : undefined} onClick={() => jump(link.id)}>{link.label}</button>)}</div>
    <button className="pc-nav-quote" onClick={onQuote}>Get a quote<ArrowRight size={13}/></button>
    </div>
  </nav>;
}

class StoryViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="pc-viewer-message">Explore the product photo and specifications above.</p> : this.props.children; }
}

interface Detail {
  id: string;
  label: string;
  heading: string;
  value: string;
  copy: string;
  view: HardwareView;
}

export default function ProductCinematic({ product, onDetails }: { product: Product; onDetails: () => void }) {
  const kind = classifyHardware(product);
  const root = useRef<HTMLElement>(null);
  const [inRange, setInRange] = useState(false);
  const [active, setActive] = useState(0);
  const [spinning, setSpinning] = useState(true);
  const details: Detail[] = [];
  if (product.diameter || product.length) details.push({
    id: "dimensions", label: "The dimensions", heading: "The right fit.\nStarts here.",
    value: [product.diameter, product.length].filter(Boolean).join(" × "),
    copy: `${product.diameter ? `Diameter / thread: ${product.diameter}. ` : ""}${product.length ? `Length: ${product.length}. ` : ""}The measurements that turn a possibility into your next part.`, view: "side",
  });
  if (product.drive || product.head) details.push({
    id: "connection", label: "The connection", heading: "Every angle.\nConsidered.",
    value: product.drive ? `${product.drive} drive` : product.head!,
    copy: product.head && product.drive ? `${product.head} head. ${product.drive} drive. Match the style to your drawing, tool and installation.` : `${product.head || product.drive}. Take a closer look at the details before making it part of your build.`, view: "top",
  });
  if (product.material || product.finish) details.push({
    id: "material", label: "The material", heading: "The substance.\nBehind the shape.",
    value: product.material || product.finish!,
    copy: product.material && product.finish ? `${product.material} with ${product.finish} finish. One more detail to match to the job in front of you.` : `${product.material || product.finish}. Compare the listed specification with the requirements of your project.`, view: "perspective",
  });
  if (!details.length) details.push({ id: "part", label: "The part", heading: "Meet your\nnext detail.", value: product.subcategory || product.category, copy: `Part ${product.sku}. Explore the listed specifications and let’s put your order together.`, view: "perspective" });
  const current = details[Math.min(active, details.length - 1)];

  useEffect(() => { setActive(0); setSpinning(true); setInRange(false); }, [product.id]);
  useEffect(() => {
    if (!root.current) return;
    if (typeof IntersectionObserver === "undefined") { setInRange(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInRange(true); observer.disconnect(); } }, { rootMargin: "300px 0px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [product.id]);

  return <section ref={root} className={`pc-story ${kind ? "pc-story-dark" : "pc-story-light"}`} aria-labelledby="pc-story-title">
    <div className="pc-content pc-story-inner">
      <div className="pc-story-heading pc-reveal"><p>{product.subcategory || product.category}</p><h2 id="pc-story-title">Small part.<br/><span>Big possibilities.</span></h2></div>
      <div className="pc-story-stage">
        <div className="pc-story-visual">
          <span className="pc-stage-orbit" aria-hidden="true"/>
          {kind ? inRange ? <StoryViewerBoundary key={product.id}><Suspense fallback={<p className="pc-viewer-message">Taking shape…</p>}><HardwareViewer kind={kind} view={current.view} autoRotate={spinning} interactive finish={`${product.material || ""} ${product.finish || ""}`} className="pc-story-viewer"/></Suspense></StoryViewerBoundary> : <div className="pc-viewer-silhouette" aria-hidden="true"/> : <PanZoomPhoto src={product.image} alt={product.name} className="pc-story-photo" loading="lazy"/>}
          {kind && <button className="pc-spin-button" aria-pressed={spinning} onClick={() => setSpinning((value) => !value)} aria-label={spinning ? "Pause product rotation" : "Start product rotation"}>{spinning ? <Pause size={13}/> : <Play size={13}/>}</button>}
        </div>
        <div className="pc-story-content">
          <div className="pc-story-tabs" role="group" aria-label="Explore product details">{details.map((detail, index) => <button key={detail.id} aria-pressed={index === active} className={index === active ? "active" : ""} onClick={() => { setActive(index); setSpinning(false); }}>{detail.label}</button>)}</div>
          <div className="pc-story-detail" key={`${product.id}-${current.id}`} aria-live="polite"><h3>{current.heading.split("\n").map((line, index) => <span key={line}>{line}{index === 0 && <br/>}</span>)}</h3><strong>{current.value}</strong><p>{current.copy}</p></div>
          <button className="pc-details-link" onClick={onDetails}>Explore the specifications<MoveUpRight size={16}/></button>
        </div>
      </div>
      <div className="pc-story-bottom"><span>{kind ? "Drag to turn it around." : "Drag or zoom for a closer look."}</span><p>{kind ? "3D style preview. Check the listed specifications for this part’s exact dimensions and finish." : product.imageDisclaimer || "Reference photo. Confirm the listed dimensions, material and finish."}</p></div>
    </div>
  </section>;
}
