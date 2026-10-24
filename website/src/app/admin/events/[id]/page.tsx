"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FormField, AdminInput, AdminTextarea, AdminSelect } from "@/components/admin/FormField";
import ImageUploader from "@/components/admin/ImageUploader";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { Empty, Loading, PageHeader, SwitchRow, slugify, useNotice } from "@/components/admin/ui";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { say, fail, snackbar } = useNotice();
  const [missing, setMissing] = useState(false); // a failed load must never become a blank form you can save over

  const supabase = createClient();

  useEffect(() => {
    Promise.all([
      supabase.from("properties").select("id, name"),
      isNew ? null : supabase.from("events").select("*").eq("id", id).single(),
    ]).then(([props, event]) => {
      setProperties(props.data || []);
      const data = event?.data;
      if (data) {
        setForm({
          title: data.title, description: data.description,
          property_id: data.property_id, date: data.date || "",
          time: data.time || "", tag: data.tag || "",
          images: data.images || [], is_published: data.is_published,
        });
      } else if (event) {
        setMissing(true);
        if (event.error) fail(event.error);
      }
      setLoading(false);
    });
  }, [supabase, id, isNew, fail]);

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
      if (error) fail(error);
      else router.replace(`/admin/events/${data.id}`);
    } else {
      const { error } = await supabase.from("events").update(payload).eq("id", id);
      if (error) fail(error);
      else say("Changes saved");
    }
    setSaving(false);
  };

  if (loading) return <Loading />;
  if (missing) return <div className="page"><Empty title="Couldn't load this event" sub="Nothing was changed. Check your connection and refresh." />{snackbar}</div>;


  return (
    <div className="page page-narrow">
      <PageHeader back={{ href: "/admin/events", label: "Events" }} title={isNew ? "New event" : form.title || "Untitled event"} />

      <div className="card form">
        <FormField label="Property">
          <AdminSelect value={form.property_id} onChange={(e) => set("property_id", e.target.value)}>
            <option value="">All properties / TBD</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </AdminSelect>
        </FormField>

        <FormField label="Title" required>
          <AdminInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Tiny Desk Jaipur" />
        </FormField>

        <FormField label="Description" required>
          <AdminTextarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Describe the event" />
        </FormField>

        <FormField label="Tag">
          <AdminInput value={form.tag} onChange={(e) => set("tag", e.target.value)} placeholder="Music" />
        </FormField>

        <div className="form-2">
          <FormField label="Date">
            <AdminInput type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </FormField>
          <FormField label="Time">
            <AdminInput type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </FormField>
        </div>

        <FormField group label="Images">
          <ImageUploader
            bucket="event-images"
            folder={slugify(form.title) || "event"}
            images={form.images}
            onImagesChange={(imgs) => set("images", imgs)}
          />
        </FormField>

        <SwitchRow label="Published" sub="Visible on the website" checked={form.is_published} onChange={(next) => set("is_published", next)} />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : isNew ? "Create event" : "Save changes"}
        </button>
        {!isNew && <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger btn-sm">Delete event</button>}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this event?"
        message={`${form.title || "It"} comes off the website. This can't be undone.`}
        confirmLabel="Delete event"
        onConfirm={async () => {
          setConfirmDelete(false);
          const { error } = await supabase.from("events").delete().eq("id", id);
          if (error) fail(error);
          else router.replace("/admin/events");
        }}
        onCancel={() => setConfirmDelete(false)}
      />
      {snackbar}
    </div>
  );
}
