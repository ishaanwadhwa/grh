"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "⊞" },
  { href: "/admin/properties", label: "Properties", icon: "⌂" },
  { href: "/admin/restaurants", label: "Restaurants", icon: "◉" },
  { href: "/admin/events", label: "Events", icon: "◈" },
  { href: "/admin/bookings", label: "Bookings", icon: "◷" },
  { href: "/admin/reservations", label: "Reservations", icon: "◎" },
  { href: "/admin/users", label: "Admin Users", icon: "◐" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

function Sidebar({
  adminEmail,
  pathname,
  onNavigate,
}: {
  adminEmail: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border-subtle">
        <Link
          href="/"
          target="_blank"
          className="font-display text-sm tracking-[0.15em] text-text/70 hover:text-text transition-colors"
        >
          GOOD ROOM HOUSE
        </Link>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-accent-gold/60">Admin</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-3 text-sm transition-all duration-150 ${
                isActive
                  ? "bg-accent-gold/10 text-text font-medium"
                  : "text-text/50 hover:text-text hover:bg-background"
              }`}
            >
              <span className="text-xs opacity-60">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-subtle">
        <p className="text-xs text-text/30 truncate mb-2">{adminEmail}</p>
        <button
          onClick={async () => {
            const supabase = createBrowserClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            await supabase.auth.signOut();
            router.replace("/admin/login");
          }}
          className="text-xs text-text/40 hover:text-accent transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecking(false);
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/admin/login"); return; }

      const res = await fetch("/api/admin/check");
      const data = await res.json();

      if (!data.isAdmin) { router.replace("/admin/login"); return; }

      setAdminEmail(data.user.email);
      setChecking(false);
    });
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text/30 text-sm tracking-widest uppercase">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex font-body">

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-border-subtle flex-col fixed md:static inset-y-0 left-0 z-30">
        <Sidebar adminEmail={adminEmail} pathname={pathname} />
      </aside>

      {/* ── Mobile: top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border-subtle flex items-center justify-between px-4 py-3">
        <div>
          <p className="font-display text-sm tracking-[0.15em] text-text/70">GRH</p>
          <p className="text-[9px] uppercase tracking-widest text-accent-gold/60 leading-none">Admin</p>
        </div>

        {/* Current page label */}
        <p className="text-xs text-text/50 absolute left-1/2 -translate-x-1/2">
          {navItems.find((n) =>
            n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)
          )?.label || "Admin"}
        </p>

        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col gap-1.5 w-8 h-8 items-center justify-center"
          aria-label="Open menu"
        >
          <span className="block h-px w-5 bg-text/60" />
          <span className="block h-px w-5 bg-text/60" />
          <span className="block h-px w-5 bg-text/60" />
        </button>
      </div>

      {/* ── Mobile: drawer overlay ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-border-subtle flex flex-col shadow-deep">
            {/* Close button */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 text-text/40 hover:text-text text-lg"
              aria-label="Close menu"
            >
              ×
            </button>
            <Sidebar
              adminEmail={adminEmail}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto md:pt-0 pt-[52px] min-w-0">
        {children}
      </main>
    </div>
  );
}
