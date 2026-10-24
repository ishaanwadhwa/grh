"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useWide } from "../booking";
import { owners, restaurant } from "../content";

// React Bits Lanyard (three.js): Sahar's card on a strap you can pull, throw and tap to flip.
// Its canvas covers the whole first screen, so the card can swing anywhere without being cut off.
type LanyardProps = {
  frontImage?: string; backImage?: string; cardColor?: string; strapColor?: string; anchor?: "left" | "center" | "right";
  metal?: "silver" | "gold" | "graphite"; size?: number; strapLength?: number; breeze?: number;
};
const Lanyard = dynamic(
  () => import("../lanyard") as unknown as Promise<{ default: React.ComponentType<LanyardProps> }>,
  { ssr: false },
);

export default function OwnersPage() {
  const wide = useWide();
  return (
    <main className="owner">
      <section className="owner-hero" aria-labelledby="owner-title">
        <div className="owner-lanyard">
          <Lanyard
            frontImage={owners.card.front}
            backImage={owners.card.back}
            cardColor="#f7f3ec"
            strapColor="#a92b2c"
            metal="gold"
            anchor={wide ? "right" : "center"}
            size={wide ? 0.5 : 0.62}
            strapLength={0.36}
            breeze={0.35}
          />
        </div>
        <div className="owner-intro">
          <Link href="/experiment" className="back-link">{restaurant.name}</Link>
          <h1 id="owner-title" className="display rise">A father and a daughter</h1>
          <p className="lede rise" style={{ "--d": "0.1s" } as React.CSSProperties}>{owners.lede}</p>
          <p className="hint rise" style={{ "--d": "0.2s" } as React.CSSProperties}>Pull the card. Tap it to flip.</p>
        </div>
      </section>

      {/* One each: a line leads for him (there's no photo of him yet), her photo leads for her */}
      <div className="owner-people">
        {owners.people.map((person) => (
          <article key={person.name} className="person">
            {person.photo ? (
              <figure className="ph"><Image src={person.photo} alt={person.name} fill sizes="(min-width: 1024px) 40vw, 90vw" /></figure>
            ) : (
              <p className="display lead">{person.lead}</p>
            )}
            <div className="words">
              <p className="role">{person.role}</p>
              <h2 className="display">{person.name}</h2>
              <div className="bio">{person.bio.map((line) => <p key={line}>{line}</p>)}</div>
              {person.quote && <blockquote className="display">&ldquo;{person.quote}&rdquo;</blockquote>}
            </div>
          </article>
        ))}
      </div>

      <section className="owner-end">
        <p className="display">Come say hello.</p>
        <Link className="cta" href="/experiment?book=1">Book a table</Link>
      </section>
    </main>
  );
}
