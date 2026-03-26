# GOOD ROOM HOUSE — Design Language

**Version:** 0.1
**Last Updated:** 2026-03-26
**Source:** Extracted from [goodroomhouse-ui](https://github.com/ishaanwadhwa/goodroomhouse-ui)

---

## Visual Direction

The design language is **"quiet luxury"** — dark, immersive, warm. Inspired by Ralph Lauren's aesthetic but with a younger, more intimate energy.

- Dark, moody base — deep navy as default background
- Warm accents — champagne ivory, stone taupe, brass gold
- Editorial feel — serif display type, generous whitespace
- Minimal decoration — no unnecessary ornamentation
- Gold as the signature accent — borders, highlights, decorative elements
- Crimson for action — CTAs and interactive elements
- Subtle motion — gentle fade-in/slide-up animations, not flashy

---

## Color Palette

### Primary (Deep Navy)
| Token | Hex | Usage |
|---|---|---|
| `primary.DEFAULT` | `#1A2238` | Deep Navy Royale — main brand color |
| `primary.dark` | `#0E1624` | Body background, darkest tone |
| `primary.light` | `#2E3A58` | Gradients, muted overlays |

### Backgrounds / Neutrals
| Token | Hex | Usage |
|---|---|---|
| `background.DEFAULT` | `#F8F5ED` | Champagne Ivory — light page backgrounds |
| `background.soft` | `#D4CBB8` | Stone Taupe — cards, secondary sections |
| `background.dark` | `#3D2F2F` | Cigar Brown — footer, deep contrast |

### Accents
| Token | Hex | Usage |
|---|---|---|
| `accent.DEFAULT` | `#A33E3E` | Crimson Merlot — CTA buttons, links |
| `accent.hover` | `#8E3434` | Hover / focus states |
| `accent.gold` | `#C4A26C` | Brass Luxe — decorative highlights, borders |
| `accent.olive` | `#3E4E3C` | Hunter Olive — secondary accent |

### Text
| Token | Hex | Usage |
|---|---|---|
| `text.DEFAULT` | `#2B2B2B` | Charcoal — base text on light backgrounds |
| `text.light` | `#4A4A4A` | Muted body text |
| `text.inverse` | `#F8F5ED` | Text on dark backgrounds |

### Borders
| Token | Hex | Usage |
|---|---|---|
| `border.DEFAULT` | `#C4A26C` | Gold accent border |
| `border.subtle` | `#D4CBB8` | Soft border for cards |

---

## Typography

### Display Font — Cormorant Garamond (Serif)
- Weights: 400, 500, 600, 700
- CSS variable: `--font-display`
- Tailwind class: `font-display`
- Used for: headings, brand name, editorial text

### Body Font — Raleway (Sans-serif)
- Weights: 400, 500, 600, 700
- CSS variable: `--font-body`
- Tailwind class: `font-body`
- Used for: body text, form inputs, buttons, paragraphs

### Typography Patterns
- Hero headings: `text-3xl md:text-6xl tracking-[0.02em]`
- Body paragraphs: standard size with `leading-relaxed`
- Buttons: `uppercase tracking-widest text-xs md:text-sm font-medium`
- Small labels: `text-xs italic`

---

## Logo & Brand Assets

### Main Logo (`logo.png`)
- "GOOD ROOM HOUSE" in tall, condensed serif lettering
- Deep navy blue letters with subtle crimson outlines on black background
- Circular "GRH" monogram emblem above text (navy on cream circle)
- High-res: 3509 x 2480px

### Tab/Favicon (`tab-logo.jpeg`)
- Circular "GRH" monogram only
- Cream/beige circle with navy blue letters
- 240 x 234px

---

## Spacing & Layout

### Containers
- Max width: `max-w-6xl` (1152px) with `px-4` padding
- Narrow text pages: `max-w-3xl` with `px-6`

### Section Spacing
- Section padding: `py-20` to `py-28`
- Element gaps: `gap-8 md:gap-12`
- Content stacking: `mt-4`, `mt-6`, `mt-8` (4px increments)

### Breakpoints
- `sm:` 640px
- `md:` 768px — desktop nav, larger headings
- `lg:` 1024px — full viewport height, tighter spacing

---

## Shadows
| Token | Value | Usage |
|---|---|---|
| `shadow-soft` | `0 2px 12px rgba(0,0,0,0.08)` | Subtle elevation |
| `shadow-deep` | `0 4px 20px rgba(0,0,0,0.15)` | Hover state, toasts |

---

## Motion Patterns
- Entrance animations: opacity 0→1 + translateY with `0.6-0.7s` duration, `easeOut`
- Card hover: shadow deepening + slight upward translate (`-translate-y-0.5`)
- Background effects: radial gradient overlays, vignette gradients
- Subtle gold glow behind logo using `blur-3xl`

---

## Component Patterns

### Navbar
- Fixed position, transparent background, no blur
- Brand text (not logo image) in nav: `text-white/70 hover:text-white font-display tracking-wider`
- Mobile: hamburger opens full-screen overlay with `bg-black/70 backdrop-blur-sm`

### Cards
- Gold border (`border-border`), champagne background
- Hover: shadow deepens + slight lift
- Angular aesthetic — no excessive rounding

### Buttons
- Primary: solid crimson (`bg-accent`) with uppercase tracking
- Secondary: outline with gold/accent border
- Square/angular feel — minimal border-radius

### Forms
- Gold-bordered inputs on dark backgrounds
- Square aesthetic, no rounded corners
- Toast notifications with gold left accent stripe

---

## Design References
- [Sacred House](https://www.sacredhouse.com.tr/en) — Editorial, immersive property presentation
- [goodroomhouse-ui](https://github.com/ishaanwadhwa/goodroomhouse-ui) — Existing brand UI with logo, colors, typography
