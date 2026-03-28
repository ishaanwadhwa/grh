"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";

interface RestaurantForm {
  name: string;
  slug: string;
  property_id: string;
  cuisine: string;
  description: string;
  vibe: string;
  hours: string;
  images: string[];
  is_active: boolean;
  featured: boolean;
}

export default function AdminRestaurantEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [form, setForm] = useState<RestaurantForm>({
    name: "", slug: "", property_id: "", cuisine: "", description: "",
    vibe: "", hours: "", images: [], is_active: true, featured: false,
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
      const { data: props } = await supabase.from("properties").select("id, name").order("name");
      setProperties(props || []);

      if (!isNew) {
        const { data } = await supabase.from("restaurants").select("*").eq("id", id).single();
        if (data) {
          setForm({
            name: data.name, slug: data.slug, property_id: data.property_id,
            cuisine: data.cuisine, description: data.description, vibe: data.vibe,
            hours: data.hours, images: data.images || [], is_active: data.is_active, featured: data.featured ?? false,
          });
        }
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (field: keyof RestaurantForm, value: string | string[] | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };

    if (isNew) {
      const { data, error } = await supabase.from("restaurants").insert(payload).select().single();
      if (!error && data) router.replace(`/admin/restaurants/${data.id}`);
    } else {
      await supabase.from("restaurants").update(payload).eq("id", id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-sm text-text/30">Loading...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/admin/restaurants" className="text-xs text-text/40 hover:text-text">← Restaurants</Link>
        <span className="text-text/20">/</span>
        <h1 className="font-display text-2xl text-text">{isNew ? "New Restaurant" : form.name}</h1>
      </div>

      <div className="space-y-6">
        <FormField label="Property" required>
          <AdminSelect value={form.property_id} onChange={(e) => set("property_id", e.target.value)}>
            <option value="">Select property...</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </AdminSelect>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required>
            <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Angels & Searchers" />
          </FormField>
          <FormField label="Slug" required>
            <AdminInput value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="angels-and-searchers" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cuisine">
            <AdminInput value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="Modern Indian" />
          </FormField>
          <FormField label="Hours">
            <AdminInput value={form.hours} onChange={(e) => set("hours", e.target.value)} placeholder="12:00 PM – 11:00 PM" />
          </FormField>
        </div>

        <FormField label="Description" required>
          <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Describe the restaurant concept..." />
        </FormField>

        <FormField label="The Vibe">
          <AdminTextarea value={form.vibe} onChange={(e) => set("vibe", e.target.value)} rows={3} placeholder="The atmosphere, energy, feel..." />
        </FormField>

        <FormField label="Images">
          <ImageUploader
            bucket="restaurant-images"
            folder={form.slug || "restaurant"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </FormField>

        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => set("is_active", !form.is_active)}>
            <div className={`w-4 h-4 border flex items-center justify-center transition-all ${form.is_active ? "border-accent-gold bg-accent-gold" : "border-border-subtle"}`}>
              {form.is_active && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className="text-xs text-text/60">Active (visible on website)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" onClick={() => set("featured", !form.featured)}>
            <div className={`w-4 h-4 border flex items-center justify-center transition-all ${form.featured ? "border-accent-gold bg-accent-gold" : "border-border-subtle"}`}>
              {form.featured && <span className="text-white text-[10px]">✓</span>}
            </div>
            <span className="text-xs text-text/60">Featured on Homepage</span>
          </label>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : isNew ? "Create Restaurant" : "Save Changes"}
          </button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
