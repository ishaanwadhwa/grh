"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Chevron, Empty, Loading, PageHeader, useNotice } from "@/components/admin/ui";

interface PropertyRow {
  id: string;
  name: string;
  slug: string;
  location: string;
  created_at: string;
}

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<PropertyRow[]>(); // stays unset if the load fails
  const [loading, setLoading] = useState(true);
  const { fail, snackbar } = useNotice();

  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("properties")
      .select("id, name, slug, location, created_at")
      .order("created_at")
      .then(({ data, error }) => {
        if (error) fail(error);
        else setProperties(data);
        setLoading(false);
      });
  }, [supabase, fail]);

  return (
    <div className="page">
      <PageHeader
        title="Properties"
        sub="Sunday Rose Club locations, their rooms and photos"
        actions={<Link href="/admin/properties/new" className="btn btn-primary">New property</Link>}
      />

      {loading ? (
        <Loading />
      ) : properties && (properties.length === 0 ? (
        <Empty title="No properties yet" sub="Add your first location, then its rooms." />
      ) : (
        <div className="card flush rows">
          {properties.map((prop) => (
            <Link key={prop.id} href={`/admin/properties/${prop.id}`} className="row">
              <div className="row-main">
                <p className="row-title">{prop.name}</p>
                <p className="row-sub">{prop.location}</p>
              </div>
              <Chevron />
            </Link>
          ))}
        </div>
      ))}
      {snackbar}
    </div>
  );
}
