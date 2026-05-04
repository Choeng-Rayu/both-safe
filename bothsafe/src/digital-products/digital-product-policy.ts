export const allowedProductTypes = [
  'EBOOK',
  'TEMPLATE',
  'COURSE',
  'DESIGN_ASSET',
  'SOFTWARE_DOWNLOAD',
  'LICENSE_KEY',
] as const;

export const blockedProductKeywords = [
  'account resale',
  'credential',
  'hacked',
  'gambling',
  'casino',
  'investment signal',
  'adult',
  'illegal download',
];

export const allowedMimeTypes = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const maxDigitalFileSizeBytes = 512 * 1024 * 1024;

export function assertSafeDigitalProductDescription(text: string): void {
  const normalized = text.toLowerCase();
  const blocked = blockedProductKeywords.find((keyword) =>
    normalized.includes(keyword),
  );

  if (blocked) {
    throw new Error(`Blocked digital product keyword: ${blocked}`);
  }
}

export function validateUploadMetadata(input: {
  mimeType: string;
  fileSize: bigint | number;
}) {
  const size = BigInt(input.fileSize);

  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }

  if (size <= 0n || size > BigInt(maxDigitalFileSizeBytes)) {
    throw new Error('File size is outside the allowed range');
  }
}
