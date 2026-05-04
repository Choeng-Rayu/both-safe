import {
  assertSafeDigitalProductDescription,
  validateUploadMetadata,
} from './digital-product-policy';

describe('digital product policy', () => {
  it('allows approved file metadata', () => {
    expect(() =>
      validateUploadMetadata({
        mimeType: 'application/pdf',
        fileSize: 1024,
      }),
    ).not.toThrow();
  });

  it('rejects unsafe MIME types and oversized files', () => {
    expect(() =>
      validateUploadMetadata({
        mimeType: 'application/x-msdownload',
        fileSize: 1024,
      }),
    ).toThrow('Unsupported file type');

    expect(() =>
      validateUploadMetadata({
        mimeType: 'application/pdf',
        fileSize: 1024 * 1024 * 1024,
      }),
    ).toThrow('File size is outside the allowed range');
  });

  it('blocks prohibited product categories', () => {
    expect(() =>
      assertSafeDigitalProductDescription('seller-owned course templates'),
    ).not.toThrow();
    expect(() =>
      assertSafeDigitalProductDescription('hacked credential bundle'),
    ).toThrow('Blocked digital product keyword');
  });
});
