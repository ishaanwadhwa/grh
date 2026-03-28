"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import RoomCard from "@/components/ui/RoomCard";
import SectionDivider from "@/components/ui/SectionDivider";
import type { Property, Room } from "@/lib/data/schema";
import { useBookingFlow } from "@/hooks/useBookingFlow";

export default function PropertyPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const booking = useBookingFlow();

  const [property, setProperty] = useState<Property | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Load property data
  useEffect(() => {
    async function load() {
      // Using mock data via import for now (could be API call)
      const { fetchPropertyBySlug, fetchRoomsByPropertyId } = await import("@/lib/supabase/browser-queries");
      const prop = await fetchPropertyBySlug(slug);
      if (prop) {
        setProperty(prop);
        const allRooms = await fetchRoomsByPropertyId(prop.id);
        setAvailableRooms(allRooms);
        booking.setProperty(slug);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const checkAvailability = async () => {
    if (!booking.checkIn || !booking.checkOut || !property) return;

    setCheckingAvailability(true);
    const res = await fetch(
      `/api/availability?property=${slug}&checkIn=${booking.checkIn}&checkOut=${booking.checkOut}`
    );
    const data = await res.json();
    setAvailableRooms(data.availableRooms || []);
    setHasChecked(true);
    setCheckingAvailability(false);
  };

  const handleRoomSelect = (room: Room) => {
    booking.selectRoom(room);
  };

  const handleContinue = () => {
    if (booking.selectedRoom && booking.checkIn && booking.checkOut) {
      router.push(
        `/book?property=${slug}&checkIn=${booking.checkIn}&checkOut=${booking.checkOut}&room=${booking.selectedRoom.id}`
      );
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <p className="text-text-inverse/30 text-sm tracking-widest uppercase">Loading...</p>
        </main>
      </>
    );
  }

  if (!property) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <p className="text-text-inverse/50">Property not found.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark pt-24 pb-16">
        {/* Hero */}
        <section className="relative h-[50vh] md:h-[60vh] bg-primary flex items-end overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/40 to-transparent" />
          <div className="relative z-10 mx-auto max-w-6xl px-6 pb-12 w-full">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-3"
            >
              {property.location}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-6xl text-text-inverse"
            >
              {property.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-4 text-base text-text-inverse/50 max-w-2xl"
            >
              {property.tagline}
            </motion.p>
          </div>
        </section>

        {/* About */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-base md:text-lg leading-relaxed text-text-inverse/50 max-w-3xl"
          >
            {property.description}
          </motion.p>

          {/* Amenities */}
          <div className="mt-10 flex flex-wrap gap-3">
            {property.amenities.map((amenity) => (
              <span
                key={amenity}
                className="border border-accent-gold/15 px-4 py-2 text-xs uppercase tracking-wider text-text-inverse/40"
              >
                {amenity}
              </span>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* Date Selection */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="font-display text-2xl md:text-3xl text-text-inverse mb-8">
            Select Your Dates
          </h2>

          <div className="max-w-xl">
            <DatePicker
              checkIn={booking.checkIn}
              checkOut={booking.checkOut}
              onCheckInChange={(d) => booking.setDates(d, booking.checkOut)}
              onCheckOutChange={(d) => booking.setDates(booking.checkIn, d)}
            />

            <div className="mt-6">
              <Button
                onClick={checkAvailability}
                variant="secondary"
                className={
                  !booking.checkIn || !booking.checkOut ? "opacity-30 pointer-events-none" : ""
                }
              >
                {checkingAvailability ? "Checking..." : "Check Availability"}
              </Button>
            </div>
          </div>
        </section>

        <SectionDivider />

        {/* Rooms */}
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="font-display text-2xl md:text-3xl text-text-inverse mb-4">
            {hasChecked ? "Available Rooms" : "Our Rooms"}
          </h2>
          {hasChecked && (
            <p className="text-sm text-text-inverse/40 mb-8">
              {availableRooms.length} room{availableRooms.length !== 1 ? "s" : ""} available for{" "}
              {booking.checkIn} to {booking.checkOut}
            </p>
          )}
          {!hasChecked && (
            <p className="text-sm text-text-inverse/40 mb-8">
              Select dates above to check availability and see pricing.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isSelected={booking.selectedRoom?.id === room.id}
                onSelect={handleRoomSelect}
              />
            ))}
          </div>

          {availableRooms.length === 0 && hasChecked && (
            <p className="text-text-inverse/40 text-center py-12">
              No rooms available for these dates. Try different dates.
            </p>
          )}

          {/* Continue button */}
          {booking.selectedRoom && hasChecked && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 text-center"
            >
              <Button onClick={handleContinue} variant="primary" size="lg">
                Continue with {booking.selectedRoom.name}
              </Button>
            </motion.div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
