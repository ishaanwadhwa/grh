"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Agentation } from "agentation";
import { createClient } from "@/lib/supabase/client";
import { Close, Loading, useEscape } from "./ui";

// Grouped by job: what's happening today, what you set up once, who runs the admin.
const NAV = [
  { items: [{ href: "/admin", label: "Overview" }] },
  {
    title: "Today",
    items: [
      { href: "/admin/service", label: "Live floor" },
      { href: "/admin/reservations", label: "Reservations" },
      { href: "/admin/bookings", label: "Room bookings" },
    ],
  },
  {
    title: "Set up",
    items: [
      { href: "/admin/restaurants", label: "Restaurants" },
      { href: "/admin/properties", label: "Properties" },
      { href: "/admin/events", label: "Events" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/users", label: "Team" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

function Nav({ adminEmail, onNavigate }: { adminEmail: string; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <>
      <Link href="/" target="_blank" className="wordmark">Sunday Rose Club</Link>
      <p className="t-cap">Admin</p>
      <nav className="nav" aria-label="Admin">
        {NAV.map((group, i) => (
          <div key={group.title || i} className="nav-group">
            {group.title && <p className="t-meta">{group.title}</p>}
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={isCurrent(item.href) ? "page" : undefined}>{item.label}</Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <p className="t-cap truncate">{adminEmail}</p>
        <button
          type="button"
          className="btn btn-tertiary btn-sm mt-1 -ml-3"
          onClick={async () => { await createClient().auth.signOut(); router.replace("/admin/login"); }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminEmail, setAdminEmail] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEscape(drawerOpen, () => setDrawerOpen(false));

  // Close the drawer on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // One check per visit (the server route reads the session itself); the proxy guards every request anyway.
  useEffect(() => {
    if (pathname === "/admin/login" || adminEmail) return;
    fetch("/api/admin/check")
      .then((res) => res.json())
      .then((data) => (data.isAdmin ? setAdminEmail(data.user.email) : router.replace("/admin/login")))
      .catch(() => router.replace("/admin/login"));
  }, [pathname, router, adminEmail]);

  // Agentation: click anything, leave a note, copy it for the agent. Dev only.
  const devTools = process.env.NODE_ENV === "development" && <Agentation appName="Sunday Rose Club admin" />;

  if (pathname === "/admin/login") return <>{children}{devTools}</>;
  if (!adminEmail) return <><Loading />{devTools}</>;

  return (
    <>
      <div className="adm-shell">
        <aside className="side">
          <Nav adminEmail={adminEmail} />
        </aside>

        <div className="adm-main">
          <header className="topbar">
            <Link href="/admin" className="wordmark">Sunday Rose Club</Link>
            <button type="button" className="burger" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}>
              <i /><i /><i />
            </button>
          </header>
          <main>{children}</main>
        </div>

        {drawerOpen && (
          <>
            <div className="scrim" onClick={() => setDrawerOpen(false)} />
            <aside className="drawer" aria-label="Menu">
              <button type="button" className="sheet-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><Close /></button>
              <Nav adminEmail={adminEmail} onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </>
        )}
      </div>
      {devTools}
    </>
  );
}
