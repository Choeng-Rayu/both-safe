"use client";

import { DISPUTE_REASONS } from "@/lib/constants";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/deal/image-uploader";
import { useI18n } from "@/components/providers/app-providers";
import type { DisputeReason } from "@/types/api";

type DisputeFormProps = {
  reason: DisputeReason;
  message: string;
  file: File | null;
  onReasonChange: (reason: DisputeReason) => void;
  onMessageChange: (message: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
  pending?: boolean;
};

export function DisputeForm({
  reason,
  message,
  file,
  onReasonChange,
  onMessageChange,
  onFileChange,
  onSubmit,
  pending,
}: DisputeFormProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <Field label={t("dispute.reason")} required>
        <Select
          value={reason}
          onChange={(event) => onReasonChange(event.target.value as DisputeReason)}
        >
          {DISPUTE_REASONS.map((item) => (
            <option key={item} value={item}>
              {t(`dispute.reason.${item.toLowerCase()}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("dispute.message")} required>
        <Textarea value={message} onChange={(event) => onMessageChange(event.target.value)} />
      </Field>
      <Field label={t("dispute.evidence")}>
        <ImageUploader value={file} onChange={onFileChange} />
      </Field>
      <Button onClick={onSubmit} disabled={pending} className="w-full">
        {t("dispute.submit")}
      </Button>
    </div>
  );
}
