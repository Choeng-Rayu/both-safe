"use client";

import { useState } from "react";
import { Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/app-providers";

export function CopyLinkButton({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className="gap-2"
    >
      {copied ? <LinkIcon className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? t("common.copied") : t("common.copy")}
    </Button>
  );
}
