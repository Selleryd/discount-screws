"use client";
import { sitePath } from '@/lib/pages-path';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactEventHandler } from "react";
import "./pan-zoom-photo.css";
import "./photo-surface.css";

export interface PanZoomPhotoProps {
  src: string;
  alt: string;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onError?: ReactEventHandler<HTMLImageElement>;
  loading?: "lazy" | "eager";
  className?: string;
  /** Removes its own focus target so this can sit inside an existing product link or button. */
  compact?: boolean;
  autoZoomOnDrag?: boolean;
}

type Point = { x: number; y: number };
type Drag = { id: number; startX: number; startY: number; x: number; y: number; active: boolean; type: string };
type PendingZoom = { from: number; left: number; top: number; x: number; y: number; panX: number; panY: number };
const clampZoom = (zoom: number) => Math.min(3, Math.max(1, Number.isFinite(zoom) ? zoom : 1));

/** A real source photograph, with native scrolling plus pointer/keyboard panning. No simulated angles. */
export function PanZoomPhoto({ src, alt, zoom, onZoomChange, onError, loading = "lazy", className = "", compact = false, autoZoomOnDrag = true }: PanZoomPhotoProps) {
  const [localZoom, setLocalZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const value = clampZoom(zoom ?? localZoom);
  const viewport = useRef<HTMLDivElement>(null);
  const renderedZoom = useRef(value);
  const requestedZoom = useRef(value);
  const pendingZoom = useRef<PendingZoom | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetKey = useRef(src);

  const changeZoom = (nextValue: number, anchor?: Point) => {
    const next = clampZoom(nextValue);
    // A clamped/no-op request will not run the [value] layout effect. Never
    // leave pending pan offsets waiting for a render that cannot happen.
    if (next === renderedZoom.current) {
      const changedRequest = requestedZoom.current !== next;
      pendingZoom.current = null;
      requestedZoom.current = next;
      if (changedRequest) {
        if (zoom === undefined) setLocalZoom(next);
        onZoomChange?.(next);
      }
      return;
    }
    const node = viewport.current;
    if (node) {
      pendingZoom.current = {
        from: renderedZoom.current,
        left: node.scrollLeft,
        top: node.scrollTop,
        x: anchor?.x ?? node.clientWidth / 2,
        y: anchor?.y ?? node.clientHeight / 2,
        panX: 0,
        panY: 0,
      };
    }
    requestedZoom.current = next;
    if (zoom === undefined) setLocalZoom(next);
    onZoomChange?.(next);
  };

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const pending = pendingZoom.current;
    const previous = renderedZoom.current;
    if (value === 1) { node.scrollLeft = 0; node.scrollTop = 0; }
    else if (pending) {
      node.scrollLeft = (pending.left + pending.x) * value / pending.from - pending.x + pending.panX;
      node.scrollTop = (pending.top + pending.y) * value / pending.from - pending.y + pending.panY;
    } else if (previous !== value) {
      node.scrollLeft = (node.scrollLeft + node.clientWidth / 2) * value / previous - node.clientWidth / 2;
      node.scrollTop = (node.scrollTop + node.clientHeight / 2) * value / previous - node.clientHeight / 2;
    }
    renderedZoom.current = value;
    requestedZoom.current = value;
    pendingZoom.current = null;
  }, [value]);

  useEffect(() => {
    if (resetKey.current === src) return;
    resetKey.current = src;
    setLocalZoom(1);
    onZoomChange?.(1);
    setDragging(false);
    drag.current = null;
    pointers.current.clear();
    pinch.current = null;
    pendingZoom.current = null;
    const node = viewport.current;
    if (node) { node.scrollTop = 0; node.scrollLeft = 0; }
  }, [src, onZoomChange]);
  useEffect(() => () => { if (suppressTimer.current) clearTimeout(suppressTimer.current); }, []);

  const localPoint = (point: Point) => {
    const bounds = viewport.current?.getBoundingClientRect();
    return { x: point.x - (bounds?.left ?? 0), y: point.y - (bounds?.top ?? 0) };
  };
  const panBy = (x: number, y: number) => {
    if (pendingZoom.current) { pendingZoom.current.panX += x; pendingZoom.current.panY += y; }
    else if (viewport.current) { viewport.current.scrollLeft += x; viewport.current.scrollTop += y; }
  };
  const markDragged = () => {
    suppressClick.current = true;
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (suppressTimer.current) clearTimeout(suppressTimer.current);
    suppressClick.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: requestedZoom.current };
      drag.current = null;
      markDragged();
    } else drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, type: event.pointerType };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size > 1 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      changeZoom(pinch.current.zoom * distance / pinch.current.distance, localPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
      setDragging(true);
      markDragged();
      return;
    }
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const totalX = event.clientX - current.startX;
    const totalY = event.clientY - current.startY;
    if (!current.active) {
      if (Math.hypot(totalX, totalY) < 7) return;
      // At 1×, vertical touch movement still belongs to the page.
      if (requestedZoom.current === 1 && current.type === "touch" && Math.abs(totalY) > Math.abs(totalX) * 1.15) return;
      if (requestedZoom.current === 1) {
        if (!autoZoomOnDrag) return;
        changeZoom(2, localPoint({ x: current.startX, y: current.startY }));
      }
      current.active = true;
      setDragging(true);
      markDragged();
    }
    panBy(current.x - event.clientX, current.y - event.clientY);
    current.x = event.clientX;
    current.y = event.clientY;
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pinch.current = null;
    if (pointers.current.size === 1) {
      const [id, point] = Array.from(pointers.current.entries())[0];
      drag.current = { id, startX: point.x, startY: point.y, x: point.x, y: point.y, active: true, type: "touch" };
    } else {
      drag.current = null;
      setDragging(false);
      if (suppressClick.current) suppressTimer.current = setTimeout(() => { suppressClick.current = false; }, 350);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (compact) return;
    const movement: Record<string, [number, number]> = { ArrowLeft: [-56, 0], ArrowRight: [56, 0], ArrowUp: [0, -56], ArrowDown: [0, 56] };
    if (movement[event.key]) {
      event.preventDefault();
      if (requestedZoom.current === 1 && autoZoomOnDrag) changeZoom(2);
      panBy(...movement[event.key]);
    } else if (["+", "=", "-", "Home", "0"].includes(event.key)) {
      event.preventDefault();
      changeZoom(event.key === "Home" || event.key === "0" ? 1 : requestedZoom.current + (event.key === "-" ? -.5 : .5));
    }
  };

  return <div ref={viewport} className={`pan-zoom-photo ${value > 1 ? "is-zoomed" : ""} ${dragging ? "is-dragging" : ""} ${className}`} style={{ touchAction: value > 1 ? "none" : "pan-y" }} role={compact ? undefined : "region"} aria-label={compact ? undefined : `${alt}. Drag or scroll to explore. Arrow keys pan, plus and minus zoom, Home resets.`} tabIndex={compact ? undefined : 0} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={onPointerEnd} onKeyDown={onKeyDown} onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); changeZoom(value > 1 ? 1 : 2, localPoint({ x: event.clientX, y: event.clientY })); }}>
    <div className="pan-zoom-photo-content" style={{ width: `${value * 100}%`, height: `${value * 100}%` }}><img src={sitePath(src)} alt={alt} loading={loading} decoding="async" draggable={false} onError={onError}/></div>
  </div>;
}
export default PanZoomPhoto;
