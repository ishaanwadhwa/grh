"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FormField, AdminInput, AdminTextarea } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { Empty, Loading, PageHeader, SwitchRow, TabsHeader, slugify, useNotice } from "@/components/admin/ui";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { say, fail, snackbar } = useNotice();
  const [missing, setMissing] = useState(false); // a failed load must never become a blank form you can save over

  const supabase = createClient();

  useEffect(() => {
    if (isNew) return;
    supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!data) { setMissing(true); if (error) fail(error); }
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
  }, [supabase, id, isNew, fail]);

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
      if (error) fail(error);
      else router.replace(`/admin/properties/${data.id}`);
    } else {
      const { error } = await supabase.from("properties").update(payload).eq("id", id);
      if (error) fail(error);
      else say("Changes saved");
    }
    setSaving(false);
  };

  // Deleting a property also deletes its rooms (ON DELETE CASCADE); one with bookings can't be deleted.
  const handleDelete = async () => {
    setConfirmDelete(false);
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) fail(error);
    else router.replace("/admin/properties");
  };

  if (loading) return <Loading />;
  if (missing) return <div className="page"><Empty title="Couldn't load this property" sub="Nothing was changed. Check your connection and refresh." />{snackbar}</div>;


  return (
    <div className="page page-narrow">
      {isNew ? (
        <PageHeader back={{ href: "/admin/properties", label: "Properties" }} title="New property" sub="You can add rooms after it's created." />
      ) : (
        <TabsHeader
          back={{ href: "/admin/properties", label: "Properties" }}
          title={form.name || "Property"}
          tabs={[{ label: "Details", href: `/admin/properties/${id}` }, { label: "Rooms", href: `/admin/properties/${id}/rooms` }]}
          current={`/admin/properties/${id}`}
        />
      )}

      <div className="stack">
        <section className="card">
          <h2 className="t-h4 mb-6">Basics</h2>
          <div className="form">
            <div className="form-2">
              <FormField label="Name" required>
                <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Sunday Rose Club Jaipur" />
              </FormField>
              <FormField label="Web address" required hint="Lowercase, used in the link, e.g. jaipur">
                <AdminInput value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="jaipur" />
              </FormField>
            </div>
            <FormField label="Location" required>
              <AdminInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Walled City, Jaipur, Rajasthan" />
            </FormField>
            <FormField label="Address">
              <AdminInput value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Sitaram Bhawan, ..." />
            </FormField>
            <div className="form-2">
              <FormField label="Phone">
                <AdminInput type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 XXXX XXXX XX" />
              </FormField>
              <FormField label="Google Maps link">
                <AdminInput type="url" value={form.map_url} onChange={(e) => set("map_url", e.target.value)} placeholder="https://maps.google.com/..." />
              </FormField>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Story</h2>
          <div className="form">
            <FormField label="Tagline">
              <AdminInput value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="A 300-Year-Old Haveli. Reborn." />
            </FormField>
            <FormField label="Description" required>
              <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={5} placeholder="Describe the property..." />
            </FormField>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Photos</h2>
          <ImageUploader
            bucket="property-images"
            folder={form.slug || "property"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Amenities</h2>
          <FormField label="What guests get" hint="Separate with commas">
            <AdminInput value={form.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="Pool, Wi-Fi, Rooftop, ..." />
          </FormField>
        </section>

        <section className="card pb-2">
          <h2 className="t-h4">Visibility</h2>
          <SwitchRow label="Featured on the home page" checked={form.featured} onChange={(v) => set("featured", v)} />
        </section>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : isNew ? "Create property" : "Save changes"}
        </button>
        {!isNew && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger btn-sm">Delete property</button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this property?"
        message={`"${form.name}" and all its rooms will be deleted. This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      {snackbar}
    </div>
  );
}
