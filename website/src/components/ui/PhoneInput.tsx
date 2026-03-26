"use client";

import { useState, useRef, useEffect } from "react";

const COUNTRY_CODES = [
  { code: "+91", country: "IN", flag: "🇮🇳" },
  { code: "+1", country: "US", flag: "🇺🇸" },
  { code: "+44", country: "GB", flag: "🇬🇧" },
  { code: "+971", country: "AE", flag: "🇦🇪" },
  { code: "+65", country: "SG", flag: "🇸🇬" },
  { code: "+61", country: "AU", flag: "🇦🇺" },
  { code: "+49", country: "DE", flag: "🇩🇪" },
  { code: "+33", country: "FR", flag: "🇫🇷" },
  { code: "+81", country: "JP", flag: "🇯🇵" },
  { code: "+86", country: "CN", flag: "🇨🇳" },
];

interface PhoneInputProps {
  phoneCode: string;
  phoneNumber: string;
  isWhatsApp: boolean;
  onPhoneCodeChange: (code: string) => void;
  onPhoneNumberChange: (number: string) => void;
  onWhatsAppChange: (isWhatsApp: boolean) => void;
}

export default function PhoneInput({
  phoneCode,
  phoneNumber,
  isWhatsApp,
  onPhoneCodeChange,
  onPhoneNumberChange,
  onWhatsAppChange,
}: PhoneInputProps) {
  const [codeOpen, setCodeOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setCodeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = COUNTRY_CODES.find((c) => c.code === phoneCode) || COUNTRY_CODES[0];

  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-accent-gold/50 font-body font-medium mb-2">
        Phone Number
      </label>

      <div className="flex gap-0">
        {/* Country code selector */}
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setCodeOpen(!codeOpen)}
            className={`h-full border border-r-0 px-3 py-3 text-sm font-body flex items-center gap-1.5 transition-all duration-200 min-w-[90px] ${
              codeOpen
                ? "border-accent-gold/50 bg-accent-gold/5"
                : "border-accent-gold/20 hover:border-accent-gold/35"
            }`}
          >
            <span className="text-base">{selected.flag}</span>
            <span className="text-text-inverse/70 text-xs">{selected.code}</span>
            <span className="text-text-inverse/20 text-[10px] ml-auto">▾</span>
          </button>

          {codeOpen && (
            <div className="absolute z-50 mt-1 left-0 w-[200px] border border-accent-gold/20 bg-primary-dark shadow-deep max-h-[240px] overflow-y-auto">
              {COUNTRY_CODES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onPhoneCodeChange(c.code);
                    setCodeOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-body flex items-center gap-3 transition-colors ${
                    phoneCode === c.code
                      ? "bg-accent-gold/10 text-accent-gold"
                      : "text-text-inverse/60 hover:bg-accent-gold/5"
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span>{c.code}</span>
                  <span className="text-text-inverse/25 text-xs ml-auto">{c.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phone number input */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Phone number"
          className="flex-1 bg-transparent border border-accent-gold/20 px-4 py-3 text-sm text-text-inverse font-body placeholder:text-text-inverse/20 focus:outline-none focus:border-accent-gold/50 transition-colors"
        />
      </div>

      {/* WhatsApp checkbox */}
      <label className="mt-3 flex items-center gap-3 cursor-pointer group">
        <div
          className={`w-4 h-4 border flex items-center justify-center transition-all duration-200 ${
            isWhatsApp
              ? "border-accent-gold bg-accent-gold"
              : "border-accent-gold/30 group-hover:border-accent-gold/50"
          }`}
        >
          {isWhatsApp && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-primary-dark">
              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <input
          type="checkbox"
          checked={isWhatsApp}
          onChange={(e) => onWhatsAppChange(e.target.checked)}
          className="sr-only"
        />
        <span className="text-xs text-text-inverse/40 font-body">
          This is also my WhatsApp number
        </span>
      </label>
    </div>
  );
}
