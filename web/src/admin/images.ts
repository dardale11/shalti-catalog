import { helperFetchImage, uploadBlob } from '../api';

const MAX_SIDE = 1400;

// Downscale in the browser so phone photos don't upload as 5MB files.
async function shrink(file: Blob): Promise<Blob> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/webp', 0.85));
}

export const uploadImage = async (file: Blob) => uploadBlob(await shrink(file));

// Remote image (e.g. one the AI found) -> local helper downloads it -> shrink -> our storage.
export const importImage = async (url: string) => uploadImage(await helperFetchImage(url));
