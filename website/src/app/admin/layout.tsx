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
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string>("");

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/admin/login") {
      setChecking(false);
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const res = await fetch("/api/admin/check");
      const data = await res.json();

      if (!data.isAdmin) {
        router.replace("/admin/login");
        return;
      }

      setAdminEmail(data.user.email);
      setChecking(false);
    });
  }, [pathname, router]);

  // On login page — render without sidebar
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
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-border-subtle flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border-subtle">
          <Link href="/" target="_blank" className="font-display text-sm tracking-[0.15em] text-text/70 hover:text-text transition-colors">
            GOOD ROOM HOUSE
          </Link>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest text-accent-gold/60">Admin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 ${
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
