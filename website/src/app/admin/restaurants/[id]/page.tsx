"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";
import PdfUploader from "@/components/admin/PdfUploader";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { Empty, Loading, PageHeader, RestaurantHeader, Stepper, SwitchRow, slugify, useNotice } from "@/components/admin/ui";

interface RestaurantForm {
  name: string;
  slug: string;
  property_id: string;
  cuisine: string;
  description: string;
  vibe: string;
  hours: string;
  timezone: string;
  instagram_url: string;
  images: string[];
  menu_pdf_url: string;
  is_active: boolean;
  featured: boolean;
  // public page (migration 040)
  area: string;
  tagline: string;
  address: string;
  phone: string;
  directions_url: string;
  google_rating: string;
  google_reviews: string;
  google_url: string;
  booking_days_ahead: number;
  booking_note: string;
  host_name: string;
  host_role: string;
  host_quote: string;
  host_photo_url: string;
}

const PUBLIC_FIELDS = [
  "area", "tagline", "address", "phone", "directions_url", "google_rating", "google_reviews", "google_url",
  "booking_days_ahead", "booking_note", "host_name", "host_role", "host_quote", "host_photo_url",
] as const;

const EMPTY: RestaurantForm = {
  name: "", slug: "", property_id: "", cuisine: "", description: "", vibe: "", hours: "", timezone: "Asia/Kolkata",
  instagram_url: "", images: [], menu_pdf_url: "", is_active: true, featured: false,
  area: "", tagline: "", address: "", phone: "", directions_url: "", google_rating: "", google_reviews: "", google_url: "",
  booking_days_ahead: 14, booking_note: "", host_name: "", host_role: "", host_quote: "", host_photo_url: "",
};

export default function AdminRestaurantEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [form, setForm] = useState<RestaurantForm>(EMPTY);
  const [saved, setSaved] = useState<RestaurantForm>(EMPTY);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { say, fail, snackbar } = useNotice();
  const [notFound, setNotFound] = useState(false); // a failed load must never become a blank form you can save over
  // The public-page columns arrive with migration 040. Until it runs, those fields stay read-only so Save keeps working.
  const [hasPublicFields, setHasPublicFields] = useState(true);
  const [hasMenuPdf, setHasMenuPdf] = useState(true); // menu_pdf_url: the backend handoff's menu migration, not on main yet

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      // Its columns arrive with migration 040 (page fields) and the backend handoff's menu migration. An existing row tells us which ones exist;
      // a new restaurant has no row yet, so ask once.
      const [{ data: props }, row, probe] = await Promise.all([
        supabase.from("properties").select("id, name").order("name"),
        isNew ? null : supabase.from("restaurants").select("*").eq("id", id).single(),
        isNew ? supabase.from("restaurants").select("area, menu_pdf_url").limit(1) : null,
      ]);
      setProperties(props || []);
      const data = row?.data;
      if (row && !data) { setNotFound(true); if (row.error) fail(row.error); }
      setHasPublicFields(data ? "area" in data : !probe?.error);
      setHasMenuPdf(data ? "menu_pdf_url" in data : !probe?.error);
      if (data) {
        const next: RestaurantForm = {
          ...EMPTY,
          name: data.name, slug: data.slug, property_id: data.property_id || "",
          cuisine: data.cuisine || "", description: data.description || "", vibe: data.vibe || "",
          hours: data.hours || "", timezone: data.timezone || "Asia/Kolkata", instagram_url: data.instagram_url || "",
          images: data.images || [], menu_pdf_url: data.menu_pdf_url || "", is_active: data.is_active, featured: data.featured ?? false,
          area: data.area || "", tagline: data.tagline || "", address: data.address || "", phone: data.phone || "",
          directions_url: data.directions_url || "", google_rating: data.google_rating != null ? Number(data.google_rating).toFixed(1) : "",
          google_reviews: data.google_reviews?.toString() || "", google_url: data.google_url || "",
          booking_days_ahead: data.booking_days_ahead ?? 14, booking_note: data.booking_note || "",
          host_name: data.host_name || "", host_role: data.host_role || "", host_quote: data.host_quote || "",
          host_photo_url: data.host_photo_url || "",
        };
        setForm(next);
        setSaved(next);
      }
      setLoading(false);
    }
    void load();
  }, [id, isNew, supabase, fail]);

  const set = <K extends keyof RestaurantForm>(field: K, value: RestaurantForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const missing = !form.name.trim() ? "Add a name" : !form.slug.trim() ? "Add a web address" : !form.property_id ? "Choose a property" : !form.description.trim() ? "Add the story line" : "";

  const handleSave = async () => {
    if (missing) { fail(`${missing} before saving.`); return; }
    setSaving(true);
    const nullable = (value: string) => value.trim() || null;
    const payload: Record<string, unknown> = {
      ...form,
      menu_pdf_url: form.menu_pdf_url || null,
      instagram_url: nullable(form.instagram_url),
      directions_url: nullable(form.directions_url),
      google_url: nullable(form.google_url),
      host_photo_url: nullable(form.host_photo_url),
      google_rating: form.google_rating === "" ? null : Number(form.google_rating),
      google_reviews: form.google_reviews === "" ? null : Math.round(Number(form.google_reviews)),
    };
    if (!hasPublicFields) for (const key of PUBLIC_FIELDS) delete payload[key];
    if (!hasMenuPdf) delete payload.menu_pdf_url;

    if (isNew) {
      const { data, error } = await supabase.from("restaurants").insert(payload).select().single();
      if (error || !data) fail(error || "Couldn't create the restaurant. Try again.");
      else router.replace(`/admin/restaurants/${data.id}`);
    } else {
      const { error } = await supabase.from("restaurants").update(payload).eq("id", id);
      if (error) fail(error);
      else { setSaved(form); say("Changes saved"); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    const { error } = await supabase.from("restaurants").delete().eq("id", id);
    if (!error) { router.replace("/admin/restaurants"); return; }
    fail(error.code === "23503" ? "It has bookings, so it can't be deleted. Switch off “Live on the website” instead." : error);
  };

  if (loading) return <Loading />;
  if (notFound) return <div className="page"><Empty title="Couldn't load this restaurant" sub="Nothing was changed. Check your connection and refresh." />{snackbar}</div>;

  const later = !hasPublicFields;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="page page-narrow">
      {isNew
        ? <PageHeader back={{ href: "/admin/restaurants", label: "Restaurants" }} title="New restaurant" sub="You can set booking hours and the floor plan after it's created." />
        : <RestaurantHeader id={id} name={saved.name || "Restaurant"} current="details" />}

      <div className="stack">
        <section className="card">
          <h2 className="t-h4 mb-6">Basics</h2>
          <div className="form">
            <div className="form-2">
              <FormField label="Name" required>
                <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Angel and the Searchers" />
              </FormField>
              <FormField label="Web address" required hint={form.slug ? `${siteUrl}/${form.slug}` : undefined}>
                <AdminInput value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="angels-and-searchers" />
              </FormField>
            </div>
            <div className="form-2">
              <FormField label="What it is">
                <AdminInput value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="Old Italian bistro & wine bar" />
              </FormField>
              <FormField label="Area">
                <AdminInput value={form.area} disabled={later} onChange={(e) => set("area", e.target.value)} placeholder="Pink City, Jaipur" />
              </FormField>
            </div>
            <FormField label="Property" required>
              <AdminSelect value={form.property_id} onChange={(e) => set("property_id", e.target.value)}>
                <option value="">Choose a property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </AdminSelect>
            </FormField>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4">On the page</h2>
          <p className="t-sub mb-6">What guests read first, top to bottom.</p>
          <div className="form">
            <FormField label="Tagline">
              <AdminInput value={form.tagline} disabled={later} onChange={(e) => set("tagline", e.target.value)} placeholder="A lil Italian romance never hurt anybody." />
            </FormField>
            <FormField label="Story line" required>
              <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Wood-fired pizza at 500°C, pasta folded by hand, a candle on every table." />
            </FormField>
            <FormField label="The vibe">
              <AdminTextarea value={form.vibe} onChange={(e) => set("vibe", e.target.value)} rows={3} placeholder="Music, crowd, energy" />
            </FormField>
            <FormField group label="Photos" hint="The first photo leads the page.">
              <ImageUploader bucket="restaurant-images" folder={form.slug || "restaurant"} images={form.images} onImagesChange={(imgs) => set("images", imgs)} />
            </FormField>
            {hasMenuPdf && (
              <FormField group label="Menu" hint="Opens from “See the menu”. No PDF, no button.">
                <PdfUploader bucket="restaurant-menus" folder={form.slug || "restaurant"} url={form.menu_pdf_url} onUrlChange={(url) => set("menu_pdf_url", url)} />
              </FormField>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4 mb-6">Find us</h2>
          <div className="form">
            <FormField label="Address">
              <AdminTextarea value={form.address} disabled={later} onChange={(e) => set("address", e.target.value)} rows={3} placeholder={"Chelon ki Haveli, 185 Tulsi Marg\nGangori Bazaar, Pink City\nJaipur 302002"} />
            </FormField>
            <div className="form-2">
              <FormField label="Opening hours">
                <AdminInput value={form.hours} onChange={(e) => set("hours", e.target.value)} placeholder="Open noon to midnight" />
              </FormField>
              <FormField label="Phone">
                <AdminInput type="tel" value={form.phone} disabled={later} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98XXX XXXXX" />
              </FormField>
            </div>
            <div className="form-2">
              <FormField label="Directions link">
                <AdminInput type="url" value={form.directions_url} disabled={later} onChange={(e) => set("directions_url", e.target.value)} placeholder="Google Maps link" />
              </FormField>
              <FormField label="Instagram">
                <AdminInput type="url" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/angelandthesearchers" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-[120px_120px_1fr]">
              <FormField label="Google rating">
                <AdminInput type="number" inputMode="decimal" min={0} max={5} step={0.1} value={form.google_rating} disabled={later} onChange={(e) => set("google_rating", e.target.value)} placeholder="5.0" />
              </FormField>
              <FormField label="Reviews">
                <AdminInput type="number" inputMode="numeric" min={0} value={form.google_reviews} disabled={later} onChange={(e) => set("google_reviews", e.target.value)} placeholder="23" />
              </FormField>
              <div className="col-span-2 sm:col-span-1">
                <FormField label="Reviews link">
                  <AdminInput type="url" value={form.google_url} disabled={later} onChange={(e) => set("google_url", e.target.value)} placeholder="Google Maps reviews" />
                </FormField>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4">Booking</h2>
          <p className="t-sub mb-2">
            Times and party sizes are in{" "}
            {isNew ? "Booking hours, after you create the restaurant." : <Link href={`/admin/restaurants/${id}/availability`} className="link">Booking hours</Link>}
          </p>
          <div className="rows">
            <div className="flex min-h-14 items-center justify-between gap-4 py-3">
              <div>
                <p className="t-body">Guests can book ahead</p>
                <p className="t-sub">{form.booking_days_ahead} days</p>
              </div>
              <Stepper label="Days" value={form.booking_days_ahead} min={1} max={90} disabled={later} onChange={(n) => set("booking_days_ahead", n)} />
            </div>
          </div>
          <div className="form mt-4">
            <FormField label="Note before they confirm">
              <AdminTextarea value={form.booking_note} disabled={later} onChange={(e) => set("booking_note", e.target.value)} rows={2} placeholder="We hold tables for 15 minutes. For 9 or more, give us a call." />
            </FormField>
            <FormField label="Time zone">
              <AdminInput value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="Asia/Kolkata" />
            </FormField>
          </div>
        </section>

        <section className="card">
          <h2 className="t-h4">Host</h2>
          <p className="t-sub mb-6">The person on the card. Leave the name empty to hide it.</p>
          <div className="form">
            <div className="form-2">
              <FormField label="Name">
                <AdminInput value={form.host_name} disabled={later} onChange={(e) => set("host_name", e.target.value)} placeholder="Sahar Saini" />
              </FormField>
              <FormField label="Role">
                <AdminInput value={form.host_role} disabled={later} onChange={(e) => set("host_role", e.target.value)} placeholder="Founder, the heart of the house" />
              </FormField>
            </div>
            <FormField label="In their words">
              <AdminTextarea value={form.host_quote} disabled={later} onChange={(e) => set("host_quote", e.target.value)} rows={2} placeholder="The vibe is the experience. The experience is everything." />
            </FormField>
            {!later && (
              <FormField group label="Photo">
                <ImageUploader
                  bucket="restaurant-images"
                  folder={`${form.slug || "restaurant"}/host`}
                  images={form.host_photo_url ? [form.host_photo_url] : []}
                  onImagesChange={(imgs) => set("host_photo_url", imgs.at(-1) || "")}
                />
              </FormField>
            )}
          </div>
        </section>

        <section className="card py-2">
          <div className="rows">
            <SwitchRow label="Live on the website" sub="Off hides the page and stops new bookings" checked={form.is_active} onChange={(v) => set("is_active", v)} />
            <SwitchRow label="Featured on the home page" checked={form.featured} onChange={(v) => set("featured", v)} />
          </div>
        </section>

        {!isNew && <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger btn-sm -ml-3 justify-self-start">Delete restaurant</button>}

        {later && <p className="t-cap">Area, tagline, address, phone, links, rating, booking note and host unlock after the next database update (migration 040).</p>}
      </div>

      {/* Sticky save bar: always in reach on a long form, quiet until something changes */}
      <div className="bottom-bar sticky flex items-center justify-end gap-4">
        <p className="t-sub mr-auto">{isNew ? "" : dirty ? "Unsaved changes" : "All changes saved"}</p>
        <button type="button" onClick={handleSave} disabled={saving || (!isNew && !dirty)} className="btn btn-primary">
          {saving ? "Saving…" : isNew ? "Create restaurant" : "Save changes"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${saved.name || "this restaurant"}?`}
        message="Its page, booking hours and floor plan go with it. This can't be undone."
        confirmLabel="Delete restaurant"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
      {snackbar}
    </div>
  );
}
