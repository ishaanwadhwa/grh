import type { Metadata } from "next";
import { Pinyon_Script, Schibsted_Grotesk, Young_Serif } from "next/font/google";
import "./experiment.css";

// Young Serif: the few big lines, upright and warm, like an old trattoria sign.
const display = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
// Schibsted Grotesk: everything you read, tap or type.
const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Pinyon Script: the wordmark only (stand-in for their logo).
const script = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: { absolute: "Angel and the Searchers · Jaipur" },
  description: "Old Italian bistro and wine bar inside Chelon ki Haveli, Pink City. Book a table.",
};

// The experiment is self-contained: its own fonts, colours and CSS. Delete this folder to remove it.
export default function ExperimentLayout({ children }: { children: React.ReactNode }) {
  return <div className={`angel ${display.variable} ${sans.variable} ${script.variable}`}>{children}</div>;
}
