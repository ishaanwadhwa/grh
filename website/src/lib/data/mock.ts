import type { Property, Room, Restaurant, Booking, Reservation } from "./schema";

// ============================================
// MOCK DATA — Good Room House, Jaipur
// ============================================

// --- Properties ---

export const properties: Property[] = [
  {
    id: "prop-jaipur",
    name: "Good Room House Jaipur",
    slug: "jaipur",
    location: "Walled City, Jaipur, Rajasthan",
    tagline: "A 300-Year-Old Haveli. Reborn.",
    description:
      "Nestled inside Jaipur's UNESCO-listed Walled City, Good Room House Jaipur lives within Sitaram Bhawan — a nearly 300-year-old haveli on Munshi Ramdas Ji Ka Rasta, near Ganga Pole, one of the original gateways to the Pink City. Once home to a Mathur Kayastha family of royal scribes, the haveli has been painstakingly restored over two years — original frescoed walls, hand-carved stone brackets, ornate jharokhas, and sunlit courtyards brought back to life, layer by layer. The result is a place where Mughal-Rajput architecture meets modern design sensibility. Every room is a quiet ode to heritage — softly lit, dressed in handcrafted details, with warm terracottas, soft creams, and touches of indigo inspired by Jaipur's sky.",
    amenities: [
      "Heritage Courtyard",
      "Rooftop Lounge with Fort Views",
      "Complimentary Breakfast",
      "Elevator Access",
      "Wi-Fi",
      "Curated Experiences",
      "Private Dining",
      "Walking Distance to Hawa Mahal & City Palace",
    ],
    images: [],
    restaurantIds: ["rest-angels", "rest-goodroom"],
    coordinates: { lat: 26.9239, lng: 75.8267 },
  },
];

// --- Rooms ---

export const rooms: Room[] = [
  {
    id: "room-001",
    propertyId: "prop-jaipur",
    name: "The Jharokha Suite",
    slug: "jharokha-suite",
    description:
      "The signature suite. Ornate jharokha windows frame the old city, hand-painted frescoes line the walls, and a private sitting area opens onto the courtyard below.",
    personality:
      "For the one who understands that heritage is not decoration — it's a feeling. This room is Jaipur distilled. Three centuries of stories in the stonework, and you get to sleep inside one.",
    capacity: 3,
    bedType: "King",
    size: "65 sqm",
    amenities: [
      "Jharokha Windows",
      "Original Frescoed Walls",
      "Private Sitting Area",
      "Bathtub",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
      "Curated Tea Corner",
    ],
    images: [],
    basePricePerNight: 15000,
  },
  {
    id: "room-002",
    propertyId: "prop-jaipur",
    name: "The Nahargarh Room",
    slug: "nahargarh-room",
    description:
      "Upper-floor heritage room with a private balcony offering sweeping views of Nahargarh Fort and the Aravalli hills. Warm terracotta tones meet indigo block prints.",
    personality:
      "For the one who likes a view with their evening chai. Sunsets here are not optional — they're the whole point. Watch the fort glow amber while the city hums below.",
    capacity: 2,
    bedType: "King",
    size: "42 sqm",
    amenities: [
      "Fort View Balcony",
      "Rajasthani Block Prints",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
      "Writing Desk",
    ],
    images: [],
    basePricePerNight: 11000,
  },
  {
    id: "room-003",
    propertyId: "prop-jaipur",
    name: "The Courtyard Room",
    slug: "courtyard-room",
    description:
      "A ground-floor room that opens directly onto the central sunlit courtyard — the heart of the haveli. Hand-carved wooden doors, lime plaster walls, and the sound of birds.",
    personality:
      "For the one who wakes up slow. Morning light through arched doorways, stone floors warm underfoot, chai in the courtyard before anyone else is up. This room doesn't rush you.",
    capacity: 2,
    bedType: "King",
    size: "45 sqm",
    amenities: [
      "Direct Courtyard Access",
      "Hand-carved Wooden Doors",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
      "Patio Seating",
    ],
    images: [],
    basePricePerNight: 10000,
  },
  {
    id: "room-004",
    propertyId: "prop-jaipur",
    name: "The Fresco Room",
    slug: "fresco-room",
    description:
      "A jewel of a room where original 300-year-old frescoes have been painstakingly restored. Every wall tells a story in pigment and plaster.",
    personality:
      "For the one who doesn't need a museum — they'd rather sleep in one. The walls here have seen more history than most cities. You're just the latest chapter.",
    capacity: 2,
    bedType: "Queen",
    size: "38 sqm",
    amenities: [
      "Original Restored Frescoes",
      "Antique Furnishings",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
      "Curated Tea Corner",
    ],
    images: [],
    basePricePerNight: 9500,
  },
  {
    id: "room-005",
    propertyId: "prop-jaipur",
    name: "The Rooftop Suite",
    slug: "rooftop-suite",
    description:
      "A private suite on the top floor with direct access to the rooftop lounge. Panoramic views of the Walled City skyline, Nahargarh Fort, and the distant Aravallis.",
    personality:
      "For the one who stays up late. Dinner downstairs, nightcap on the roof with the whole Pink City spread out like a map. You'll understand why poets kept coming back.",
    capacity: 2,
    bedType: "King",
    size: "55 sqm",
    amenities: [
      "Rooftop Access",
      "Panoramic City Views",
      "Sitting Area",
      "Bathtub",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
    ],
    images: [],
    basePricePerNight: 14000,
  },
  {
    id: "room-006",
    propertyId: "prop-jaipur",
    name: "The Indigo Room",
    slug: "indigo-room",
    description:
      "A compact, beautifully detailed room washed in the deep indigo tones inspired by Jaipur's twilight sky. Handwoven textiles, brass fixtures, and stone bracket detailing.",
    personality:
      "For the one who knows luxury isn't about size — it's about intention. Every detail here was chosen, not placed. The blue is the same shade the sky turns at 6:47 PM in October.",
    capacity: 2,
    bedType: "Queen",
    size: "30 sqm",
    amenities: [
      "Indigo Textile Accents",
      "Brass Fixtures",
      "Stone Brackets",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
    ],
    images: [],
    basePricePerNight: 7000,
  },
  {
    id: "room-007",
    propertyId: "prop-jaipur",
    name: "The Terracotta Room",
    slug: "terracotta-room",
    description:
      "Warm terracotta walls, soft cream linens, and Rajasthani block-printed cushions. A balcony looks out over the narrow lanes of the Walled City.",
    personality:
      "For the one who wants to feel Jaipur, not just see it. Open the window and the city comes in — the call to prayer, the chai-wallah's whistle, the pink haze of morning dust.",
    capacity: 2,
    bedType: "King",
    size: "36 sqm",
    amenities: [
      "Walled City View Balcony",
      "Block-printed Textiles",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
    ],
    images: [],
    basePricePerNight: 8000,
  },
  {
    id: "room-008",
    propertyId: "prop-jaipur",
    name: "The Twin Heritage Room",
    slug: "twin-heritage-room",
    description:
      "A classic twin room designed for friends or family. Two beds set against restored lime plaster walls, with handcrafted furniture and soft lighting throughout.",
    personality:
      "For the ones who travel together but still want their own bed. Same heritage, same craft, twice the conversation. Ideal for the duo who came for Jaipur but stayed for each other's company.",
    capacity: 2,
    bedType: "Twin",
    size: "34 sqm",
    amenities: [
      "Twin Beds",
      "Lime Plaster Walls",
      "Handcrafted Furniture",
      "Rain Shower",
      "50\" Smart TV",
      "Climate Control",
    ],
    images: [],
    basePricePerNight: 7500,
  },
];

// --- Restaurants ---

export const restaurants: Restaurant[] = [
  {
    id: "rest-angels",
    propertyId: "prop-jaipur",
    name: "Angels & Searchers",
    slug: "angels-and-searchers",
    cuisine: "Modern Indian",
    description:
      "Chef-driven, not pretentious. Where the menu, music, and crowd become one experience. A place that takes Indian food seriously without taking itself seriously.",
    vibe: "Warm lighting, curated playlists, open kitchen energy. The kind of place where strangers end up sharing a table — and a bottle.",
    hours: "12:00 PM – 11:00 PM",
    images: [],
  },
  {
    id: "rest-goodroom",
    propertyId: "prop-jaipur",
    name: "Good Room",
    slug: "good-room",
    cuisine: "Global Small Plates",
    description:
      "Social dining at its finest. High aesthetic value, visually viral, but never try-hard. A place designed for sharing — food, stories, and evenings.",
    vibe: "Moody interiors, candlelit corners, a bar that knows your second drink before you do. Not a restaurant — an atmosphere.",
    hours: "6:00 PM – 1:00 AM",
    images: ["/images/restaurants/restaurant-two/jaipurimg1.png"],
  },
];

// --- In-memory booking store (simulates database) ---

export const bookings: Booking[] = [];
export const reservations: Reservation[] = [];

// --- Helper functions ---

export function getPropertyBySlug(slug: string): Property | undefined {
  return properties.find((p) => p.slug === slug);
}

export function getRoomsByPropertyId(propertyId: string): Room[] {
  return rooms.filter((r) => r.propertyId === propertyId);
}

export function getRoomById(roomId: string): Room | undefined {
  return rooms.find((r) => r.id === roomId);
}

export function getRestaurantBySlug(slug: string): Restaurant | undefined {
  return restaurants.find((r) => r.slug === slug);
}

export function getRestaurantsByPropertyId(propertyId: string): Restaurant[] {
  return restaurants.filter((r) => r.propertyId === propertyId);
}

export function isRoomAvailable(roomId: string, checkIn: string, checkOut: string): boolean {
  return !bookings.some(
    (b) =>
      b.roomId === roomId &&
      b.status !== "cancelled" &&
      b.checkIn < checkOut &&
      b.checkOut > checkIn
  );
}

export function getAvailableRooms(propertyId: string, checkIn: string, checkOut: string): Room[] {
  const propertyRooms = getRoomsByPropertyId(propertyId);
  return propertyRooms.filter((room) => isRoomAvailable(room.id, checkIn, checkOut));
}
