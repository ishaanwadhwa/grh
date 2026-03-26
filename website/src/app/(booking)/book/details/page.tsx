"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";
import GuestCounter from "@/components/ui/GuestCounter";
import PhoneInput from "@/components/ui/PhoneInput";
import BookingSummary from "@/components/ui/BookingSummary";
import { useBookingFlow } from "@/hooks/useBookingFlow";

export default function BookDetailsPage() {
  const router = useRouter();
  const booking = useBookingFlow();

  if (!booking.isHydrated) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <p className="text-text-inverse/30 text-sm tracking-widest uppercase">Loading...</p>
        </main>
      </>
    );
  }

  if (!booking.selectedRoom || !booking.pricing) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-primary-dark flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-inverse/50 mb-4">Please select a room first.</p>
            <Button href="/properties/jaipur" variant="secondary">
              Browse Properties
            </Button>
          </div>
        </main>
      </>
    );
  }

  const canContinue = booking.guestName.trim() && booking.guestEmail.trim();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-primary-dark pt-28 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-accent-gold/70 font-body font-medium mb-4">
              Step 2 of 4
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-text-inverse">
              Guest Details
            </h1>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Form */}
            <div className="lg:col-span-2 space-y-8">
              {/* Guest count */}
              <GuestCounter
                value={booking.guests}
                max={booking.selectedRoom.capacity}
                onChange={booking.setGuests}
              />

              {/* Name */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={booking.guestName}
                  onChange={(e) =>
                    booking.setGuestDetails({
                      guestName: e.target.value,
                      guestEmail: booking.guestEmail,
                      phoneCode: booking.phoneCode,
                      phoneNumber: booking.phoneNumber,
                      isWhatsApp: booking.isWhatsApp,
                      specialRequests: booking.specialRequests,
                    })
                  }
                  placeholder="Your full name"
                  className="w-full max-w-md bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={booking.guestEmail}
                  onChange={(e) =>
                    booking.setGuestDetails({
                      guestName: booking.guestName,
                      guestEmail: e.target.value,
                      phoneCode: booking.phoneCode,
                      phoneNumber: booking.phoneNumber,
                      isWhatsApp: booking.isWhatsApp,
                      specialRequests: booking.specialRequests,
                    })
                  }
                  placeholder="your@email.com"
                  className="w-full max-w-md bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                />
              </div>

              {/* Phone */}
              <div className="max-w-md">
                <PhoneInput
                  phoneCode={booking.phoneCode}
                  phoneNumber={booking.phoneNumber}
                  isWhatsApp={booking.isWhatsApp}
                  onPhoneCodeChange={(code) =>
                    booking.setGuestDetails({
                      guestName: booking.guestName,
                      guestEmail: booking.guestEmail,
                      phoneCode: code,
                      phoneNumber: booking.phoneNumber,
                      isWhatsApp: booking.isWhatsApp,
                      specialRequests: booking.specialRequests,
                    })
                  }
                  onPhoneNumberChange={(num) =>
                    booking.setGuestDetails({
                      guestName: booking.guestName,
                      guestEmail: booking.guestEmail,
                      phoneCode: booking.phoneCode,
                      phoneNumber: num,
                      isWhatsApp: booking.isWhatsApp,
                      specialRequests: booking.specialRequests,
                    })
                  }
                  onWhatsAppChange={(wa) =>
                    booking.setGuestDetails({
                      guestName: booking.guestName,
                      guestEmail: booking.guestEmail,
                      phoneCode: booking.phoneCode,
                      phoneNumber: booking.phoneNumber,
                      isWhatsApp: wa,
                      specialRequests: booking.specialRequests,
                    })
                  }
                />
              </div>

              {/* Special requests */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium mb-2">
                  Special Requests <span className="opacity-50">(optional)</span>
                </label>
                <textarea
                  value={booking.specialRequests}
                  onChange={(e) =>
                    booking.setGuestDetails({
                      guestName: booking.guestName,
                      guestEmail: booking.guestEmail,
                      phoneCode: booking.phoneCode,
                      phoneNumber: booking.phoneNumber,
                      isWhatsApp: booking.isWhatsApp,
                      specialRequests: e.target.value,
                    })
                  }
                  placeholder="Early check-in, extra pillows, dietary needs..."
                  rows={3}
                  className="w-full max-w-md bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors resize-none"
                />
              </div>

              {/* Navigation */}
              <div className="flex gap-4 pt-4">
                <Button onClick={() => router.back()} variant="ghost">
                  &larr; Back
                </Button>
                <Button
                  onClick={() => router.push("/book/review")}
                  variant="primary"
                  className={!canContinue ? "opacity-30 pointer-events-none" : ""}
                >
                  Review Booking
                </Button>
              </div>
            </div>

            {/* Summary sidebar */}
            <div className="lg:col-span-1">
              <BookingSummary
                room={booking.selectedRoom}
                pricing={booking.pricing}
                guests={booking.guests}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
