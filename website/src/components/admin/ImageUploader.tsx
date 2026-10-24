"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Close } from "./ui";

interface ImageUploaderProps {
  bucket: string;
  folder: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
}

export default function ImageUploader({
  bucket,
  folder,
  images,
  onImagesChange,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    // All at once; a file that fails to upload is skipped, the rest keep their order.
    const urls = await Promise.all(Array.from(files).map(async (file) => {
      const ext = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

      return error ? null : supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
    }));

    onImagesChange([...images, ...urls.filter((url) => url !== null)]);
    setUploading(false);
  };

  const handleRemove = async (url: string) => {
    // Extract path from URL
    const path = url.split(`/${bucket}/`)[1];
    if (path) {
      await supabase.storage.from(bucket).remove([path]);
    }
    onImagesChange(images.filter((img) => img !== url));
  };

  // DLS multi file upload: a grid of tiles, the add tile last.
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {images.map((url, i) => (
        <div key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-(--tint)">
          <Image src={url} alt={`Photo ${i + 1}`} fill sizes="160px" className="object-cover" />
          <button
            type="button"
            onClick={() => handleRemove(url)}
            aria-label={`Remove photo ${i + 1}`}
            className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-(--card) text-(--ink) shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 [&_svg]:h-2.5 [&_svg]:w-2.5"
          >
            <Close />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="grid aspect-square place-items-center rounded-xl border border-dashed border-(--line) text-center text-sm font-medium text-(--ink-2) transition-colors hover:border-(--ink-3) hover:bg-(--tint-2) disabled:opacity-50"
      >
        {uploading ? <span className="spinner" /> : "Add photos"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleUpload(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
