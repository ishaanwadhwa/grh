"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Chevron, Empty, fmtMoney, Loading, StatusTag, TabsHeader, useNotice } from "@/components/admin/ui";

interface RoomRow {
  id: string;
  name: string;
  slug: string;
  bed_type: string;
  capacity: number;
  base_price_per_night: number;
  is_active: boolean;
  sort_order: number;
}

export default function AdminRoomsPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const [rooms, setRooms] = useState<RoomRow[]>(); // stays unset if the load fails
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(true);
  const { fail, snackbar } = useNotice();

  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      supabase.from("properties").select("name").eq("id", propertyId).single(),
      supabase
        .from("rooms")
        .select("id, name, slug, bed_type, capacity, base_price_per_night, is_active, sort_order")
        .eq("property_id", propertyId)
        .order("sort_order"),
    ]).then(([prop, roomsRes]) => {
      if (prop.data) setPropertyName(prop.data.name);
      if (roomsRes.error) fail(roomsRes.error);
      else setRooms(roomsRes.data);
      setLoading(false);
    });
  }, [supabase, propertyId, fail]);

  return (
    <div className="page">
      <TabsHeader
        back={{ href: `/admin/properties/${propertyId}`, label: propertyName || "Property" }}
        title="Rooms"
        tabs={[{ label: "Details", href: `/admin/properties/${propertyId}` }, { label: "Rooms", href: `/admin/properties/${propertyId}/rooms` }]}
        current={`/admin/properties/${propertyId}/rooms`}
        actions={<Link href={`/admin/properties/${propertyId}/rooms/new`} className="btn btn-primary">Add room</Link>}
      />

      {loading ? (
        <Loading />
      ) : rooms && (rooms.length === 0 ? (
        <Empty title="No rooms yet" sub="Add a room so guests can book a stay here." />
      ) : (
        <div className="card flush rows">
          {rooms.map((room) => (
            <Link key={room.id} href={`/admin/properties/${propertyId}/rooms/${room.id}`} className="row">
              <div className="row-main">
                <p className="row-title">{room.name}</p>
                <p className="row-sub">Sleeps {room.capacity} · {room.bed_type} bed · {fmtMoney(room.base_price_per_night)} a night</p>
              </div>
              <StatusTag status={room.is_active ? "active" : "hidden"} />
              <Chevron />
            </Link>
          ))}
        </div>
      ))}
      {snackbar}
    </div>
  );
}
