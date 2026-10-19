"use client";
import { sitePath } from '@/lib/pages-path';

import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, ImageIcon, Maximize2, Minus, Move3D, Pause, Play, Plus, RotateCcw, X, ZoomIn } from "lucide-react";
import type { Product } from "@/lib/types";
import { hardwareModelAvailability } from "@/lib/hardware-types";
import type { HardwareView } from "./hardware-viewer";
import "./product-gallery.css";
import PanZoomPhoto from "./pan-zoom-photo";

const HardwareViewer = lazy(() => import("./hardware-viewer"));
type GallerySelection = "material" | "dimensions" | "connection" | "photo";

class ViewerBoundary extends Component<{ children: ReactNode; onPhoto: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="pg-load"><Box size={30} strokeWidth={1}/><span>3D preview unavailable on this device.</span><button onClick={this.props.onPhoto}>View the product photo</button></div> : this.props.children; }
}

/** A single live model moves between the inline and expanded galleries. */
export default function ProductGallery({ product }: { product: Product }) {
  const { kind } = hardwareModelAvailability(product);
  const [selection, setSelection] = useState<GallerySelection>("material");
  const [view, setView] = useState<HardwareView>("perspective");
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [reset, setReset] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const isModel = selection !== "photo" && !!kind;
  const material = product.material || product.finish || product.subcategory || product.category;
  const dimension = [product.diameter, product.length].filter(Boolean).join(" × ");
  const connection = [product.head, product.drive && `${product.drive} drive`, !product.head && !product.drive ? product.specs["Type / Style"] : undefined].filter(Boolean).join(" · ");
  const tabs: { id: GallerySelection; label: string; view: HardwareView }[] = [
    { id: "material", label: "The material", view: "perspective" },
    ...(dimension ? [{ id: "dimensions" as const, label: "The dimensions", view: "side" as const }] : []),
    ...(connection ? [{ id: "connection" as const, label: "The connection", view: "top" as const }] : []),
  ];

  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
      if (event.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, canvas[tabindex='0'], [tabindex]:not([tabindex='-1'])");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); requestAnimationFrame(() => expandRef.current?.focus({ preventScroll: true })); };
  }, [expanded]);

  const select = (next: GallerySelection, angle: HardwareView = "perspective") => {
    setSelection(next);
    setView(angle);
    setAutoRotate(next === "material");
  };
  const controls = <div className="pg-toolbar">
    {<div className="pg-mode" role="group" aria-label="Explore the product">{tabs.map((tab) => <button key={tab.id} className={selection === tab.id ? "active" : ""} aria-pressed={selection === tab.id} onClick={() => select(tab.id, tab.view)}>{tab.label}</button>)}</div>}
    {expanded ? <button className="pg-icon-button" ref={closeRef} onClick={() => setExpanded(false)} aria-label="Close enlarged product visual"><X size={19}/></button> : <button className="pg-icon-button" ref={expandRef} onClick={() => setExpanded(true)} aria-label="Enlarge product visual"><Maximize2 size={16}/></button>}
  </div>;
  const display = <div className={`pg-display ${isModel ? "pg-model" : "pg-photo"}`}>
    {isModel ? <>
      <span className="pg-orbit" aria-hidden="true"/>
      <ViewerBoundary key={`${product.id}-${expanded}`} onPhoto={() => select("photo")}><Suspense fallback={<div className="pg-load"><Box size={30} strokeWidth={1}/><span>Taking shape…</span></div>}><HardwareViewer key={`${product.id}-${reset}-${expanded}`} product={product} kind={kind!} view={view} interactive autoRotate={autoRotate} finish={`${product.material || ""} ${product.finish || ""}`} className="pg-viewer"/></Suspense></ViewerBoundary>
    </> : failedImage || !product.image ? <div className="pg-load"><ImageIcon size={42} strokeWidth={.8}/><span>Product photo unavailable</span>{kind && <button onClick={() => select("material")}>Explore in 3D</button>}</div> : <div className="pg-image-container"><PanZoomPhoto src={product.image} alt={product.name} loading="eager" zoom={zoom} onZoomChange={setZoom} onError={() => setFailedImage(true)}/></div>}
    <div className="pg-display-controls">{!isModel ? <><span><ZoomIn size={14}/>{zoom === 1 ? "Drag or scroll to explore" : `${Math.round(zoom * 100)}% · drag to explore`}</span><div><button className="pg-icon-button" onClick={() => setZoom((value) => Math.max(1, value - .5))} disabled={zoom <= 1} aria-label="Zoom product photo out"><Minus size={15}/></button><button className="pg-icon-button" onClick={() => setZoom((value) => Math.min(3, value + .5))} disabled={zoom >= 3} aria-label="Zoom product photo in"><Plus size={15}/></button></div></> : <><span><Move3D size={15}/>Drag any direction to rotate</span><div><button className={`pg-icon-button pg-rotate ${autoRotate ? "active" : ""}`} onClick={() => setAutoRotate(!autoRotate)} aria-pressed={autoRotate} aria-label={autoRotate ? "Pause automatic rotation" : "Start automatic rotation"}>{autoRotate ? <Pause size={14}/> : <Play size={14}/>}</button><button className="pg-icon-button" onClick={() => { setView(tabs.find((tab) => tab.id === selection)?.view || "perspective"); setReset((value) => value + 1); }} aria-label="Reset 3D viewing angle"><RotateCcw size={15}/></button></div></>}</div>
  </div>;
  const detail = <div className="pg-detail" aria-live="polite">
    <span>{selection === "dimensions" ? "DIAMETER / THREAD · LENGTH" : selection === "connection" ? (product.head || product.drive ? "HEAD · DRIVE" : "CONNECTION STYLE") : selection === "photo" ? "FROM THE PRODUCT LISTING" : "MATERIAL · FINISH"}</span>
    <strong>{selection === "dimensions" ? dimension : selection === "connection" ? connection : selection === "photo" ? "The product reference." : material}</strong>
    {selection === "material" && product.material && product.finish && <p>{product.finish} finish</p>}
    {selection === "dimensions" && <p>Listed measurements. Confirm the thread, fit and tolerances in the specifications below.</p>}
  </div>;
  const media = <div className="pg-media-strip" role="group" aria-label="Product images and model">
    {kind && <button className={`pg-media-choice pg-model-choice ${isModel ? "active" : ""}`} aria-pressed={isModel} onClick={() => select("material")}><span className="pg-media-icon"><Box size={23} strokeWidth={1}/></span><span><strong>360° view</strong><small>Explore the part’s form</small></span></button>}
    {product.image && <button className={`pg-media-choice pg-photo-choice ${!isModel ? "active" : ""}`} aria-pressed={!isModel} onClick={() => select("photo")}><span className="pg-media-thumbnail"><img src={sitePath(product.image)} alt="" loading="lazy" width="52" height="52"/></span><span><strong>Product photo</strong><small>Original reference</small></span></button>}
  </div>;
  const note = <p className="pg-note">{isModel ? "3D visualization using available product dimensions. Confirm exact fit and finish with the specifications and reference photo." : (!kind ? "Product reference photo. Confirm size, material and finish in the specifications." : product.imageDisclaimer || "Reference photo. Confirm size, material and finish in the specifications.")}</p>;
  return <div className="pg-gallery">
    {!expanded && <>{controls}{display}{detail}{media}{note}</>}
    {expanded && <div className="pg-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpanded(false); }}><div className="pg-modal" role="dialog" aria-modal="true" aria-label={`Explore ${product.name}`} ref={dialogRef}>{controls}{display}{detail}{media}{note}</div></div>}
  </div>;
}
