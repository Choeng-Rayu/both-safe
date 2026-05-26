"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { submitDealFeedback, type DealFeedbackEntry } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useI18n } from "@/components/providers/app-providers";

interface DealRatingCardProps {
  publicId: string;
  /** Role of the current user — only this row's feedback can be edited. */
  currentRole: "buyer" | "seller" | null;
  /** Existing feedback entries (both roles) so we can show the other side's note too. */
  feedback: DealFeedbackEntry[] | null;
  /** Pulled from the deal response so we re-render after a successful submit. */
  onSubmitted: () => void;
  /** Used to disable the action while another runAction is in flight. */
  pending?: boolean;
  /**
   * Token forwarding for write requests. Mirrors how other deal-room
   * actions thread the participant access token through.
   */
  accessToken: string | null;
}

/**
 * Optional 1–5 star rating + free-form comment shown after a deal
 * reaches a terminal status. Either party can leave one entry,
 * editing it later if they want. Submission is fully optional —
 * we never block the UI on it.
 */
export function DealRatingCard({
  publicId,
  currentRole,
  feedback,
  onSubmitted,
  pending: parentPending,
  accessToken,
}: DealRatingCardProps) {
  const { t } = useI18n();

  const myEntry = useMemo(
    () => (currentRole ? feedback?.find((f) => f.role === currentRole) : null),
    [feedback, currentRole],
  );
  const otherEntry = useMemo(
    () =>
      currentRole
        ? feedback?.find((f) => f.role !== currentRole)
        : feedback?.[0] ?? null,
    [feedback, currentRole],
  );

  const [rating, setRating] = useState<number>(myEntry?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(myEntry?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(
    myEntry?.updated_at ?? null,
  );

  // Re-sync local state when the parent refreshes the deal (e.g. after
  // polling) so a saved entry in another tab doesn't get overwritten.
  useEffect(() => {
    if (myEntry) {
      setRating(myEntry.rating);
      setComment(myEntry.comment ?? "");
      setSavedAt(myEntry.updated_at);
    }
  }, [myEntry]);

  async function handleSubmit() {
    if (!currentRole) return;
    if (rating < 1 || rating > 5) {
      setError("Pick a rating from 1 to 5 stars first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitDealFeedback(
        publicId,
        { rating, comment: comment.trim() || undefined },
        { accessToken },
      );
      setSavedAt(result.updated_at);
      onSubmitted();
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  // Anonymous viewer (admin override) without a participant role —
  // show a read-only summary only.
  if (!currentRole) {
    return feedback && feedback.length > 0 ? (
      <FeedbackSummary feedback={feedback} />
    ) : null;
  }

  const displayRating = hoverRating || rating;
  const isUpdate = !!myEntry;
  const disabled = submitting || parentPending || rating < 1;

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">
            How did this deal go?
          </h3>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Your feedback is optional and helps us improve BothSafe. Both
            buyer and seller can leave one rating per deal.
          </p>
        </div>
        {savedAt ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Saved
          </span>
        ) : null}
      </div>

      {/* Star input */}
      <div
        className="mt-4 flex items-center gap-1"
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
            disabled={submitting || parentPending}
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-7 w-7 ${
                value <= displayRating
                  ? "fill-amber-400 text-amber-500"
                  : "text-amber-200"
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm font-medium text-[var(--ink)]">
            {rating}/5
          </span>
        )}
      </div>

      {/* Optional comment */}
      <div className="mt-4">
        <Field label="Comment" hint="Optional — anything we should know?">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tell us what worked, what didn't, or how we can improve."
            rows={3}
            maxLength={2000}
            disabled={submitting || parentPending}
          />
        </Field>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--ink-soft)]">
          {savedAt
            ? `Last saved ${new Date(savedAt).toLocaleString()}`
            : "Skip if you'd rather not."}
        </p>
        <Button
          onClick={() => void handleSubmit()}
          disabled={disabled}
          className="sm:w-auto"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isUpdate ? "Update feedback" : "Submit feedback"}
        </Button>
      </div>

      {otherEntry ? (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
            From the {otherEntry.role}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={`h-4 w-4 ${
                  value <= otherEntry.rating
                    ? "fill-amber-400 text-amber-500"
                    : "text-amber-200"
                }`}
              />
            ))}
            <span className="ml-1 text-sm font-medium text-[var(--ink)]">
              {otherEntry.rating}/5
            </span>
          </div>
          {otherEntry.comment ? (
            <p className="mt-2 whitespace-pre-line text-sm text-[var(--ink)]">
              {otherEntry.comment}
            </p>
          ) : (
            <p className="mt-2 text-xs italic text-[var(--ink-soft)]">
              No comment — they only left a rating.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FeedbackSummary({ feedback }: { feedback: DealFeedbackEntry[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
      <h3 className="text-base font-semibold text-[var(--ink)]">
        Deal feedback
      </h3>
      <ul className="mt-3 space-y-3">
        {feedback.map((entry) => (
          <li
            key={entry.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
              {entry.role}
            </p>
            <div className="mt-1 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <Star
                  key={v}
                  className={`h-4 w-4 ${
                    v <= entry.rating
                      ? "fill-amber-400 text-amber-500"
                      : "text-amber-200"
                  }`}
                />
              ))}
              <span className="ml-1 text-sm font-medium text-[var(--ink)]">
                {entry.rating}/5
              </span>
            </div>
            {entry.comment ? (
              <p className="mt-2 whitespace-pre-line text-sm text-[var(--ink)]">
                {entry.comment}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
