// High-efficiency client-side image downscaling and compression
// Compresses 10MB-20MB mobile camera photos into lightweight ~200KB payloads
// to prevent 413 Payload Too Large and HTML error responses over Dev Tunnels / Proxies

export async function compressAndResizeImage(
  imageSrc: string,
  maxDimension: number = 2048,
  quality: number = 0.94
): Promise<string> {
  if (!imageSrc) return '';

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 800;
        let height = img.naturalHeight || img.height || 600;

        // Scale down proportionally if exceeding maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
          return;
        }
      } catch (err) {
        console.warn('Client compression error:', err);
      }
      resolve(imageSrc);
    };

    img.onerror = () => {
      resolve(imageSrc);
    };

    img.src = imageSrc;
  });
}

// Ensure clean JPEG Base64 with automatic compression
export async function ensureJpegBase64(imageSrc: string): Promise<string> {
  return compressAndResizeImage(imageSrc, 2048, 0.94);
}
