"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import { Agentation } from "agentation";
import Booking, { ampm, clock, shortDate, type Booked } from "./booking";
import { chapters, collage, findPhoto, posts, restaurant, story } from "./content";
import { Calendar, Directions, GoogleG, Instagram, Menu, Stars, WhatsApp } from "./icons";
import PinkCityMap from "./map";

// React Bits ReflectiveCard (WebGL), loaded only for the confirmation. Plain JS, so we declare the props we use.
type ReflectiveCardProps = {
  children?: React.ReactNode; theme?: "light" | "dark"; tint?: string; width?: number; height?: number;
  radius?: number; metalness?: number; roughness?: number; glare?: number; warp?: number; shine?: number; bevel?: number;
};
// React Bits AccordionGallery (gsap) for the Instagram posts: panels open on hover or tap.
type AccordionProps = {
  items: { image: string; label?: string; link?: string; alt?: string }[];
  defaultIndex?: number; accentColor?: string; overlayColor?: string; textColor?: string;
  height?: number; gap?: number; radius?: number; expandRatio?: number;
};
const AccordionGallery = dynamic(
  () => import("./accordion-gallery") as unknown as Promise<{ default: React.ComponentType<AccordionProps> }>,
  { ssr: false, loading: () => <div className="ag-wait" /> },
);
const ReflectiveCard = dynamic(
  () => import("./reflective-card") as unknown as Promise<{ default: React.ComponentType<ReflectiveCardProps> }>,
  { ssr: false },
);

// ponytail: the options switcher exists while picks are being compared. Delete it (and Look) once they're final.
const LAYOUTS = ["a", "b", "c"] as const; // home layouts being compared (see /moodboard/layouts.html)
const BGS = ["none", "w1", "w2", "w3", "w4", "w5", "w6"] as const; // page backgrounds being compared (see /moodboard/backgrounds.html)
type Bg = (typeof BGS)[number];
type Layout = (typeof LAYOUTS)[number];
const TITLES = ["logo", "name", "line"] as const; // which leads the intro: their logo, the name in script, or the line
type Title = (typeof TITLES)[number];
// name and line colours: K1 ink name, soft line · K2 ink name, red line · K3 red name, ink line
const INKS = ["k1", "k2", "k3"] as const;
type Ink = (typeof INKS)[number];
const pick = <T extends string>(list: readonly T[], value: string | undefined, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;
const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties; // staggers the fade-ins

function Options({ layout, title, ink, bg, onLayout, onTitle, onInk, onBg }: {
  layout: Layout;
  title: Title;
  ink: Ink;
  bg: Bg;
  onLayout: (layout: Layout) => void;
  onTitle: (title: Title) => void;
  onInk: (ink: Ink) => void;
  onBg: (bg: Bg) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="tweaks">
      <button type="button" className="tweaks-toggle" aria-expanded={shown} onClick={() => setShown(!shown)}>
        Options · {layout.toUpperCase()} {ink.toUpperCase()} {bg.toUpperCase()}
      </button>
      {shown && (
        <div className="tweaks-row" role="radiogroup" aria-label="layout">
          <span>Layout</span>
          {LAYOUTS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={layout === l} onClick={() => onLayout(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
      )}
      {shown && (
        <div className="tweaks-row" role="radiogroup" aria-label="title">
          <span>Leads</span>
          {TITLES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={title === t} onClick={() => onTitle(t)}>{t === "logo" ? "Logo" : t === "name" ? "Name" : "Line"}</button>
          ))}
        </div>
      )}
      {shown && (
        <div className="tweaks-row" role="radiogroup" aria-label="colours">
          <span>Colours</span>
          {INKS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={ink === k} onClick={() => onInk(k)}>{k.toUpperCase()}</button>
          ))}
        </div>
      )}
      {shown && (
        <div className="tweaks-row" role="radiogroup" aria-label="background">
          <span>Background</span>
          {BGS.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={bg === b} onClick={() => onBg(b)}>{b === "none" ? "None" : b.toUpperCase()}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Rating() {
  const g = restaurant.google;
  return (
    <a className="rating" href={g.url} target="_blank" rel="noreferrer" aria-label={`Rated ${g.score} out of 5 from ${g.reviews} Google reviews`}>
      <GoogleG className="g" />
      <b>{g.score}</b>
      <Stars className="stars" />
      <span>{g.reviews} reviews</span>
    </a>
  );
}

function calendarLink(b: Booked) {
  const start = new Date(`${b.date}T${b.time}:00Z`); // read as Jaipur wall-clock time via ctz below
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Table at ${restaurant.name}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    ctz: "Asia/Kolkata",
    location: restaurant.address.join(", "),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// Booked: the sheet turns into the confirmation. No new page; Done closes it.
function Confirmed({ booked, onDone }: { booked: Booked; onDone: () => void }) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => head.current?.focus({ preventScroll: true }), []);
  const note = booked.notified === "sms"
    ? "Your booking details are on their way by SMS."
    : booked.notified === "whatsapp"
      ? "Your booking details are on their way to WhatsApp."
      : "You'll get your booking details and confirmation on WhatsApp.";

  return (
    <div className="bk done">
      <header className="bk-head">
        <h2 ref={head} tabIndex={-1} className="bk-title">Booking confirmed</h2>
        <button type="button" className="bk-close" onClick={onDone} aria-label="Close">×</button>
      </header>
      <div className="bk-body">
        {/* The booking as a card of warm paper with a soft sheen, tilting toward your cursor or finger */}
        <div className="pass">
          <ReflectiveCard theme="light" tint="#efe4d3" width={280} height={360} radius={18} metalness={0.2} roughness={0.8} shine={0.5} glare={0.25} warp={0.15} bevel={2}>
            <div className="pass-in">
              <p className="pass-top">
                <span className="pass-name">{restaurant.name}</span>
                <span className="pass-status"><i aria-hidden="true" />Confirmed</span>
              </p>
              <p className="pass-big"><span>Table for</span>{booked.party}</p>
              <dl className="pass-facts">
                <div><dt>Date</dt><dd>{shortDate(booked.date)}</dd></div>
                <div><dt>Time</dt><dd>{clock(booked.time)} {ampm(booked.time)}</dd></div>
              </dl>
            </div>
          </ReflectiveCard>
        </div>
        <p className="pass-note"><WhatsApp />{note}</p>
        <nav className="acts" aria-label="Next steps">
          <a className="act" href={restaurant.directions} target="_blank" rel="noreferrer">
            <span className="ico"><Directions /></span>Directions
          </a>
          <a className="act" href={calendarLink(booked)} target="_blank" rel="noreferrer">
            <span className="ico"><Calendar /></span>Add to calendar
          </a>
          {restaurant.menuUrl && (
            <a className="act" href={restaurant.menuUrl} target="_blank" rel="noreferrer">
              <span className="ico"><Menu /></span>Menu
            </a>
          )}
        </nav>
      </div>
      <footer className="bk-foot">
        <button type="button" className="ghost wide" onClick={onDone}>Done</button>
      </footer>
    </div>
  );
}

export default function AngelView({ today, initial }: {
  today: string;
  initial: { layout?: string; title?: string; ink?: string; bg?: string; embed?: string; book?: string };
}) {
  const embed = initial.embed === "1"; // inside the layouts comparison: no dev tools
  const [layout, setLayout] = useState<Layout>(pick(LAYOUTS, initial.layout, "a"));
  const [title, setTitle] = useState<Title>(pick(TITLES, initial.title, "logo"));
  const [ink, setInk] = useState<Ink>(pick(INKS, initial.ink, "k3"));
  const [bg, setBg] = useState<Bg>(pick(BGS, initial.bg, "w6"));
  const [open, setOpen] = useState(initial.book === "1"); // ?book=1 (e.g. from the owners page) opens straight onto booking
  const [round, setRound] = useState(0); // bumps after a booking so the next one starts fresh
  const [booked, setBooked] = useState<Booked | null>(null);
  const [pastIntro, setPastIntro] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const lenis = useRef<Lenis | null>(null);

  // Layout C: smooth the wheel so the scroll-linked zoom and chapters glide instead of stepping. Not for reduced motion.
  useEffect(() => {
    if (layout !== "c" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const smooth = new Lenis({ lerp: 0.085 });
    lenis.current = smooth;
    let raf = requestAnimationFrame(function loop(t) {
      smooth.raf(t);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      smooth.destroy();
      lenis.current = null;
    };
  }, [layout]);

  // Photos and lines fade up as they scroll into view.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll(".angel .reveal:not(.is-in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // The floating "Book a table" appears once the intro's own button has scrolled away.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPastIntro(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // While booking is open: the page can't scroll, Escape closes, focus returns to whatever opened it.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    lenis.current?.stop();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = "";
      lenis.current?.start();
      window.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open]);

  // However the sheet closes after a booking, it resets once it has slid away, so the next booking starts fresh.
  useEffect(() => {
    if (open || !booked) return;
    const t = setTimeout(() => {
      setBooked(null);
      setRound((r) => r + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [open, booked]);

  const book = (e: React.MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    setOpen(true);
  };
  const close = () => setOpen(false);
  // shareable combination in the URL
  const remember = (next: { layout?: Layout; title?: Title; ink?: Ink; bg?: Bg }) => {
    const all = { layout, title, ink, bg, ...next };
    window.history.replaceState(null, "", `?${new URLSearchParams(all)}`);
  };
  const changeLayout = (next: Layout) => { setLayout(next); remember({ layout: next }); };
  const changeTitle = (next: Title) => { setTitle(next); remember({ title: next }); };
  const changeInk = (next: Ink) => { setInk(next); remember({ ink: next }); };
  const changeBg = (next: Bg) => { setBg(next); remember({ bg: next }); };

  return (
    <>
      {/* The page's light and texture, behind everything: candlelight in the empty margins */}
      <div className="bg" data-bg={bg} aria-hidden="true"><i /><i /></div>
      <main data-layout={layout}>
          {/* hero + hero-in only matter in layout C, where the photo zooms out as you scroll */}
          <div className="hero"><div className="hero-in">
          <section className="intro" data-title={title} data-ink={ink}>
            {/* name + line move together: in layout C they shrink into the framed photo as its heading */}
            <div className="intro-head">
              <h1 className="intro-mark rise">
                {title === "logo" ? (
                  // their logo: the Instagram profile picture, AI-enhanced with Codex, white keyed out. Swap for the team's file.
                  <Image className="logo" src="/images/angel/logo.png" alt={restaurant.name} width={1105} height={586} priority />
                ) : restaurant.name}
              </h1>
              <p className="tagline display rise" style={delay(0.08)}>{restaurant.line}</p>
            </div>
            <div className="intro-cta rise" style={delay(0.16)} ref={ctaRef}>
              <button type="button" className="cta" onClick={book}>Book a table</button>
              {restaurant.menuUrl && (
                <a className="ghost" href={restaurant.menuUrl} target="_blank" rel="noreferrer"><Menu />Menu</a>
              )}
            </div>
            <div className="rise" style={delay(0.24)}><Rating /></div>
          </section>

          <div className="collage">
            <figure className="ph c-main rise" style={delay(0.3)}><Image src={collage.main.src} alt={collage.main.alt} fill sizes="(min-width: 1024px) 50vw, 85vw" priority /></figure>
            <figure className="ph c-left reveal" style={delay(0.15)}><Image src={collage.left.src} alt={collage.left.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" /></figure>
            <figure className="ph c-right reveal" style={delay(0.3)}><Image src={collage.right.src} alt={collage.right.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" /></figure>
          </div>
          </div></div>

          {/* Layout C only: chapters after the zoom-out. Each photo pins and shrinks into a card, words arrive, the next slides over. */}
          {layout === "c" && chapters.map((c, i) => {
            const more = c.action === "menu" && restaurant.menuUrl
              ? <a className="more" href={restaurant.menuUrl} target="_blank" rel="noreferrer">See the menu</a>
              : <button type="button" className="more" onClick={book}>Book a table</button>;
            return (
              <section key={c.src} className="ch" style={{ "--z": i + 2 } as React.CSSProperties} aria-label={c.title}>
                <div className="pin">
                  <figure className="media"><Image src={c.src} alt={c.alt} fill sizes="100vw" /></figure>
                  <div className="copy-l">
                    <h2 className="display">{c.title}</h2>
                    <p>{c.body}</p>
                    <span className="phone-only">{more}</span>
                  </div>
                  <div className="copy-r">
                    <p>{c.aside}</p>
                    {more}
                  </div>
                </div>
              </section>
            );
          })}

          <section className="story">
            <p className="display reveal">{story.line}</p>
          </section>

          {/* Their Instagram: just the photos, edge to edge. Each one opens their profile. */}
          <section className="week" aria-label="From our Instagram">
            <div className="ig reveal">
              <AccordionGallery
                items={posts.map((p) => ({ image: p.src, label: p.caption, link: restaurant.instagram, alt: p.alt }))}
                defaultIndex={2}
                accentColor="#b3312e"
                overlayColor="#140c07"
                textColor="#fbf6ef"
                height={480}
                gap={4}
                radius={0}
                expandRatio={0.46}
              />
            </div>
          </section>

          {/* Find us: a postcard. The haveli on the front; on the back, the address, a small map and a way to get there. */}
          <section className="find" aria-labelledby="find-title">
            <div className="postcard reveal">
              <figure className="ph pc-front"><Image src={findPhoto.src} alt={findPhoto.alt} fill sizes="(min-width: 768px) 540px, 100vw" /></figure>
              <div className="pc-back">
                <h2 id="find-title" className="display">Inside Chelon ki Haveli</h2>
                <address>{restaurant.address.map((line) => <span key={line}>{line}</span>)}</address>
                <p className="hours">{restaurant.hours}</p>
                <figure className="pc-mapbox"><PinkCityMap className="pc-map" /></figure>
                <a className="ghost" href={restaurant.directions} target="_blank" rel="noreferrer"><Directions />Directions</a>
              </div>
            </div>
          </section>
      </main>

      <footer className="foot">
        <p>{restaurant.name} · <Link href="/experiment/owner">Meet the owners</Link> · <Link href="/">a Good Room House restaurant</Link></p>
        <div className="socials">
          <a href={restaurant.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>
          <a href={restaurant.google.url} target="_blank" rel="noreferrer" aria-label="Google reviews"><GoogleG /></a>
        </div>
      </footer>

      <div className={`float ${pastIntro && !open ? "is-on" : ""}`} inert={!pastIntro || open}>
        <p>Free tonight?</p>
        <button type="button" className="cta small" onClick={book}>Book a table</button>
      </div>

      <div className={`backdrop ${open ? "is-open" : ""}`} onClick={close} aria-hidden="true" />
      <div className={`sheet ${open ? "is-open" : ""}`} data-lenis-prevent role="dialog" aria-modal="true" aria-label={booked ? "Booking confirmed" : "Book a table"} inert={!open}>
        {booked ? (
          <Confirmed booked={booked} onDone={close} />
        ) : (
          <Booking key={round} today={today} open={open} onClose={close} onBooked={setBooked} />
        )}
      </div>

      {!embed && <Options layout={layout} title={title} ink={ink} bg={bg} onLayout={changeLayout} onTitle={changeTitle} onInk={changeInk} onBg={changeBg} />}
      {/* Agentation: click anything, leave a note, copy it for the agent. Dev only. */}
      {!embed && process.env.NODE_ENV === "development" && <Agentation appName="Angel experiment" />}
    </>
  );
}
