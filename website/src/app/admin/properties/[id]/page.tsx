"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { FormField, AdminInput, AdminTextarea } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";

interface PropertyForm {
  name: string;
  slug: string;
  location: string;
  address: string;
  phone: string;
  tagline: string;
  description: string;
  amenities: string; // comma separated
  images: string[];
  map_url: string;
  featured: boolean;
}

const empty: PropertyForm = {
  name: "", slug: "", location: "", address: "", phone: "",
  tagline: "", description: "", amenities: "", images: [], map_url: "", featured: false,
};

export default function AdminPropertyEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [form, setForm] = useState<PropertyForm>(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (isNew) return;
    supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            name: data.name, slug: data.slug, location: data.location,
            address: data.address, phone: data.phone, tagline: data.tagline,
            description: data.description, amenities: (data.amenities || []).join(", "),
            images: data.images || [], map_url: data.map_url || "", featured: data.featured ?? false,
          });
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (field: keyof PropertyForm, value: string | string[] | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug,
      location: form.location,
      address: form.address,
      phone: form.phone,
      tagline: form.tagline,
      description: form.description,
      amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      images: form.images,
      map_url: form.map_url || null,
      featured: form.featured,
    };

    if (isNew) {
      const { data, error } = await supabase.from("properties").insert(payload).select().single();
      if (!error && data) {
        router.replace(`/admin/properties/${data.id}`);
      }
    } else {
      await supabase.from("properties").update(payload).eq("id", id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-8 text-sm text-text/30">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/properties" className="text-xs text-text/40 hover:text-text transition-colors">
          ← Properties
        </Link>
        <span className="text-text/20">/</span>
        <h1 className="font-display text-2xl text-text">{isNew ? "New Property" : form.name}</h1>
      </div>

      {!isNew && (
        <div className="mb-6">
          <Link
            href={`/admin/properties/${id}/rooms`}
            className="inline-flex items-center gap-2 text-xs text-accent-gold border border-accent-gold/30 px-4 py-2 hover:bg-accent-gold/5 transition-colors"
          >
            Manage Rooms →
          </Link>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required>
            <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Good Room House Jaipur" />
          </FormField>
          <FormField label="Slug" required hint="URL identifier, e.g. jaipur">
            <AdminInput value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="jaipur" />
          </FormField>
        </div>

        <FormField label="Location" required>
          <AdminInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Walled City, Jaipur, Rajasthan" />
        </FormField>

        <FormField label="Address">
          <AdminInput value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Sitaram Bhawan, ..." />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone">
            <AdminInput value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 XXXX XXXX XX" />
          </FormField>
          <FormField label="Google Maps URL">
            <AdminInput value={form.map_url} onChange={(e) => set("map_url", e.target.value)} placeholder="https://maps.google.com/..." />
          </FormField>
        </div>

        <FormField label="Tagline">
          <AdminInput value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="A 300-Year-Old Haveli. Reborn." />
        </FormField>

        <FormField label="Description" required>
          <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} placeholder="Describe the property..." />
        </FormField>

        <FormField label="Amenities" hint="Comma-separated list">
          <AdminInput value={form.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="Pool, Wi-Fi, Rooftop, ..." />
        </FormField>

        <FormField label="Images">
          <ImageUploader
            bucket="property-images"
            folder={form.slug || "property"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </FormField>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => set("featured", !form.featured)}>
            <div className={`w-4 h-4 border flex items-center justify-center transition-all ${form.featured ? "border-accent-gold bg-accent-gold" : "border-border-subtle"}`}>
              {form.featured && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className="text-xs text-text/60">Featured on Homepage</span>
          </label>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : isNew ? "Create Property" : "Save Changes"}
          </button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
