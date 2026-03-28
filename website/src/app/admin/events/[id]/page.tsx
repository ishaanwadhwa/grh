"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";

interface EventForm {
  title: string;
  description: string;
  property_id: string;
  date: string;
  time: string;
  tag: string;
  images: string[];
  is_published: boolean;
}

export default function AdminEventEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [form, setForm] = useState<EventForm>({
    title: "", description: "", property_id: "", date: "",
    time: "", tag: "", images: [], is_published: false,
  });
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const { data: props } = await supabase.from("properties").select("id, name");
      setProperties(props || []);

      if (!isNew) {
        const { data } = await supabase.from("events").select("*").eq("id", id).single();
        if (data) {
          setForm({
            title: data.title, description: data.description,
            property_id: data.property_id, date: data.date || "",
            time: data.time || "", tag: data.tag || "",
            images: data.images || [], is_published: data.is_published,
          });
        }
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (field: keyof EventForm, value: string | string[] | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      property_id: form.property_id || null,
      date: form.date || null,
      time: form.time || null,
      tag: form.tag,
      images: form.images,
      is_published: form.is_published,
    };

    if (isNew) {
      const { data, error } = await supabase.from("events").insert(payload).select().single();
      if (!error && data) router.replace(`/admin/events/${data.id}`);
    } else {
      await supabase.from("events").update(payload).eq("id", id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-sm text-text/30">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin/events" className="text-xs text-text/40 hover:text-text">← Events</Link>
        <span className="text-text/20">/</span>
        <h1 className="font-display text-2xl text-text">{isNew ? "New Event" : form.title}</h1>
      </div>

      <div className="space-y-6">
        <FormField label="Property">
          <AdminSelect value={form.property_id} onChange={(e) => set("property_id", e.target.value)}>
            <option value="">All Properties / TBD</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </AdminSelect>
        </FormField>

        <FormField label="Title" required>
          <AdminInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Tiny Desk Jaipur" />
        </FormField>

        <FormField label="Description" required>
          <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Describe the event..." />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Tag">
            <AdminInput value={form.tag} onChange={(e) => set("tag", e.target.value)} placeholder="Music" />
          </FormField>
          <FormField label="Date">
            <AdminInput type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </FormField>
          <FormField label="Time">
            <AdminInput type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </FormField>
        </div>

        <FormField label="Images">
          <ImageUploader
            bucket="event-images"
            folder={form.title.toLowerCase().replace(/\s+/g, "-") || "event"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </FormField>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => set("is_published", !form.is_published)}>
            <div className={`w-4 h-4 border flex items-center justify-center transition-all ${form.is_published ? "border-accent-gold bg-accent-gold" : "border-border-subtle"}`}>
              {form.is_published && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className="text-xs text-text/60">Published (visible on website)</span>
          </label>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : isNew ? "Create Event" : "Save Changes"}
          </button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
