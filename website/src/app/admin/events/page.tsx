"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Chevron, Empty, Loading, PageHeader, Toggle, fmtDate, useNotice } from "@/components/admin/ui";

interface EventRow {
  id: string;
  title: string;
  tag: string;
  date: string | null;
  is_published: boolean;
}

// A row opens the event; the switch publishes it without leaving the list.
export default function AdminEventsPage() {
  const supabase = createClient();
  const { fail, snackbar } = useNotice();
  const [events, setEvents] = useState<EventRow[]>(); // stays unset if the load fails
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("events").select("id, title, tag, date, is_published").order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) fail(error);
        else setEvents(data);
        setLoading(false);
      });
  }, [supabase, fail]);

  const togglePublish = async (event: EventRow) => {
    const is_published = !event.is_published;
    setEvents((prev) => prev?.map((e) => e.id === event.id ? { ...e, is_published } : e));
    const { error } = await supabase.from("events").update({ is_published }).eq("id", event.id);
    if (error) {
      setEvents((prev) => prev?.map((e) => e.id === event.id ? event : e));
      fail(`Couldn't ${is_published ? "publish" : "unpublish"} ${event.title}.`);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Events"
        sub="Gatherings and experiences on the website"
        actions={<Link href="/admin/events/new" className="btn btn-primary">New event</Link>}
      />

      {loading ? <Loading /> : events && (events.length === 0 ? (
        <div className="card"><Empty title="No events yet" sub="Add your first gathering and publish it when it's ready." /></div>
      ) : (
        <div className="card flush rows">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center pr-6">
              <Link href={`/admin/events/${ev.id}`} className="row min-w-0 flex-1">
                <span className="row-main">
                  <span className="row-title truncate">{ev.title}</span>
                  <span className="row-sub">{[ev.tag, ev.date ? fmtDate(ev.date) : "Date to be set"].filter(Boolean).join(" · ")}</span>
                </span>
                <Chevron />
              </Link>
              <div className="flex items-center gap-3 pl-2">
                <span className="t-sub hidden sm:inline">{ev.is_published ? "Published" : "Draft"}</span>
                <Toggle checked={ev.is_published} label={`Publish ${ev.title}`} onChange={() => void togglePublish(ev)} />
              </div>
            </div>
          ))}
        </div>
      ))}
      {snackbar}
    </div>
  );
}
