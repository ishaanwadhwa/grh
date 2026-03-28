"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";

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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      }
    }

    onImagesChange([...images, ...newUrls]);
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

  return (
    <div>
      {/* Existing images */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {images.map((url) => (
            <div key={url} className="relative group w-24 h-24 border border-border-subtle">
              <Image
                src={url}
                alt="Upload"
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="border border-dashed border-border-subtle px-6 py-4 text-xs text-text/40 hover:text-text/60 hover:border-accent-gold/40 transition-colors disabled:opacity-40 w-full text-center"
      >
        {uploading ? "Uploading..." : "+ Add Images"}
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
