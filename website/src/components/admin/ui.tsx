"use client";

// Small admin primitives on top of admin.css. Styling lives in the CSS; these only add structure or behaviour.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// --- Icons: official DLS 2.0 glyph paths, coloured with currentColor ---

const TURN = { right: 0, down: 90, left: 180, up: -90 };

export const Chevron = ({ dir = "right", className = "" }: { dir?: keyof typeof TURN; className?: string }) => (
  <svg viewBox="0 0 6.66667 10.6667" className={`chev ${className}`} style={{ rotate: `${TURN[dir]}deg` }} aria-hidden="true">
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M0.264477 0.245538C0.617102 -0.0818562 1.18881 -0.0818444 1.54142 0.245564L6.40222 4.75897C6.75482 5.08637 6.75482 5.61718 6.40221 5.94458L1.58095 10.4211C1.22834 10.7485 0.656634 10.7485 0.304015 10.4211C-0.0486041 10.0937 -0.0486076 9.5629 0.304007 9.2355L4.48681 5.35176L0.264448 1.43116C-0.0881606 1.10375 -0.0881479 0.572931 0.264477 0.245538Z" />
  </svg>
);

export const Close = () => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path fill="currentColor" d="M8.88842 6.99866L13.6068 2.28479C14.1311 1.76102 14.1311 0.916587 13.6068 0.392823C13.0825 -0.130941 12.2373 -0.130941 11.713 0.392823L6.99465 5.1067L2.27627 0.403512C1.76271 -0.120252 0.906764 -0.120252 0.393198 0.403512C-0.120367 0.927276 -0.131066 1.77171 0.393198 2.28479L5.10088 6.99866L0.393198 11.7125C-0.131066 12.2363 -0.131066 13.0807 0.393198 13.6045C0.649981 13.861 0.992358 14 1.33473 14C1.67711 14 2.01949 13.8717 2.27627 13.6045L6.99465 8.89063L11.713 13.6045C11.9698 13.861 12.3122 14 12.6546 14C12.9969 14 13.3393 13.8717 13.5961 13.6045C14.1204 13.0807 14.1204 12.2363 13.5961 11.7125L8.87772 6.99866H8.88842Z" />
  </svg>
);

// --- Page header: optional back link, serif title, one-line subtitle, actions on the right ---

export function PageHeader({ back, title, sub, actions }: {
  back?: { href: string; label: string };
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="min-w-0">
        {back && <Link href={back.href} className="back"><Chevron dir="left" />{back.label}</Link>}
        <h1 className="t-title">{title}</h1>
        {sub && <p className="t-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A page header with pills under it for the sections of one thing (a restaurant, a property). */
export function TabsHeader({ back, title, tabs, current, actions }: {
  back: { href: string; label: string };
  title: string;
  tabs: { label: string; href: string }[];
  current: string; // href of the current tab
  actions?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader back={back} title={title} actions={actions} />
      <nav className="pills" aria-label={`${title} sections`}>
        {tabs.map((tab) => <Link key={tab.href} href={tab.href} className="pill" aria-current={tab.href === current ? "page" : undefined}>{tab.label}</Link>)}
      </nav>
    </>
  );
}

export function RestaurantHeader({ id, name, current, actions }: {
  id: string;
  name: string;
  current: "details" | "hours" | "floor";
  actions?: React.ReactNode;
}) {
  const base = `/admin/restaurants/${id}`;
  const tabs = [{ label: "Details", href: base }, { label: "Booking hours", href: `${base}/availability` }, { label: "Floor plan", href: `${base}/floorplan` }];
  return <TabsHeader back={{ href: "/admin/restaurants", label: "Restaurants" }} title={name} tabs={tabs} current={tabs[["details", "hours", "floor"].indexOf(current)].href} actions={actions} />;
}

// --- Status tag: one map for every booking, table and publish state in the admin ---

const STATUS: Record<string, [string, string]> = {
  confirmed: ["tag-pos", "Confirmed"],
  pending: ["tag-warn", "Pending"],
  arrived: ["tag-info", "Arrived"],
  seated: ["tag-brand", "Seated"],
  completed: ["", "Finished"],
  cancelled: ["tag-neg", "Cancelled"],
  no_show: ["tag-neg", "No-show"],
  needs_table: ["tag-warn", "Needs a table"],
  unverified: ["tag-warn", "Unverified"],
  not_bookable: ["tag-warn", "Not bookable"],
  published: ["tag-pos", "Published"],
  draft: ["", "Draft"],
  active: ["tag-pos", "Live"],
  hidden: ["", "Hidden"],
};

export function StatusTag({ status, title }: { status: string; title?: string }) {
  const [tone, label] = STATUS[status] || ["", status.replaceAll("_", " ")];
  return <span className={`tag ${tone}`} title={title}>{label}</span>;
}

// --- Switches (DLS: trailing, green when on) ---

/** A bare switch, for rows that have their own layout. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="grid min-h-11 place-items-center">
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

/** Label left, switch trailing; the whole row is the control. */
export function SwitchRow({ label, sub, checked, onChange, disabled }: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="switch-row">
      <span className="min-w-0 flex-1">
        <span className="block t-body">{label}</span>
        {sub && <span className="block t-sub">{sub}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

// --- Stepper for small counts (seats, party size) ---

export function Stepper({ value, min = 1, max = 99, onChange, label, disabled }: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label={`More ${label.toLowerCase()}`}>+</button>
    </div>
  );
}

// --- Notices: one snackbar per page. Confirmations fade on their own; errors stay until dismissed. ---

export function Snackbar({ message, tone = "info", onClose }: {
  message: string;
  tone?: "info" | "error";
  onClose: () => void;
}) {
  // Callers pass inline callbacks; keep the latest in a ref so re-renders don't restart the timer.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!message || tone === "error") return;
    const timer = window.setTimeout(() => close.current(), 4000);
    return () => window.clearTimeout(timer);
  }, [message, tone]);
  if (!message) return null;
  return (
    <div className={`snackbar ${tone === "error" ? "is-error" : ""}`} role={tone === "error" ? "alert" : "status"}>
      <span className="dot" aria-hidden="true" />
      <p>{message}</p>
      {tone === "error" && <button type="button" onClick={onClose}>Dismiss</button>}
    </div>
  );
}

type DbError = { message: string; code?: string };

/** Plain words for the database errors admins actually hit. */
export function explain(error: DbError) {
  if (error.code === "23503") return "It's still linked to bookings, so it can't be deleted.";
  if (error.code === "23505") return "That name is already taken. Try another.";
  return error.message;
}

/** `say` confirms, `fail` reports (a message or a Supabase error); render `snackbar` once at the end of the page. */
export function useNotice() {
  const [notice, setNotice] = useState<{ text: string; tone?: "error" }>({ text: "" });
  const say = useCallback((text: string) => setNotice({ text }), []);
  const fail = useCallback((error: string | DbError) => setNotice({ text: typeof error === "string" ? error : explain(error), tone: "error" }), []);
  const clear = useCallback(() => setNotice({ text: "" }), []);
  return { say, fail, clear, snackbar: <Snackbar message={notice.text} tone={notice.tone} onClose={clear} /> };
}

// --- Sheet: bottom sheet on phones, centred card on desktop. Scrim tap or Esc closes. ---

/** Close something on Escape while it's open. */
export function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

export function Sheet({ open, onClose, labelledBy, children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><Close /></button>
        {children}
      </section>
    </div>
  );
}

export const Loading = () => <div className="loading" aria-label="Loading"><span className="spinner" /></div>;

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="t-h4">{title}</p>
      {sub && <p className="t-sub">{sub}</p>}
      {action}
    </div>
  );
}

// --- Formatting: absolute dates, 12-hour times, Indian number grouping ---

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10-18" → "18 Oct '26" */
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} '${String(y).slice(2)}`;
}

/** "2026-10-18" → "Sun, 18 Oct" */
export function fmtDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

/** "19:30" or "19:30:00" → "7:30 PM" */
export function fmtTime(hhmm: string | null | undefined) {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", GBP: "£" };

/** 100000, "INR" → "₹1,00,000". No decimals on surface. */
export function fmtMoney(amount: number | null | undefined, currency = "INR") {
  const value = Math.round(Number(amount) || 0).toLocaleString(currency === "INR" ? "en-IN" : "en-GB");
  return SYMBOL[currency] ? `${SYMBOL[currency]}${value}` : `${currency} ${value}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Today in the restaurant's time zone, "2026-10-18". */
export const todayIn = (timeZone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** The time now in the restaurant's time zone, "19:30". */
export const nowIn = (timeZone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

/** "Old Town Bistro" → "old-town-bistro" (as typed; no other characters are stripped). */
export const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, "-");

// Reservation sources (main, migration 014) plus room-booking channels.
const SOURCES: Record<string, string> = { website: "Website", walk_in: "Walk-in", walkin: "Walk-in", phone: "Phone", eazydiner: "EazyDiner", other: "Other", booking_com: "Booking.com", airbnb: "Airbnb" };
export const sourceLabel = (source: string) => SOURCES[source] || source.replaceAll("_", " ");
