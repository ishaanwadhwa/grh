"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { booking as rules, restaurant } from "./content";

// The booking sheet: guests -> date and time -> your details -> (code, when OTP is on).
// On success it hands over to the full-page confirmation in view.tsx.
// Talks only to /api/reservations/availability, /api/reservations and, with OTP on, /api/otp/*.

type Slot = { serviceId: string; serviceName: string; time: string };
type Step = "party" | "when" | "you" | "code";
type Reply = {
  code?: string;
  retryAfter?: number;
  attemptsLeft?: number;
  token?: string;
  resendIn?: number;
  notified?: "whatsapp" | "sms" | null;
  channel?: "whatsapp" | "sms";
};
export type Booked = { party: number; date: string; time: string; notified: "whatsapp" | "sms" | null };

const OTP_ON = process.env.NEXT_PUBLIC_RESERVATION_OTP === "on";
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER; // the business number that sends codes; link hidden when unset
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Desktop has room for guests, date and time on one screen; phones go one step at a time.
const WIDE = "(min-width: 1024px)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);

const TITLE: Record<Step, string> = {
  party: "How many of you?",
  when: "Pick a day and time",
  you: "Your details",
  code: "Enter the code",
};

// Dates are YYYY-MM-DD strings in Jaipur time. Maths happens in UTC so the visitor's timezone never shifts a day.
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso: string, n: number) => {
  const d = asDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const nowInJaipur = () =>
  minutes(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
export const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}`;
};
export const ampm = (t: string) => (minutes(t) < 720 ? "am" : "pm");
export const shortDate = (iso: string) => {
  const d = asDate(iso);
  return `${WEEKDAY[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()].slice(0, 3)}`;
};
export const longDate = (iso: string) => {
  const d = asDate(iso);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
};
function dayName(iso: string, today: string) {
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  return shortDate(iso);
}

async function post(url: string, body: object): Promise<[number, Reply]> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return [res.status, await res.json().catch(() => ({}))];
  } catch {
    return [0, {}];
  }
}

// The pick gets circled by hand: guests, day and time. Remounting (via key) replays the stroke.
function Ring() {
  return (
    <svg className="loop" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength={1} d="M50 4 C75.4 4 96 15.6 96 30 C96 44.4 75.4 56 50 56 C24.6 56 4 44.4 4 30 C4 16.5 21 5.5 46 4.2 C52 3.9 58 4.6 62 6" />
    </svg>
  );
}

export default function Booking({ today, open, onClose, onBooked }: {
  today: string;
  open: boolean;
  onClose: () => void;
  onBooked: (booked: Booked) => void;
}) {
  const [step, setStep] = useState<Step>("party");
  const [party, setParty] = useState(0);
  const [bigGroup, setBigGroup] = useState(false);
  const [date, setDate] = useState(""); // nothing picked yet: times appear once guests and a day are chosen
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [cc, setCc] = useState("+91");
  const [phone, setPhone] = useState("");
  const [checked, setChecked] = useState(false);
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const head = useRef<HTMLHeadingElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const dates = useRef<HTMLDivElement>(null);
  const id = useId();
  const combined = useWide() && (step === "party" || step === "when");

  useEffect(() => {
    if (open) head.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the chosen day in view in the sideways row.
  useEffect(() => {
    dates.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [date, step]);

  useEffect(() => {
    if (step !== "code") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  function go(next: Step, msg = "") {
    setMessage(msg);
    setStep(next);
    requestAnimationFrame(() => (next === "code" ? codeInput.current : head.current)?.focus({ preventScroll: true }));
  }

  async function loadSlots(size: number, day: string) {
    const mine = ++request.current;
    setSlots(null);
    setSlotsFailed(false);
    try {
      const query = new URLSearchParams({ restaurant: restaurant.slug, date: day, partySize: String(size) });
      const res = await fetch(`/api/reservations/availability?${query}`);
      if (!res.ok) throw new Error(String(res.status));
      const { slots: list } = (await res.json()) as { slots: Slot[] };
      const cutoff = day === today ? nowInJaipur() + 30 : -1; // nothing starting in the next half hour
      const free = list.filter((s) => minutes(s.time) > cutoff).sort((a, b) => minutes(a.time) - minutes(b.time));
      if (mine === request.current) setSlots(free);
    } catch {
      if (mine === request.current) setSlotsFailed(true);
    }
  }

  function pickParty(n: number) {
    setParty(n);
    setBigGroup(false);
    setSlot(null);
    if (!combined) go("when"); // on desktop everything is already on screen: nothing moves
    if (date) loadSlots(n, date);
  }
  function pickDate(d: string) {
    setDate(d);
    setSlot(null);
    setMessage("");
    if (party) loadSlots(party, d);
  }

  // ---- details ----
  const digits = phone.replace(/\D/g, "");
  const code91 = cc.replace(/\s/g, "") === "+91";
  const problems = {
    name: name.trim() ? "" : "Add the name for the booking.",
    phone: !/^\+\d{1,4}$/.test(cc.replace(/\s/g, ""))
      ? "Add a country code, like +91."
      : (code91 ? /^[6-9]\d{9}$/ : /^\d{6,14}$/).test(digits)
        ? ""
        : code91 ? "Ten digits, starting with 6, 7, 8 or 9." : "That number looks too short.",
  };
  const valid = !problems.name && !problems.phone;
  const ccClean = cc.replace(/\s/g, "");
  const needsCode = OTP_ON; // everyone verifies; foreign numbers can still "Book without code" (saved unverified)

  function submitDetails() {
    setChecked(true);
    if (!valid) return;
    if (needsCode) sendCode();
    else book();
  }

  async function sendCode(via: "whatsapp" | "sms" = "whatsapp") {
    setBusy(true);
    setMessage("");
    const [status, reply] = await post("/api/otp/send", { phone: digits, phoneCode: ccClean, channel: via });
    setBusy(false);
    if (status === 200) {
      setCode("");
      setChannel(reply.channel ?? via);
      setNow(Date.now());
      setResendAt(Date.now() + (reply.resendIn ?? 30) * 1000);
      if (step !== "code") go("code");
      return;
    }
    const wait = reply.retryAfter ?? 30;
    const copy: Record<string, string> = {
      INVALID_PHONE: "That number doesn't look right. Check it and try again.",
      SMS_UNAVAILABLE: "SMS codes only work for Indian numbers.",
      OTP_COOLDOWN: `Give it ${wait} more seconds.`,
      OTP_SEND_LIMIT: `That's a lot of codes. Try again in ${Math.ceil(wait / 60)} min, or DM us on Instagram.`,
      OTP_SEND_FAILED: "The code didn't go out. Try again, or DM us on Instagram.",
    };
    setMessage(copy[reply.code ?? ""] ?? "We couldn't send the code. Try again in a moment.");
  }

  async function verify(value: string) {
    setBusy(true);
    setMessage("");
    const [status, reply] = await post("/api/otp/verify", { phone: digits, phoneCode: ccClean, code: value });
    if (status === 200 && reply.token) return book(reply.token);
    setBusy(false);
    setCode("");
    const left = reply.attemptsLeft ?? 0;
    const copy: Record<string, string> = {
      OTP_WRONG: `Not quite. ${left} ${left === 1 ? "try" : "tries"} left.`,
      OTP_EXPIRED: "That code has expired. Send a new one.",
      OTP_TOO_MANY_ATTEMPTS: "Too many tries. Send a new code.",
    };
    setMessage(copy[reply.code ?? ""] ?? "We couldn't check the code. Try again.");
  }

  function typeCode(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    setCode(clean);
    if (clean.length === 6 && !busy) verify(clean);
  }

  async function book(otpToken?: string) {
    if (!slot) return;
    setBusy(true);
    setMessage("");
    const [status, reply] = await post("/api/reservations", {
      restaurantSlug: restaurant.slug,
      serviceId: slot.serviceId,
      date,
      time: slot.time,
      partySize: party,
      guestName: name.trim(), // just a name and a number: WhatsApp is assumed, email and requests were dropped
      // ponytail: the live API still requires an email, so send a placeholder (.invalid never delivers).
      // Drop this line once the optional-email patch (migration 014) is applied.
      guestEmail: `guest-${digits}@no-email.invalid`,
      guestPhone: digits,
      guestPhoneCode: ccClean,
      otpToken,
    });
    setBusy(false);
    if (status === 201) {
      onBooked({ party, date, time: slot.time, notified: reply.notified ?? null });
      return;
    }
    if (status === 409) {
      const taken = `${clock(slot.time)} ${ampm(slot.time)}`;
      setSlot(null);
      go("when", `${taken} just got booked. Pick another time?`);
      loadSlots(party, date);
      return;
    }
    if (status === 401) {
      setCode("");
      go("code", "That code has expired. Send a new one.");
      return;
    }
    setMessage(
      status === 400
        ? "Something in the details doesn't add up. Check them and try again."
        : "We couldn't reach the book just now. Try again in a moment, or DM us on Instagram.",
    );
  }

  // ---- render ----
  const days = Array.from({ length: rules.daysAhead }, (_, i) => addDays(today, i));
  const services = (slots ?? []).reduce<{ name: string; slots: Slot[] }[]>((list, s) => {
    const last = list[list.length - 1];
    if (last?.name === s.serviceName) last.slots.push(s);
    else list.push({ name: s.serviceName, slots: [s] });
    return list;
  }, []);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  return (
    <div className="bk">
      <header className="bk-head">
        <h2 ref={head} tabIndex={-1} className="bk-title">{combined ? "How many, and when?" : TITLE[step]}</h2>
        <button type="button" className="bk-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      {/* Only what isn't already on screen: guests while picking a time, the whole booking after that. */}
      {step === "when" && !combined && (
        <p className="recap">
          {party} {party === 1 ? "guest" : "guests"}
          <button type="button" onClick={() => go("party")}>Change</button>
        </p>
      )}
      {(step === "you" || step === "code") && slot && (
        <p className="recap">
          {party} {party === 1 ? "guest" : "guests"} · {dayName(date, today)} · {clock(slot.time)} {ampm(slot.time)}
          <button type="button" onClick={() => go("when")}>Change</button>
        </p>
      )}

      <div className="bk-body" key={combined ? "combined" : step}>
        {(step === "party" || combined) && (
          <div className="pick">
            {combined && <p className="field-k">Guests</p>}
            <div className="party" role="radiogroup" aria-label="Guests">
              {Array.from({ length: rules.maxParty }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={party === n} onClick={() => pickParty(n)}>
                  <span className="opt">{n}{party === n && <Ring key={n} />}</span>
                </button>
              ))}
              <button type="button" className="more" aria-expanded={bigGroup} onClick={() => setBigGroup(!bigGroup)}><span className="opt">9+</span></button>
            </div>
            {bigGroup && (
              <p className="quiet small">
                For nine or more, <a href={restaurant.instagram} target="_blank" rel="noreferrer">message us on Instagram</a> and
                we&rsquo;ll set up a long table.
              </p>
            )}
          </div>
        )}

        {(step === "when" || combined) && (
          <div className="pick">
            <p className="field-k">Date</p>
            <div className="dates" role="radiogroup" aria-label="Date" ref={dates}>
              {days.map((d, i) => {
                const day = asDate(d);
                const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${WEEKDAY[day.getUTCDay()].slice(0, 3)} ${day.getUTCDate()}`;
                return (
                  <button key={d} type="button" role="radio" aria-checked={d === date} aria-label={dayName(d, today)} onClick={() => pickDate(d)}>
                    <span className="opt">{label}{d === date && <Ring key={d} />}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(step === "when" || combined) && (
          <div className="pick">
            {message && <p className="flash" role="alert">{message}</p>}
            <div className="slots" aria-live="polite">
              {!party || !date ? (
                <p className="quiet">{!party ? "Pick how many of you, then a day." : "Pick a day to see free times."}</p>
              ) : slotsFailed ? (
                <p className="quiet">
                  We couldn&rsquo;t load the times. <button type="button" onClick={() => loadSlots(party, date)}>Try again</button>
                </p>
              ) : !slots ? (
                // a shimmer in the shape of the times while they load
                <div className="times-in">
                  <p className="field-k">Time</p>
                  <span className="sr-only">Finding free tables</span>
                  <div className="times shimmer" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ "--i": i } as React.CSSProperties} />)}
                  </div>
                </div>
              ) : services.length === 0 ? (
                <p className="quiet">{date === today ? "Fully booked today." : "Fully booked that day."}</p>
              ) : (
                <div className="times-in">
                  <p className="field-k">Time</p>
                  {services.map((svc) => {
                    return (
                      <div className="svc" key={svc.name}>
                        <div className="times" role="radiogroup" aria-label={`${svc.name} times`}>
                          {svc.slots.map((s) => {
                            const on = slot?.serviceId === s.serviceId && slot.time === s.time;
                            return (
                              <button key={s.time} type="button" role="radio" aria-checked={on} aria-label={`${clock(s.time)} ${ampm(s.time)}`} onClick={() => { setSlot(s); setMessage(""); }}>
                                <span className="opt">{clock(s.time)}{on && <Ring key={s.time} />}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === "you" && (
          <div className="fields">
            <div className={`field ${checked && problems.name ? "bad" : ""}`}>
              <label className="lb" htmlFor={`${id}-name`}>Name</label>
              <span className="box">
                <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" aria-invalid={checked && !!problems.name} />
              </span>
              {checked && problems.name && <span className="err">{problems.name}</span>}
            </div>

            <div className={`field ${checked && problems.phone ? "bad" : ""}`}>
              <label className="lb" htmlFor={`${id}-phone`}>Phone</label>
              <span className="box">
                <input className="cc" value={cc} onChange={(e) => setCc(e.target.value)} inputMode="tel" autoComplete="tel-country-code" aria-label="Country code" />
                <input id={`${id}-phone`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" aria-invalid={checked && !!problems.phone} />
              </span>
              {checked && problems.phone && <span className="err">{problems.phone}</span>}
            </div>

          </div>
        )}

        {step === "code" && (
          <>
            <p className="sent">
              We sent a code on {channel === "sms" ? "SMS" : "WhatsApp"} to {ccClean} {digits.replace(/(\d{5})(\d{5})/, "$1 $2")}
              {channel === "whatsapp" && WHATSAPP && (
                <a className="wa" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">Open WhatsApp</a>
              )}
            </p>
            <label className="punch">
              <input ref={codeInput} value={code} onChange={(e) => typeCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Six-digit code" disabled={busy} />
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={code[i] ? "full" : i === code.length ? "cur" : ""} aria-hidden="true">{code[i] ?? ""}</span>
              ))}
            </label>
            {message && <p className="flash" role="alert">{message}</p>}
            <p className="otp-meta">
              <button type="button" onClick={() => go("you")}>Change number</button>
              {wait > 0 ? <span>Resend in 0:{String(wait).padStart(2, "0")}</span> : <span>Didn&rsquo;t get it?</span>}
            </p>
            {wait === 0 && (
              <div className="otp-ways">
                <button type="button" onClick={() => sendCode("whatsapp")} disabled={busy}>Resend on WhatsApp</button>
                {code91 ? (
                  <button type="button" onClick={() => sendCode("sms")} disabled={busy}>Send by SMS instead</button>
                ) : (
                  <button type="button" onClick={() => book()} disabled={busy}>Book without code</button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {(step !== "party" || combined) && (
        <footer className="bk-foot">
          {step === "you" && message && <p className="flash" role="alert">{message}</p>}
          <button
            type="button"
            className="cta wide"
            disabled={busy || ((step === "when" || step === "party") && !slot) || (step === "code" && code.length < 6)}
            onClick={() => (step === "when" || step === "party" ? go("you") : step === "you" ? submitDetails() : verify(code))}
          >
            {busy
              ? "One moment…"
              : step === "when" || step === "party" ? "Proceed to book" : step === "you" ? (needsCode ? "Send me a code" : "Confirm booking") : "Verify and book"}
          </button>
        </footer>
      )}
    </div>
  );
}
