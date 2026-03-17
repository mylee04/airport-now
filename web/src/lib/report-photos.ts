const REPORT_PHOTO_MAX_DIMENSION = 1400;
export const REPORT_PHOTO_TARGET_BYTES = 400_000;
const REPORT_PHOTO_HARD_MAX_BYTES = 4_000_000;
const REPORT_PHOTO_START_QUALITY = 0.84;
const REPORT_PHOTO_MIN_QUALITY = 0.56;

function buildJpegFilename(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, '').trim() || 'airport-now-report';
  return `${baseName}.jpg`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This photo format could not be read in the browser.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('The photo could not be compressed.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

async function renderCompressedPhoto(
  image: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser could not prepare the photo for upload.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvasToBlob(canvas, quality);
}

export function formatReportPhotoBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

export async function optimizeReportPhotoForUpload(file: File): Promise<{ file: File; optimized: boolean }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded here.');
  }

  const image = await loadImage(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, REPORT_PHOTO_MAX_DIMENSION / Math.max(originalWidth, originalHeight));
  let width = Math.max(1, Math.round(originalWidth * scale));
  let height = Math.max(1, Math.round(originalHeight * scale));
  let quality = REPORT_PHOTO_START_QUALITY;
  let attempts = 0;
  let blob = await renderCompressedPhoto(image, width, height, quality);

  while (blob.size > REPORT_PHOTO_TARGET_BYTES && attempts < 8) {
    if (quality > REPORT_PHOTO_MIN_QUALITY) {
      quality = Math.max(REPORT_PHOTO_MIN_QUALITY, quality - 0.08);
    } else {
      width = Math.max(480, Math.round(width * 0.85));
      height = Math.max(480, Math.round(height * 0.85));
    }

    blob = await renderCompressedPhoto(image, width, height, quality);
    attempts += 1;
  }

  if (blob.size > REPORT_PHOTO_HARD_MAX_BYTES) {
    throw new Error('This photo is still too large after compression. Try a tighter crop or another image.');
  }

  const optimizedFile = new File([blob], buildJpegFilename(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  const optimized =
    optimizedFile.size !== file.size ||
    optimizedFile.type !== file.type ||
    optimizedFile.name !== file.name ||
    width !== originalWidth ||
    height !== originalHeight;

  return {
    file: optimizedFile,
    optimized,
  };
}
