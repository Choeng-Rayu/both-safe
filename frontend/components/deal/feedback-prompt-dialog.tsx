"use client";

import { useEffect, useState } from "react";
import { Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { submitDealFeedback } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useI18n } from "@/components/providers/app-providers";

interface FeedbackPromptDialogProps {
  /** Controls visibility from the parent. */
  open: boolean;
  /** Called when the user closes / skips the prompt. */
  onClose: () => void;
  /** Public id of the deal — used as the request path. */
  publicId: string;
  /**
   * The current user's role on this deal. Required for the submit
   * flow because the backend stores feedback per-role; an admin or
   * unrelated viewer never sees this dialog.
   */
  currentRole: "buyer" | "seller";
  /** Pulled by the deal room after a successful submit. */
  onSubmitted: () => void;
  /** Forwarded to the API call so participant-token paths still work. */
  accessToken: string | null;
}

/**
 * Small celebratory modal shown automatically when the deal lands in
 * a terminal status. Visually it reuses the same star + textarea
 * pattern as the inline `DealRatingCard` so the user only has to
 * learn one widget; the difference is the dialog auto-opens once and
 * is dismissable, while the card stays available on the page so the
 * user can edit later.
 */
export function FeedbackPromptDialog({
  open,
  onClose,
  publicId,
  currentRole,
  onSubmitted,
  accessToken,
}: FeedbackPromptDialogProps) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the dialog re-opens so a previous "skip"
  // doesn't bleed into the next prompt.
  useEffect(() => {
    if (open) {
      setRating(0);
      setHoverRating(0);
      setComment("");
      setError(null);
    }
  }, [open]);

  // Lock body scroll while open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit() {
    if (rating < 1 || rating > 5) {
      setError("Pick a rating from 1 to 5 stars first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitDealFeedback(
        publicId,
        { rating, comment: comment.trim() || undefined },
        { accessToken },
      );
      onSubmitted();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoverRating || rating;
  const roleLabel = currentRole === "buyer" ? "buyer" : "seller";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-prompt-title"
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-ring absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-amber-100 hover:text-[var(--ink)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200">
              <Star className="h-5 w-5 fill-amber-500 text-amber-600" />
            </span>
            <div>
              <h2
                id="feedback-prompt-title"
                className="text-xl font-bold text-[var(--ink)]"
              >
                Deal complete — how did it go?
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                A quick rating from the {roleLabel} helps us improve BothSafe.
                Comments are optional.
              </p>
            </div>
          </div>

          {/* Star input */}
          <div
            className="mt-2 flex items-center justify-center gap-1"
            role="radiogroup"
            aria-label="Rating"
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                onMouseLeave={() => setHoverRating(0)}
                className="rounded-full p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                disabled={submitting}
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-8 w-8 ${
                    value <= displayRating
                      ? "fill-amber-400 text-amber-500"
                      : "text-amber-200"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="mt-1 text-center text-sm font-medium text-[var(--ink)]">
              {rating}/5
            </p>
          )}

          <div className="mt-4">
            <Field label="Comment" hint="Optional — anything we should know?">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Tell us what worked, what didn't, or how we can improve."
                rows={3}
                maxLength={2000}
                disabled={submitting}
              />
            </Field>
          </div>

          {error ? (
            <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Skip for now
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || rating < 1}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit feedback
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
