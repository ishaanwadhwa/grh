import { Pinyon_Script, Schibsted_Grotesk, Young_Serif } from "next/font/google";
import AdminShell from "@/components/admin/AdminShell";
import "./admin.css";

// Same faces as the public site: Young Serif for titles, Schibsted Grotesk for everything else,
// Pinyon Script for the wordmark only.
const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--adm-serif", display: "swap" });
const sans = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500"], variable: "--adm-sans", display: "swap" });
const script = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--adm-script", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`adm ${serif.variable} ${sans.variable} ${script.variable}`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
