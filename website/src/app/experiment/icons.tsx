// Inline icons, one stroke style (24px grid, 1.6 stroke, round caps). No icon library needed.

type P = { className?: string };
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Directions = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const Calendar = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.6v5M9.5 15.1h5" />
  </svg>
);

export const Menu = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
    <path d="M7 3v6.5a2 2 0 0 0 4 0V3M9 11.5V21M9 3v5" />
    <path d="M17 21V3c-2 1.4-3 4-3 7v3.5h3" />
  </svg>
);

export const Instagram = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// Google's own colours, so the rating reads as Google's at a glance.
export const GoogleG = ({ className }: P) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z" />
  </svg>
);

export const Stars = ({ className }: P) => (
  <svg viewBox="0 0 120 24" className={className} aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} transform={`translate(${i * 24} 0)`} fill="#FBBC04" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z" />
    ))}
  </svg>
);

export const Reel = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M3.5 8.5h17M9 3.5l2.5 5M14.5 3.5l2.5 5" />
    <path d="M10.5 12.2v4.6l4-2.3z" fill="currentColor" />
  </svg>
);

export const WhatsApp = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
    <path d="M4.3 19.7l1.2-3.6a8.2 8.2 0 1 1 3 2.9z" />
    <path d="M9.3 8.4c.2-.4.4-.5.7-.5h.5c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.5.6a6.2 6.2 0 0 0 2.6 2.6l.6-.5c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.5c0 .3-.1.5-.5.7-.6.3-1.6.4-2.9-.3a8.4 8.4 0 0 1-3.6-3.6c-.6-1.3-.5-2.3-.3-2.9z" />
  </svg>
);
