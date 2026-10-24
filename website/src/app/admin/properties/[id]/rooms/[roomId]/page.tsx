"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { Empty, fmtMoney, Loading, PageHeader, Stepper, SwitchRow, slugify, useNotice } from "@/components/admin/ui";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { say, fail, snackbar } = useNotice();
  const [missing, setMissing] = useState(false); // a failed load must never become a blank form you can save over

  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      supabase.from("properties").select("name").eq("id", propertyId).single(),
      isNew ? null : supabase.from("rooms").select("*").eq("id", roomId).single(),
    ]).then(([prop, room]) => {
      if (prop.data) setPropertyName(prop.data.name);
      const data = room?.data;
      if (data) {
        setForm({
          name: data.name, slug: data.slug, description: data.description,
          personality: data.personality, capacity: data.capacity, bed_type: data.bed_type,
          size: data.size, amenities: (data.amenities || []).join(", "),
          images: data.images || [], base_price_per_night: data.base_price_per_night,
          is_active: data.is_active, sort_order: data.sort_order,
        });
      } else if (room) {
        setMissing(true);
        if (room.error) fail(room.error);
      }
      setLoading(false);
    });
  }, [supabase, propertyId, roomId, isNew, fail]);

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
      if (error) fail(error);
      else router.replace(`/admin/properties/${propertyId}/rooms/${data.id}`);
    } else {
      const { error } = await supabase.from("rooms").update(payload).eq("id", roomId);
      if (error) fail(error);
      else say("Changes saved");
    }
    setSaving(false);
  };

  // A room with bookings can't be deleted (bookings.room_id has no ON DELETE).
  const handleDelete = async () => {
    setConfirmDelete(false);
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) fail(error);
    else router.replace(`/admin/properties/${propertyId}/rooms`);
  };

  if (loading) return <Loading />;
  if (missing) return <div className="page"><Empty title="Couldn't load this room" sub="Nothing was changed. Check your connection and refresh." />{snackbar}</div>;


  return (
    <div className="page page-narrow">
      <PageHeader
        back={{ href: `/admin/properties/${propertyId}/rooms`, label: "Rooms" }}
        title={isNew ? "New room" : form.name || "Room"}
        sub={propertyName || undefined}
      />

      <div className="stack">
        <section className="card">
          <h2 className="t-h4 mb-6">Basics</h2>
          <div className="form">
            <div className="form-2">
              <FormField label="Name" required>
                <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="The Jharokha Suite" />
              </FormField>
              <FormField label="Web address" required hint="Lowercase, used in the link">
                <AdminInput value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="jharokha-suite" />
              </FormField>
            </div>
            <div className="form-2">
              <FormField label="Bed type">
                <AdminSelect value={form.bed_type} onChange={(e) => set("bed_type", e.target.value)}>
                  {["King", "Queen", "Twin", "Double"].map((b) => <option key={b}>{b}</option>)}
                </AdminSelect>
              </FormField>
              <FormField label="Size" hint="e.g. 45 sqm">
                <AdminInput value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="45 sqm" />
              </FormField>
            </div>
            <FormField group label="Sleeps">
              <Stepper label="Guests" value={form.capacity} min={1} max={10} onChange={(n) => set("capacity", n)} />
            </FormField>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Personality</h2>
          <div className="form">
            <FormField label="Description" required>
              <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Physical description of the room..." />
            </FormField>
            <FormField label="Personality" hint="Its story and character, shown to guests">
              <AdminTextarea value={form.personality} onChange={(e) => set("personality", e.target.value)} rows={3} placeholder="For the one who..." />
            </FormField>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Photos</h2>
          <ImageUploader
            bucket="room-images"
            folder={form.slug || "room"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Amenities</h2>
          <FormField label="What guests get" hint="Separate with commas">
            <AdminInput value={form.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="King Bed, Rain Shower, Smart TV, ..." />
          </FormField>
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Price</h2>
          <FormField label="Base price a night" required hint={`${fmtMoney(form.base_price_per_night)} a night`}>
            <span className="relative block">
              <span className="text-(--ink-3) absolute top-1/2 left-0 -translate-y-1/2" aria-hidden="true">₹</span>
              <AdminInput className="pl-5" type="number" inputMode="numeric" min={0} value={form.base_price_per_night} onChange={(e) => set("base_price_per_night", parseInt(e.target.value))} placeholder="10000" />
            </span>
          </FormField>
        </section>

        <section className="card">
          <h2 className="t-h4">Visibility</h2>
          <SwitchRow label="Live on the website" sub="Off hides this room from guests" checked={form.is_active} onChange={(v) => set("is_active", v)} />
          <div className="mt-4">
            <FormField label="Order" hint="Lower numbers show first">
              <AdminInput type="number" inputMode="numeric" min={0} value={form.sort_order} onChange={(e) => set("sort_order", parseInt(e.target.value))} />
            </FormField>
          </div>
        </section>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : isNew ? "Create room" : "Save changes"}
        </button>
        {!isNew && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger btn-sm">Delete room</button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this room?"
        message={`"${form.name}" will be removed from the website. This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      {snackbar}
    </div>
  );
}
