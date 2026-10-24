"use client";

import Link from "next/link";
import SpecularButtonJs from "../specular-button";

// Options for the main button with React Bits' SpecularButton light. Move your cursor near them.
type SpecularProps = {
  children?: React.ReactNode; className?: string; radius?: number; tint?: string; tintOpacity?: number; blur?: number;
  textColor?: string; lineColor?: string; baseColor?: string; intensity?: number; idleIntensity?: number;
  shineSize?: number; shineFade?: number; thickness?: number; glow?: number; followMouse?: boolean;
  proximity?: number; autoAnimate?: boolean; speed?: number;
};
const SpecularButton = SpecularButtonJs as unknown as React.ComponentType<SpecularProps>;

const candle = { className: "cta", radius: 999, tint: "#ffffff", tintOpacity: 0, lineColor: "#ffe4c8", baseColor: "#7a1d17", glow: 0.8 };

const options: { id: string; name: string; note: string; label: string; photo?: boolean; props: SpecularProps }[] = [
  { id: "S1", name: "Candle edge", label: "Book a table", note: "A warm light sits on the edge and slides toward your cursor as it comes near.", props: { ...candle, idleIntensity: 0.3 } },
  { id: "S2", name: "Slow flame", label: "Book a table", note: "The light drifts round the edge on its own, like a candle. The one that also moves on phones.", props: { ...candle, autoAnimate: true, speed: 0.22 } },
  { id: "S3", name: "Only when near", label: "Book a table", note: "Plain until your cursor approaches, then the edge catches the light. The quietest.", props: { ...candle, idleIntensity: 0, proximity: 180 } },
  { id: "S4", name: "Ink and light", label: "Book a table", note: "The petrol ink pill with a cool white edge light. Calmer than red.", props: { ...candle, className: "cta ink", lineColor: "#ffffff", baseColor: "#1d3a46", idleIntensity: 0.3 } },
  { id: "S5", name: "Quiet outline", label: "Menu", note: "For the secondary pill: an ink light runs along a hairline edge.", props: { className: "ghost", radius: 999, tint: "#ffffff", tintOpacity: 0, textColor: "#22404d", lineColor: "#2d4a57", baseColor: "#cfc8bc", glow: 0.35, thickness: 1, idleIntensity: 0.25 } },
  { id: "S6", name: "Glass on the photo", label: "Book a table", photo: true, note: "Clear glass over the candlelit photo; the light follows you. Made for layout C.", props: { radius: 999, tint: "#ffffff", tintOpacity: 0.1, blur: 8, textColor: "#f8f3ec", lineColor: "#fff1e0", baseColor: "#6b5a4a", idleIntensity: 0.35 } },
];

export default function ButtonsPage() {
  return (
    <main className="btn-page">
      <Link href="/experiment" className="back-link">Angel and the Searchers</Link>
      <h1 className="display">The main button, with light</h1>
      <p className="lede">Six takes on the candlelit pill using React Bits&rsquo; SpecularButton. Move your cursor near each one; on phones only S2 moves by itself.</p>
      <div className="btn-grid">
        {options.map((o) => (
          <section key={o.id} className={`btn-opt ${o.photo ? "on-photo" : ""}`}>
            <div className="stage">
              <SpecularButton {...o.props}>{o.label}</SpecularButton>
            </div>
            <p className="btn-name"><b>{o.id}</b> {o.name}</p>
            <p className="btn-note">{o.note}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
