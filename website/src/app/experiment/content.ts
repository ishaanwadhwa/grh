// Everything the experiment page says lives here. Edit freely.

export const restaurant = {
  slug: "angels-and-searchers", // must match Supabase: drives live time slots and bookings
  name: "Angel and the Searchers",
  kind: "Old Italian bistro & wine bar",
  city: "Pink City, Jaipur",
  line: "A lil Italian romance never hurt anybody.",
  address: ["Chelon ki Haveli, Plot 185, Chelon ka Mohalla", "Near Jalebi Chowk, Chowkadi Sarhad", "Jaipur 302002"], // their launch teaser; one older reel said 185 Tulsi Marg
  hours: "Lunch 12 to 3:30 pm · Dinner 7 pm to midnight", // their Instagram bio
  google: { score: "5.0", reviews: 23, url: "https://www.google.com/maps/search/?api=1&query=Angel+and+the+Searchers+Jaipur" },
  instagramHandle: "@angelandthesearchers",
  instagram: "https://www.instagram.com/angelandthesearchers/",
  directions: "https://www.google.com/maps/dir/?api=1&destination=Angel+and+the+Searchers+Jaipur",
  // ponytail: a photo of their printed menu until the admin PDF upload (menuPdfUrl) lands. null hides "See the menu".
  menuUrl: "/images/angel/g3.jpg" as string | null,
  // ponytail: Goodroom links to its existing page until it gets its own experiment.
  sisters: [{ name: "Goodroom", href: "/good-room" }],
};

export const booking = {
  maxParty: 8, // 9+ is sent to Instagram DMs
  daysAhead: 14,
};

// Layout C, after the zoom-out: each photo pins, shrinks into a card, words arrive around it, and the next one slides over it.
export const chapters = [
  {
    src: "/images/angel/g2.jpg",
    alt: "Two wood-fired pizzas on blue-and-white plates, one crowned with burrata",
    title: "Fired at 500°C.",
    body: "A blistered crust and a crown of burrata, served on the blue-and-white plates.",
    aside: "Pizza, pasta, and a candle on every table.",
    action: "menu" as "menu" | "book",
  },
  {
    src: "/images/angel/g5.jpg",
    alt: "A server carrying two pink bowls, wine glasses hooked between his fingers",
    title: "Stay for one more.",
    body: "Small plates keep coming, glasses hooked between fingers, the room getting warmer.",
    aside: "Dinner runs till midnight.",
    action: "book" as "menu" | "book",
  },
];

export const story = {
  line: "Wood-fired pizza at 500°C, pasta folded by hand, a candle on every table.",
};

// Photos placed around the centre, fading in as you scroll.
export const collage = {
  main: { src: "/images/angel/g1.jpg", alt: "A long table under a gingham cloth, one candle lit, linen curtains against old brick" },
  left: { src: "/images/angel/ig1.jpg", alt: "Spaghetti shared across a candlelit round table" },
  right: { src: "/images/angel/ig2.jpg", alt: "A full room under the haveli arches, friends laughing by candlelight" },
};

// Their latest Instagram posts, newest first, with their own captions. Swap for a live feed later.
export const posts = [
  { src: "/images/angel/ig1.jpg", caption: "The angel hears everything.", alt: "Spaghetti shared across a candlelit round table", reel: false },
  { src: "/images/angel/ig2.jpg", caption: "A celebration, a date, a catch-up, or just any other day. We'll take em all.", alt: "Friends laughing under the haveli arches", reel: true },
  { src: "/images/angel/ig3.jpg", caption: "This week at Angel's.", alt: "Tiramisu served beside a stone pillar by candlelight", reel: false },
  { src: "/images/angel/ig4.jpg", caption: "A lil Italian romance never hurt anybody.", alt: "Diners under the carved stucco ceiling and old brick", reel: true },
  { src: "/images/angel/ig5.jpg", caption: "Tres leches. Bring your floaties.", alt: "Tres leches with a little rubber duck on the plate", reel: true },
  { src: "/images/angel/ig6.jpg", caption: "500°C. Hotter than your situationship. Better outcome.", alt: "A log burning inside the wood-fired oven", reel: true },
];

// The haveli's courtyard. A stand-in from Bloom Hotels' gallery (they run the hotel in the haveli): swap for the team's own photo.
export const findPhoto = {
  src: "/images/angel/haveli.webp",
  alt: "The haveli's white courtyard: scalloped arches over three floors, green doors under stained-glass fanlights",
};

// The owners: a father and his daughter. Facts from public sources, Oct 2026: Instagram (Feedyou Jaipur's post co-authored by
// @sahar.saini and @ajay.saini67 as a "father-daughter business duo"), company filings (both are partners in Sunday Rose
// Boutique Homestays LLP), exchange4media (2006: Yo! China's director of operations and marketing), LinkedIn, Dineout Jaipur.
export const owners = {
  lede: "Angel is a father and a daughter, hosting the room themselves. They opened its doors in October 2026, inside a 290-year-old haveli.",
  card: { front: "/images/founders/sahar-saini/img.jpeg", back: "/images/angel/g1.jpg" },
  people: [
    {
      name: "Ajay Saini",
      role: "Co-founder, her father and business partner",
      // the "three days at the dishwasher" story is only in an auto-transcript of Dineout Jaipur's reel: left out until confirmed
      bio: [
        "Ajay co-founded the restaurant chain Yo! China in 2003 and ran its operations and marketing, then went on to build Sunday Rose, a set of boutique homestays.",
        "Two decades in, he's on the floor again, hosting next to his daughter. Angel is a father-daughter house: they opened it together and they run the room themselves.",
      ],
      quote: "",
      lead: "Two decades of restaurants, and now this one.",
      photo: null as string | null,
    },
    {
      name: "Sahar Saini",
      role: "Co-founder, the host",
      bio: [
        "Trained at EHL in Lausanne, with an early stint at a Michelin-starred restaurant in Tokyo. She is co-founder and COO of Good Room House, the hospitality house behind Angel, one of its first two restaurants.",
        "She lives right above it. Playful luxury, quirky design and hosting as a way of showing love: that's the room she builds.",
      ],
      quote: "Making sure guests feel hosted (not served).",
      lead: "",
      photo: "/images/founders/sahar-saini/img.jpeg" as string | null,
    },
  ],
};
