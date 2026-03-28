"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";

interface RoomForm {
  name: string;
  slug: string;
  description: string;
  personality: string;
  capacity: number;
  bed_type: string;
  size: string;
  amenities: string;
  images: string[];
  base_price_per_night: number;
  is_active: boolean;
  sort_order: number;
}

const empty: RoomForm = {
  name: "", slug: "", description: "", personality: "",
  capacity: 2, bed_type: "King", size: "", amenities: "",
  images: [], base_price_per_night: 0, is_active: true, sort_order: 0,
};

export default function AdminRoomEditPage() {
  const { id: propertyId, roomId } = useParams<{ id: string; roomId: string }>();
  const router = useRouter();
  const isNew = roomId === "new";

  const [form, setForm] = useState<RoomForm>(empty);
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const { data: prop } = await supabase.from("properties").select("name").eq("id", propertyId).single();
      if (prop) setPropertyName(prop.name);

      if (!isNew) {
        const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        if (data) {
          setForm({
            name: data.name, slug: data.slug, description: data.description,
            personality: data.personality, capacity: data.capacity, bed_type: data.bed_type,
            size: data.size, amenities: (data.amenities || []).join(", "),
            images: data.images || [], base_price_per_night: data.base_price_per_night,
            is_active: data.is_active, sort_order: data.sort_order,
          });
        }
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, roomId]);

  const set = (field: keyof RoomForm, value: string | string[] | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      property_id: propertyId,
      name: form.name,
      slug: form.slug,
      description: form.description,
      personality: form.personality,
      capacity: form.capacity,
      bed_type: form.bed_type,
      size: form.size,
      amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      images: form.images,
      base_price_per_night: form.base_price_per_night,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    if (isNew) {
      const { data, error } = await supabase.from("rooms").insert(payload).select().single();
      if (!error && data) {
        router.replace(`/admin/properties/${propertyId}/rooms/${data.id}`);
      }
    } else {
      await supabase.from("rooms").update(payload).eq("id", roomId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-sm text-text/30">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8 text-xs text-text/40">
        <Link href={`/admin/properties/${propertyId}/rooms`} className="hover:text-text">← {propertyName} / Rooms</Link>
        <span className="text-text/20">/</span>
        <h1 className="font-display text-2xl text-text">{isNew ? "New Room" : form.name}</h1>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required>
            <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="The Jharokha Suite" />
          </FormField>
          <FormField label="Slug" required>
            <AdminInput value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="jharokha-suite" />
          </FormField>
        </div>

        <FormField label="Description" required>
          <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Physical description of the room..." />
        </FormField>

        <FormField label="Personality" hint="The story/character — shown to guests">
          <AdminTextarea value={form.personality} onChange={(e) => set("personality", e.target.value)} rows={3} placeholder="For the one who..." />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Bed Type">
            <AdminSelect value={form.bed_type} onChange={(e) => set("bed_type", e.target.value)}>
              {["King", "Queen", "Twin", "Double"].map((b) => <option key={b}>{b}</option>)}
            </AdminSelect>
          </FormField>
          <FormField label="Capacity">
            <AdminInput type="number" min={1} max={10} value={form.capacity} onChange={(e) => set("capacity", parseInt(e.target.value))} />
          </FormField>
          <FormField label="Size" hint="e.g. 45 sqm">
            <AdminInput value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="45 sqm" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Base Price / Night (₹)" required>
            <AdminInput type="number" min={0} value={form.base_price_per_night} onChange={(e) => set("base_price_per_night", parseInt(e.target.value))} placeholder="10000" />
          </FormField>
          <FormField label="Sort Order" hint="Lower = first">
            <AdminInput type="number" min={0} value={form.sort_order} onChange={(e) => set("sort_order", parseInt(e.target.value))} />
          </FormField>
        </div>

        <FormField label="Amenities" hint="Comma-separated list">
          <AdminInput value={form.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="King Bed, Rain Shower, Smart TV, ..." />
        </FormField>

        <FormField label="Images">
          <ImageUploader
            bucket="room-images"
            folder={form.slug || "room"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </FormField>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => set("is_active", !form.is_active)}
              className={`w-4 h-4 border flex items-center justify-center transition-all ${form.is_active ? "border-accent-gold bg-accent-gold" : "border-border-subtle"}`}
            >
              {form.is_active && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className="text-xs text-text/60">Active (visible on website)</span>
          </label>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : isNew ? "Create Room" : "Save Changes"}
          </button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
