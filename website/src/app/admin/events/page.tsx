"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface EventRow {
  id: string;
  title: string;
  tag: string;
  date: string | null;
  is_published: boolean;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    supabase
      .from("events")
      .select("id, title, tag, date, is_published")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePublish = async (event: EventRow) => {
    const val = !event.is_published;
    await supabase.from("events").update({ is_published: val }).eq("id", event.id);
    setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, is_published: val } : e));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("events").delete().eq("id", deleteTarget.id);
    setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl text-text">Events</h1>
          <p className="mt-1 text-sm text-text/40">Manage gatherings and experiences</p>
        </div>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 bg-text text-text-inverse text-xs uppercase tracking-widest hover:bg-text/80 transition-colors self-start shrink-0"
        >
          + Add Event
        </Link>
      </div>

      <div className="bg-white border border-border-subtle">
        {loading ? (
          <p className="p-8 text-sm text-text/30">Loading...</p>
        ) : events.length === 0 ? (
          <p className="p-8 text-sm text-text/30">No events yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Title</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Tag</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Date</th>
                <th className="px-5 py-3 text-left text-xs uppercase tracking-widest text-text/40">Published</th>
                <th className="px-5 py-3 text-right text-xs uppercase tracking-widest text-text/40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-border-subtle/50 hover:bg-background transition-colors">
                  <td className="px-5 py-3 font-medium text-text">{ev.title}</td>
                  <td className="px-5 py-3 text-text/50 text-xs">{ev.tag}</td>
                  <td className="px-5 py-3 text-text/40 text-xs">{ev.date || "TBD"}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => togglePublish(ev)}
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 transition-colors ${ev.is_published ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-background text-text/40 hover:bg-border-subtle"}`}
                    >
                      {ev.is_published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link href={`/admin/events/${ev.id}`} className="text-xs text-text/50 hover:text-text">Edit</Link>
                      <button onClick={() => setDeleteTarget(ev)} className="text-xs text-accent hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Event"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
