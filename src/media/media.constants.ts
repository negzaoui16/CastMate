export const GRIDFS_BUCKET_NAME = 'castmate_uploads';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];


