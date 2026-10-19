"use client";
import { sitePath } from '@/lib/pages-path';

import { useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Check, ClipboardList, Copy, Gauge, Grid2X2, Layers3, Ruler, Search } from "lucide-react";
import "./tools-hub.css";

export type ToolsHubProps = { onNavigate: (page: string) => void; onBrowse: () => void; onFind?: () => void };

function ToolLink({ page, onNavigate, className, children }: { page: string; onNavigate: (page: string) => void; className?: string; children: ReactNode }) {
  return <a href={sitePath(`/${page}`)} className={className} onClick={event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(page); }
  }}>{children}</a>;
}

const toolCards = [
  { page: "measuring", icon: Ruler, number: "01", title: "Measure & convert.", copy: "Inches, millimeters, thread spacing. Get the dimensions right before choosing a part.", action: "Open the measuring bench", detail: "INCH ↔ MM · TPI ↔ PITCH" },
  { page: "materials", icon: Layers3, number: "02", title: "Know your material.", copy: "Understand stainless grades, steel, and finishes. Compare what matters for the job.", action: "Explore materials", detail: "MATERIAL · FINISH · GRADE" },
  { page: "guide", icon: BookOpen, number: "03", title: "Read the details.", copy: "Identify the head, drive, diameter, and thread. Turn an unfamiliar fastener into a useful spec.", action: "Open the fastener guide", detail: "HEAD · DRIVE · THREAD" },
  { page: "applications", icon: Grid2X2, number: "04", title: "Start with the job.", copy: "Explore the details to consider for woodworking, fabrication, electronics, and repairs.", action: "Explore applications", detail: "WORKSHOP · ASSEMBLY · REPAIR" },
];

function cleanNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatNumber(value: number | null) {
  return value !== null && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—";
}

function QuickBench({ onNavigate }: Pick<ToolsHubProps, "onNavigate">) {
  const [measurement, setMeasurement] = useState("0.25");
  const [unit, setUnit] = useState<"in" | "mm">("in");
  const [thread, setThread] = useState("20");
  const [threadUnit, setThreadUnit] = useState<"tpi" | "pitch">("tpi");
  const [copied, setCopied] = useState("");
  const rawMeasurement = cleanNumber(measurement);
  const converted = rawMeasurement === null ? null : unit === "in" ? rawMeasurement * 25.4 : rawMeasurement / 25.4;
  const rawThread = cleanNumber(thread);
  const threadResult = rawThread !== null && rawThread > 0 ? 25.4 / rawThread : null;
  const result = formatNumber(converted), spacing = formatNumber(threadResult);
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); }
    catch { setCopied("Select the result and copy it to keep the measurement."); }
  };

  return <section className="tools-quick-bench" aria-labelledby="quick-bench-title"><div className="tools-shell">
    <div className="tools-bench-heading"><div><span className="eyebrow">THE QUICK BENCH</span><h2 id="quick-bench-title">Make the numbers<br /><span>work for you.</span></h2></div><p>Two useful conversions. Right here.<br />For the complete measuring walkthrough, <ToolLink page="measuring" onNavigate={onNavigate}>open the guide <ArrowUpRight size={13} /></ToolLink></p></div>
    <div className="tools-calculators">
      <article className="tools-calculator"><div className="tools-calculator-heading"><Ruler size={22} strokeWidth={1.35} /><h3>Inches & millimeters</h3><span>01</span></div><div className="tools-convert-inputs"><label>Measurement<input type="number" min="0" step="any" inputMode="decimal" value={measurement} onChange={e => { setMeasurement(e.target.value); setCopied(""); }} /></label><label>From<select value={unit} onChange={e => { setUnit(e.target.value as "in" | "mm"); setCopied(""); }}><option value="in">Inches</option><option value="mm">Millimeters</option></select></label></div><div className="tools-convert-output"><div aria-live="polite" aria-atomic="true"><output>{result}</output><span>{unit === "in" ? "millimeters" : "inches"}</span></div><button aria-label="Copy measurement conversion" title="Copy result" disabled={result === "—"} onClick={() => copy(`${measurement} ${unit === "in" ? "in" : "mm"} = ${result} ${unit === "in" ? "mm" : "in"}`, "measurement")}>{copied === "measurement" ? <Check size={17} /> : <Copy size={17} />}</button></div><div className="tools-presets" aria-label="Common inch measurements"><span>QUICK SIZES</span>{[["0.125", "⅛″"], ["0.25", "¼″"], ["0.5", "½″"], ["1", "1″"]].map(([value, label]) => <button key={value} onClick={() => { setUnit("in"); setMeasurement(value); setCopied(""); }}>{label}</button>)}</div><p className="tools-calculator-note">1 inch = 25.4 mm exactly. Results are rounded to six decimal places.</p></article>
      <article className="tools-calculator"><div className="tools-calculator-heading"><Gauge size={22} strokeWidth={1.35} /><h3>Thread spacing</h3><span>02</span></div><div className="tools-convert-inputs"><label>{threadUnit === "tpi" ? "Threads per inch" : "Pitch in millimeters"}<input type="number" min="0.000001" step="any" inputMode="decimal" value={thread} onChange={e => { setThread(e.target.value); setCopied(""); }} /></label><label>From<select value={threadUnit} onChange={e => { setThreadUnit(e.target.value as "tpi" | "pitch"); setCopied(""); }}><option value="tpi">Threads per inch</option><option value="pitch">Metric pitch (mm)</option></select></label></div><div className="tools-convert-output"><div aria-live="polite" aria-atomic="true"><output>{spacing}</output><span>{threadUnit === "tpi" ? "mm between threads" : "threads per inch"}</span></div><button aria-label="Copy thread spacing conversion" title="Copy result" disabled={spacing === "—"} onClick={() => copy(`${thread} ${threadUnit === "tpi" ? "TPI" : "mm pitch"} = ${spacing} ${threadUnit === "tpi" ? "mm pitch" : "TPI"}`, "thread")}>{copied === "thread" ? <Check size={17} /> : <Copy size={17} />}</button></div><div className="tools-spacing-formula"><span>THE RELATIONSHIP</span><strong>25.4 ÷ TPI = pitch in mm</strong></div><p className="tools-calculator-note">Converted spacing is for comparison. Diameter and thread profile must also match.</p></article>
    </div>
    <p className="tools-bench-footnote">A similar measurement is not an interchangeable thread. Confirm the complete fastener specification.</p>
    <span className="tools-sr-only" role="status">{copied === "measurement" ? "Measurement copied." : copied === "thread" ? "Thread spacing copied." : copied}</span>
  </div></section>;
}

export function ToolsSpotlight({ onNavigate }: Pick<ToolsHubProps, "onNavigate">) {
  return <section className="tools-spotlight" aria-labelledby="tools-spotlight-title"><div className="tools-shell"><div className="tools-spotlight-heading"><div><p className="eyebrow">A BETTER FIT STARTS WITH A LITTLE KNOW-HOW</p><h2 id="tools-spotlight-title">Small tools.<br /><span>Big difference.</span></h2></div><div><p>Measure it. Understand it. Get it right.<br />Practical tools for the details that matter.</p><ToolLink page="tools" onNavigate={onNavigate} className="tools-text-action">Explore all tools <ArrowUpRight size={18} /></ToolLink></div></div><div className="tools-spotlight-grid">{toolCards.slice(0, 3).map(tool => <ToolLink key={tool.page} className="tools-spotlight-card" page={tool.page} onNavigate={onNavigate}><span className="tools-spotlight-card-top"><tool.icon size={28} strokeWidth={1.2} /><span>{tool.number}</span></span><h3>{tool.title}</h3><p>{tool.copy}</p><span className="tools-spotlight-action">{tool.action}<ArrowUpRight size={18} /></span></ToolLink>)}</div></div></section>;
}

export default function ToolsHub({ onNavigate, onBrowse, onFind }: ToolsHubProps) {
  return <div className="tools-hub"><section className="tools-hub-intro tools-shell"><div className="tools-hub-intro-copy"><span className="eyebrow">THE DISCOUNT SCREWS TOOLKIT</span><h1>A little know-how.<br /><span>A better fit.</span></h1><p>Measure with confidence. Make sense of materials. Find the details that turn a close match into the right part.</p><div className="tools-intro-actions"><a className="btn btn-dark" href="#quick-bench-title">Try the quick tools <ArrowRight size={17} /></a><button className="tools-text-action" onClick={onFind || (() => onNavigate("home"))}>Find a fastener <Search size={17} /></button></div></div><div className="tools-intro-index" aria-label="Available tools">{toolCards.map(tool => <ToolLink key={tool.page} page={tool.page} onNavigate={onNavigate}><span>{tool.number}</span><strong>{tool.page === "measuring" ? "Measure & convert" : tool.page === "materials" ? "Materials & grades" : tool.page === "guide" ? "Fastener guide" : "Applications"}</strong><ArrowUpRight size={16} /></ToolLink>)}</div></section>
    <QuickBench onNavigate={onNavigate} />
    <section className="tools-reference tools-shell" aria-labelledby="tools-reference-title"><div className="tools-reference-heading"><span className="eyebrow">GO A LITTLE DEEPER</span><h2 id="tools-reference-title">Know what<br /><span>you’re looking for.</span></h2><p>Each guide helps you confirm another piece of the specification.</p></div><div className="tools-reference-grid">{toolCards.map(tool => <ToolLink className="tools-reference-card" key={tool.page} page={tool.page} onNavigate={onNavigate}><div className="tools-reference-card-top"><tool.icon size={29} strokeWidth={1.2} /><span>{tool.detail}</span></div><h3>{tool.title}</h3><p>{tool.copy}</p><span className="tools-spotlight-action">{tool.action}<ArrowUpRight size={18} /></span></ToolLink>)}</div></section>
    <section className="tools-project"><div className="tools-shell"><div className="tools-project-copy"><ClipboardList size={32} strokeWidth={1.2} /><span className="eyebrow">WHEN YOUR LIST GETS LONGER</span><h2>A whole project.<br /><span>One clear request.</span></h2><p>Put part numbers, piece counts, and delivery details into a clean bulk quote request. Review it, then send it to our team in WhatsApp.</p></div><div className="tools-project-actions"><ToolLink className="btn btn-dark" page="bulk-orders" onNavigate={onNavigate}>Build your parts list <ArrowRight size={17} /></ToolLink><button className="tools-text-action" onClick={onBrowse}>Ready to browse? <ArrowUpRight size={17} /></button></div></div></section>
  </div>;
}
