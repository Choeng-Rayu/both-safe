"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { ALLOWED_UPLOAD_TYPES, FILE_MAX_BYTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { resolveFileUrl } from "@/lib/utils";
import { useI18n } from "@/components/providers/app-providers";

type ImageUploaderProps = {
  value: File | null;
  previewUrl?: string | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  accept?: string;
};

export function ImageUploader({
  value,
  previewUrl,
  onChange,
  error,
  accept = "image/jpeg,image/png,image/webp,image/heic,application/pdf",
}: ImageUploaderProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) return onChange(null);
          if (!ALLOWED_UPLOAD_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
            return onChange(null);
          }
          if (file.size > FILE_MAX_BYTES) {
            return onChange(null);
          }
          onChange(file);
        }}
      />
      <Button
        variant="secondary"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        {value ? value.name : t("common.open")}
      </Button>
      <p className="text-xs text-[var(--ink-soft)]">{t("upload.file_help")}</p>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {previewUrl || value ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
          {value?.type === "application/pdf" ? (
            <div className="p-4 text-sm text-[var(--ink-soft)]">{value.name}</div>
          ) : (
            <img
              src={value ? URL.createObjectURL(value) : resolveFileUrl(previewUrl ?? null) ?? ""}
              alt=""
              className="max-h-64 w-full object-cover"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
