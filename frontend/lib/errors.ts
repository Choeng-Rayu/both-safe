import { ApiError } from "@/lib/api";

export function getErrorMessage(
  error: unknown,
  translate: (key: string) => string,
) {
  if (error instanceof ApiError) {
    const translated = translate(`errors.${error.messageKey}`);
    return translated === `errors.${error.messageKey}` ? error.message : translated;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return translate("errors.fallback");
}
