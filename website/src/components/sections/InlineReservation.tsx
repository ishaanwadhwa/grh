"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import SingleDatePicker from "@/components/ui/SingleDatePicker";
import TimePicker from "@/components/ui/TimePicker";
import GuestCounter from "@/components/ui/GuestCounter";
import PhoneInput from "@/components/ui/PhoneInput";

interface InlineReservationProps {
  restaurantSlug: string;
  restaurantName: string;
}

type Step = "form" | "details" | "confirmed";

export default function InlineReservation({
  restaurantSlug,
  restaurantName,
}: InlineReservationProps) {
  const [step, setStep] = useState<Step>("form");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isWhatsApp, setIsWhatsApp] = useState(true);
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");

  const canProceed = date && time;
  const canSubmit = guestName.trim() && guestEmail.trim();

  const handleSubmit = async () => {
    setSubmitting(true);

    // TODO: Wire to real backend — currently hits mock API
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          date,
          time,
          partySize,
          guestName,
          guestEmail,
          specialRequests: specialRequests || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setConfirmationId(data.reservation.id);
        setStep("confirmed");
      }
    } catch {
      // Fail silently for now
    }
    setSubmitting(false);
  };

  const reset = () => {
    setStep("form");
    setDate("");
    setTime("");
    setPartySize(2);
    setGuestName("");
    setGuestEmail("");
    setSpecialRequests("");
    setConfirmationId("");
  };

  return (
    <div className="border border-accent-gold/15 bg-primary/50">
      {/* Header */}
      <div className="px-6 py-5 border-b border-accent-gold/10">
        <h3 className="text-xs uppercase tracking-widest text-accent-gold/60 font-body font-medium">
          Reserve a Table
        </h3>
        <p className="mt-1 font-display text-lg text-text-inverse">
          {restaurantName}
        </p>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Date, time, party size */}
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Date */}
              <SingleDatePicker
                value={date}
                onChange={setDate}
                label="Date"
                placeholder="Select date"
              />

              {/* Time */}
              <TimePicker value={time} onChange={setTime} />

              {/* Party size */}
              <GuestCounter value={partySize} max={12} onChange={setPartySize} />

              {/* Proceed */}
              <div className="pt-2">
                <Button
                  onClick={() => setStep("details")}
                  variant="primary"
                  className={`w-full justify-center ${!canProceed ? "opacity-30 pointer-events-none" : ""}`}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Guest details */}
          {step === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Summary bar */}
              <div className="flex flex-wrap gap-3 text-xs text-text-inverse/40 pb-4 border-b border-accent-gold/10">
                <span>{new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span>&middot;</span>
                <span>{time}</span>
                <span>&middot;</span>
                <span>{partySize} {partySize === 1 ? "guest" : "guests"}</span>
                <button
                  onClick={() => setStep("form")}
                  className="ml-auto text-accent-gold/50 hover:text-accent-gold transition-colors"
                >
                  Edit
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-accent-gold/50 font-body font-medium mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-accent-gold/50 font-body font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
                />
              </div>

              {/* Phone */}
              <PhoneInput
                phoneCode={phoneCode}
                phoneNumber={phoneNumber}
                isWhatsApp={isWhatsApp}
                onPhoneCodeChange={setPhoneCode}
                onPhoneNumberChange={setPhoneNumber}
                onWhatsAppChange={setIsWhatsApp}
              />

              {/* Special requests */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-accent-gold/50 font-body font-medium mb-2">
                  Special Requests <span className="opacity-50">(optional)</span>
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Dietary needs, occasion, seating..."
                  rows={2}
                  className="w-full bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button onClick={() => setStep("form")} variant="ghost">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  variant="primary"
                  className={`flex-1 justify-center ${!canSubmit || submitting ? "opacity-30 pointer-events-none" : ""}`}
                >
                  {submitting ? "Reserving..." : "Confirm Reservation"}
                </Button>
              </div>

              <p className="text-[10px] text-text-inverse/15 text-center">
                No payment required. Free cancellation up to 2 hours before.
              </p>
            </motion.div>
          )}

          {/* Step 3: Confirmed */}
          {step === "confirmed" && (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-4"
            >
              <div className="w-12 h-12 mx-auto border border-accent-gold/30 flex items-center justify-center mb-4">
                <span className="text-accent-gold text-lg">✓</span>
              </div>

              <p className="font-display text-xl text-text-inverse mb-1">
                Table Reserved
              </p>
              <p className="text-sm text-text-inverse/40 mb-4">
                See you at {restaurantName}.
              </p>

              {confirmationId && (
                <p className="text-xs text-accent-gold/50 font-mono mb-6">
                  Ref: {confirmationId}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-text-inverse/30 justify-center mb-6">
                <span>
                  {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span>&middot;</span>
                <span>{time}</span>
                <span>&middot;</span>
                <span>{partySize} {partySize === 1 ? "guest" : "guests"}</span>
              </div>

              <Button onClick={reset} variant="ghost" size="sm">
                Make Another Reservation
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
