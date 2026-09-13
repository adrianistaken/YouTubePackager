export function imageUploadError(file: Blob): string | null {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Use PNG, JPG, JPEG, or WebP.'
  if (file.size > 10 * 1024 * 1024) return 'Choose an image smaller than 10 MB.'
  return null
}
