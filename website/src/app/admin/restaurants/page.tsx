"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Chevron, Empty, Loading, PageHeader, StatusTag, useNotice } from "@/components/admin/ui";

interface RestaurantRow {
  id: string;
  name: string;
  cuisine: string;
  hours: string;
  is_active: boolean;
  featured: boolean;
  sort_order: number;
}

// A row opens the restaurant. The arrows set the order guests see on the site.
export default function AdminRestaurantsPage() {
  const supabase = createClient();
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const { fail, snackbar } = useNotice();

  useEffect(() => {
    supabase.from("restaurants").select("id, name, cuisine, hours, is_active, featured, sort_order")
      .order("sort_order").order("created_at")
      .then(({ data, error }) => {
        if (error) { fail(error); setLoadState("failed"); return; }
        setRestaurants(data);
        setLoadState("ready");
      });
  }, [supabase, fail]);

  const move = async (i: number, step: -1 | 1) => {
    const swapped = [...restaurants];
    [swapped[i], swapped[i + step]] = [swapped[i + step], swapped[i]];
    const next = swapped.map((r, k) => ({ ...r, sort_order: k + 1 }));
    const changed = next.filter((r) => r.sort_order !== restaurants.find((old) => old.id === r.id)?.sort_order);
    setRestaurants(next);
    const results = await Promise.all(changed.map((r) => supabase.from("restaurants").update({ sort_order: r.sort_order }).eq("id", r.id)));
    if (results.some((r) => r.error)) { fail("Couldn't save the new order. Try again."); setRestaurants(restaurants); }
  };

  return (
    <div className="page">
      <PageHeader
        title="Restaurants"
        sub="Guests see them on the site in this order."
        actions={<Link href="/admin/restaurants/new" className="btn btn-primary">New restaurant</Link>}
      />

      {loadState === "loading" && <Loading />}
      {loadState === "ready" && (restaurants.length === 0 ? (
        <div className="card"><Empty title="No restaurants yet" sub="Add your first one with New restaurant." /></div>
      ) : (
        <div className="card flush rows">
          {restaurants.map((r, i) => (
            <div key={r.id} className="flex items-center pr-4">
              <Link href={`/admin/restaurants/${r.id}`} className="row min-w-0 flex-1">
                <span className="row-main">
                  <span className="row-title truncate">{r.name}</span>
                  <span className="row-sub truncate">{[r.cuisine, r.hours].filter(Boolean).join(" · ")}</span>
                </span>
                {r.featured && <span className="tag tag-brand hidden sm:inline-flex">Home page</span>}
                <StatusTag status={r.is_active ? "active" : "hidden"} />
                <Chevron />
              </Link>
              {restaurants.length > 1 && (
                <div className="flex gap-1" role="group" aria-label={`Order of ${r.name}`}>
                  <button type="button" onClick={() => void move(i, -1)} disabled={i === 0} aria-label="Move up" className="btn btn-grey btn-sm btn-icon"><Chevron dir="up" /></button>
                  <button type="button" onClick={() => void move(i, 1)} disabled={i === restaurants.length - 1} aria-label="Move down" className="btn btn-grey btn-sm btn-icon"><Chevron dir="down" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {snackbar}
    </div>
  );
}
