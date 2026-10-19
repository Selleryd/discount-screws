"use client";
import { sitePath } from '@/lib/pages-path';

import { useId } from "react";
import { ArrowRight, ArrowUpRight, Check, CircleDollarSign, MessageCircle, Search } from "lucide-react";
import "./value-comparison.css";

const advantages = [
  { title: "Find the fit. Skip the guesswork.", copy: "Describe your part, narrow the specifications, and see the details up close." },
  { title: "Know what every piece costs.", copy: "Pack sizes, per-piece reference prices, and listed quantity breaks in one place." },
  { title: "Your entire project. One organized list.", copy: "Choose your parts and quantities online. Send one clear request in WhatsApp." },
  { title: "A quote built around your build.", copy: "Get your quantities, pricing, and availability confirmed before you commit." },
  { title: "Real help, one conversation away.", copy: "Talk through your request directly on WhatsApp or call our team." },
];

const friction = [
  { title: "Guess the name. Search again.", copy: "Starting over every time the specifications do not match." },
  { title: "Do the pack math yourself.", copy: "Switching between quantities, unit prices, and notes." },
  { title: "Keep track of scattered parts.", copy: "Screenshots, open tabs, and a list that keeps changing." },
  { title: "Piece the project together.", copy: "Sending missing details back and forth." },
  { title: "Figure it all out alone.", copy: "More uncertainty between finding a part and buying it." },
];

const whatsappQuote = "https://wa.me/18454999269?text=" + encodeURIComponent("Hi DiscountScrews, I'd like a quote for my project.");

export function ValueComparison({ onFind, onQuote }: { onFind?: () => void; onQuote?: () => void }) {
  const id = useId();
  return <section className="ds-value" aria-labelledby={`${id}-title`}>
    <header className="dv-heading">
      <div><p className="dv-kicker">THE DISCOUNTSCREWS ADVANTAGE</p><h2 id={`${id}-title`}>Less friction.<br/><em>More building.</em></h2></div>
      <p>The right hardware. Clearer costs. A real person to bring it all together. This is how buying parts should feel.</p>
    </header>

    <div className="dv-impact" aria-label="A simpler path to your parts">
      <div><Search size={21} strokeWidth={1.4}/><span>Find your fit.</span></div>
      <div><CircleDollarSign size={21} strokeWidth={1.4}/><span>Know your numbers.</span></div>
      <div><MessageCircle size={21} strokeWidth={1.4}/><span>Get your quote.</span></div>
    </div>

    <div className="dv-comparison">
      <article className="dv-way dv-our-way" aria-labelledby={`${id}-ours`}>
        <header className="dv-way-heading"><div><p>THE BETTER WAY TO BUY</p><h3 id={`${id}-ours`}>discount<strong>screws</strong></h3></div><span className="dv-brand-arrow" aria-hidden="true"><ArrowUpRight size={23}/></span></header>
        <ul>{advantages.map((item) => <li key={item.title}><span className="dv-check" aria-hidden="true"><Check size={17} strokeWidth={2.4}/></span><div><h4>{item.title}</h4><p>{item.copy}</p></div></li>)}</ul>
        <div className="dv-action">
          {onQuote ? <button className="dv-quote" onClick={onQuote}>Build my quote<ArrowRight size={18}/></button> : <a className="dv-quote" href={whatsappQuote} target="_blank" rel="noopener noreferrer">Request my quote<ArrowRight size={18}/></a>}
          <p>No payment required to request a quote.</p>
        </div>
      </article>
      <article className="dv-way dv-old-way" aria-labelledby={`${id}-old`}>
        <header className="dv-way-heading"><div><p>LEAVE THE BUSYWORK BEHIND</p><h3 id={`${id}-old`}>The old way.</h3></div></header>
        <ul>{friction.map((item, index) => <li key={item.title}><span className="dv-friction-index" aria-hidden="true">0{index + 1}</span><div><h4>{item.title}</h4><p>{item.copy}</p></div></li>)}</ul>
        <div className="dv-old-close"><span>Fewer tabs.</span><span>Fewer loose ends.</span><strong>A better next build.</strong></div>
      </article>
    </div>

    <footer className="dv-bottom"><p>Reference prices and availability are confirmed in your quote. “The old way” describes a manual buying process.</p>{onFind ? <button onClick={onFind}>Find my part<ArrowRight size={16}/></button> : <a href={sitePath("/catalog")}>Find my part<ArrowRight size={16}/></a>}</footer>
  </section>;
}
export default ValueComparison;
