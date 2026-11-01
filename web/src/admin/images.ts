import { admin } from '../api';

const MAX_SIDE = 1400;

// Downscale in the browser so phone photos don't upload as 5MB files.
export async function uploadImage(file: File): Promise<string> {
  let blob: Blob = file;
  if (file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/webp', 0.85));
  }
  const { url } = await admin.post<{ url: string }>('/upload', blob);
  return url;
}

export async function importImage(url: string): Promise<string> {
  const r = await admin.post<{ url: string }>('/import-image', { url });
  return r.url;
}
