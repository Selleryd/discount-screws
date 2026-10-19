"use client";

import { useEffect, useRef, useState } from "react";
import "./add-to-request-button.css";

type AddToRequestButtonProps = {
  onAdd: () => void;
  productName: string;
  className?: string;
  /** Omit for the circular product-card button. */
  label?: string;
};

/** Add immediately; the tiny hammer sequence is feedback, never a second action. */
export default function AddToRequestButton({ onAdd, productName, className = "", label }: AddToRequestButtonProps) {
  const [adding, setAdding] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const add = () => {
    if (locked.current) return;
    locked.current = true;
    try { onAdd(); }
    catch (error) { locked.current = false; throw error; }
    setAdding(true);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 650 : 1100;
    timer.current = setTimeout(() => { locked.current = false; setAdding(false); }, duration);
  };

  return <button
    type="button"
    className={`add-request-button ${label ? "add-request-button--label" : "add-request-button--round"} ${adding ? "is-adding" : ""} ${className}`}
    onClick={add}
    aria-label={adding ? `${productName} added to order request` : `Add ${productName} to order request`}
    aria-disabled={adding}
    title={adding ? "Added to your order" : "Add to order request"}
  >
    {label && <span className="add-request-label">{adding ? "Added to request" : label}</span>}
    <svg className="add-request-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <g className="add-request-plus" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M24 16v16M16 24h16"/></g>
      <g className="add-request-build" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <path className="add-request-board" d="M13 37h25"/>
        <g className="add-request-nail"><path d="M24 25v12M20 25h8"/></g>
        <g className="add-request-hammer"><path d="m24 22-12 12" strokeWidth="3.4"/><path d="M17 16h14v8h-4v-2h-6v2h-4z" fill="currentColor" strokeWidth="1"/></g>
        <g className="add-request-sparks"><path d="m15 25-3-2m21 2 3-2M24 19v-3"/></g>
      </g>
      <path className="add-request-check" d="m16 24 6 6 11-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>;
}
