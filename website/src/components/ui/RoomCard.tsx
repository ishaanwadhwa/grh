"use client";

import Image from "next/image";
import type { Room } from "@/lib/data/schema";

interface RoomCardProps {
  room: Room;
  isSelected?: boolean;
  onSelect: (room: Room) => void;
}

export default function RoomCard({ room, isSelected, onSelect }: RoomCardProps) {
  return (
    <button
      onClick={() => onSelect(room)}
      className={`w-full text-left border transition-all duration-300 group ${
        isSelected
          ? "border-accent-gold bg-accent-gold/5"
          : "border-accent-gold/10 hover:border-accent-gold/30"
      }`}
    >
      {/* Image */}
      <div className="aspect-[16/9] bg-primary-light/20 relative overflow-hidden">
        {room.images.length > 0 ? (
          <Image
            src={room.images[0]}
            alt={room.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-accent-gold/20 text-xs tracking-widest uppercase">
              {room.name}
            </p>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-5 md:p-6">
        <h3 className="font-display text-lg md:text-xl text-text-inverse group-hover:text-accent-gold transition-colors duration-300">
          {room.name}
        </h3>

        <p className="mt-2 text-sm text-text-inverse/40 leading-relaxed line-clamp-2">
          {room.personality}
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-inverse/30">
          <span className="border border-accent-gold/10 px-2 py-1">
            {room.bedType}
          </span>
          <span className="border border-accent-gold/10 px-2 py-1">
            {room.size}
          </span>
          <span className="border border-accent-gold/10 px-2 py-1">
            Up to {room.capacity} guests
          </span>
        </div>

        {isSelected && (
          <div className="mt-4 text-xs text-accent-gold uppercase tracking-widest font-medium">
            Selected
          </div>
        )}
      </div>
    </button>
  );
}
