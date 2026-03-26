"use client";

import { useState, useCallback, useEffect } from "react";
import type { Room, Currency, PricingResponse } from "@/lib/data/schema";

interface BookingFlowState {
  propertySlug: string;
  checkIn: string;
  checkOut: string;
  selectedRoom: Room | null;
  guests: number;
  currency: Currency;
  pricing: PricingResponse | null;
  guestName: string;
  guestEmail: string;
  phoneCode: string;
  phoneNumber: string;
  isWhatsApp: boolean;
  specialRequests: string;
}

const STORAGE_KEY = "grh-booking-flow";

const defaultState: BookingFlowState = {
  propertySlug: "",
  checkIn: "",
  checkOut: "",
  selectedRoom: null,
  guests: 1,
  currency: "INR",
  pricing: null,
  guestName: "",
  guestEmail: "",
  phoneCode: "+91",
  phoneNumber: "",
  isWhatsApp: true,
  specialRequests: "",
};

function loadState(): BookingFlowState {
  if (typeof window === "undefined") return defaultState;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return defaultState;
}

function saveState(state: BookingFlowState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function useBookingFlow() {
  const [state, setState] = useState<BookingFlowState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    setState(loadState());
    setIsHydrated(true);
  }, []);

  // Save to sessionStorage on every change
  useEffect(() => {
    if (isHydrated) saveState(state);
  }, [state, isHydrated]);

  const setDates = useCallback((checkIn: string, checkOut: string) => {
    setState((prev) => ({
      ...prev,
      checkIn,
      checkOut,
      selectedRoom: null,
      pricing: null, // reset pricing when dates change
    }));
  }, []);

  const setProperty = useCallback((propertySlug: string) => {
    setState((prev) => ({ ...prev, propertySlug }));
  }, []);

  const selectRoom = useCallback((room: Room) => {
    setState((prev) => ({ ...prev, selectedRoom: room, pricing: null }));
  }, []);

  const setPricing = useCallback((pricing: PricingResponse) => {
    setState((prev) => ({ ...prev, pricing }));
  }, []);

  const setGuests = useCallback((guests: number) => {
    setState((prev) => ({ ...prev, guests }));
  }, []);

  const setCurrency = useCallback((currency: Currency) => {
    setState((prev) => ({ ...prev, currency, pricing: null })); // re-fetch pricing on currency change
  }, []);

  const setGuestDetails = useCallback(
    (details: {
      guestName: string;
      guestEmail: string;
      phoneCode: string;
      phoneNumber: string;
      isWhatsApp: boolean;
      specialRequests: string;
    }) => {
      setState((prev) => ({ ...prev, ...details }));
    },
    []
  );

  const reset = useCallback(() => {
    setState(defaultState);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Fetch pricing from API
  const fetchPricing = useCallback(async () => {
    if (!state.selectedRoom || !state.checkIn || !state.checkOut) return null;

    const res = await fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: state.selectedRoom.id,
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        currency: state.currency,
        guestCount: state.guests,
      }),
    });

    if (!res.ok) return null;

    const pricing: PricingResponse = await res.json();
    setState((prev) => ({ ...prev, pricing }));
    return pricing;
  }, [state.selectedRoom, state.checkIn, state.checkOut, state.currency, state.guests]);

  return {
    ...state,
    isHydrated,
    setDates,
    setProperty,
    selectRoom,
    setPricing,
    setGuests,
    setCurrency,
    setGuestDetails,
    fetchPricing,
    reset,
  };
}
