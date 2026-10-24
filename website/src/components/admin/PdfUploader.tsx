"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024; // matches the restaurant-menus bucket limit (backend handoff migration, not on main yet)

interface PdfUploaderProps {
  bucket: string;
  folder: string;
  url: string;
  onUrlChange: (url: string) => void;
}

// ponytail: replaced or removed PDFs stay in storage, so the live link never breaks before
// the admin presses Save. Clean up old files if storage ever matters.
export default function PdfUploader({ bucket, folder, url, onUrlChange }: PdfUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handleUpload = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > MAX_BYTES) {
      setError("Please choose a PDF up to 10 MB.");
      return;
    }
    setUploading(true);
    setError("");

    const fileName = `${folder}/${Date.now()}-menu.pdf`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file, {
      upsert: true,
      contentType: "application/pdf",
    });

    if (uploadError) {
      setError("Upload failed. Please try again.");
    } else {
      onUrlChange(supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl);
    }
    setUploading(false);
  };

  return (
    <div className="mt-2">
      {url ? (
        <div className="flex flex-wrap items-center gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="link mr-auto">Open current menu</a>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn btn-secondary btn-sm">
            {uploading ? "Uploading…" : "Replace"}
          </button>
          <button type="button" onClick={() => onUrlChange("")} className="btn btn-danger btn-sm">Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn btn-secondary btn-sm">
          {uploading ? "Uploading…" : "Upload menu PDF"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => handleUpload(e.target.files?.[0])}
        className="hidden"
      />
      {error && <p className="hint error">{error}</p>}
    </div>
  );
}
