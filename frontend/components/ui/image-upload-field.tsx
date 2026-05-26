"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

/**
 * Drag-drop / tap-to-pick image upload control with inline preview
 * and one-click clear. Encapsulates the duplicated pattern that
 * previously lived in `withdraw-form.tsx` (user uploads a payout QR)
 * and `admin-withdrawal-detail.tsx` (admin uploads a proof of
 * payment screenshot).
 *
 * The parent owns the `File` state and is notified of changes via
 * `onChange`. Validation failures (wrong type, oversized) are
 * surfaced via `onValidationError`; the parent decides how / where
 * to render that error string.
 *
 * The control intentionally does not include a label or wrapping
 * `<Field>`; callers compose it inside their own field layouts.
 */
export interface ImageUploadFieldProps {
  /** Current selected file, or null when empty. */
  value: File | null;
  /** Called when the user picks or clears a file. */
  onChange: (file: File | null) => void;
  /**
   * Called when a file the user picked failed validation. The string
   * is human-readable and ready to render to the user. The control
   * does not call `onChange` in that case, so the previous `value`
   * stays intact.
   */
  onValidationError?: (message: string) => void;
  /** Accepted MIME types. Defaults to common web image formats. */
  accept?: string;
  /** Hard cap on file size in bytes. Defaults to 10 MB. */
  maxSizeBytes?: number;
  /** Stable DOM id for the hidden input (so a `<label htmlFor>` works). */
  inputId?: string;
  /** Big text shown in the empty dropzone state. */
  promptLabel: string;
  /** Small supporting text shown under the prompt label. */
  helperText?: string;
  /** Alt text for the rendered preview image. */
  previewAlt?: string;
}

export function ImageUploadField({
  value,
  onChange,
  onValidationError,
  accept = "image/png,image/jpeg,image/webp",
  maxSizeBytes = 10 * 1024 * 1024,
  inputId,
  promptLabel,
  helperText,
  previewAlt = "Selected image preview",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Recreate the preview blob URL whenever the file identity
  // changes; revoke on unmount/replace so we don't leak object URLs.
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onValidationError?.("Please choose an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > maxSizeBytes) {
      const mb = Math.round(maxSizeBytes / (1024 * 1024));
      onValidationError?.(`Image must be smaller than ${mb} MB.`);
      return;
    }
    onChange(file);
  };

  const clearFile = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      {previewUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={previewAlt}
            className="h-44 w-44 rounded-lg border border-[var(--border)] bg-white object-contain"
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute -top-2 -right-2 rounded-full bg-[var(--ink)] p-1 text-white shadow"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] bg-white px-4 py-6 text-sm text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--ink)]"
        >
          <Upload className="h-6 w-6" />
          <span>{promptLabel}</span>
          {helperText ? <span className="text-xs">{helperText}</span> : null}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="sr-only"
      />
    </>
  );
}
