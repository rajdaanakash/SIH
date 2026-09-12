// Utility to convert any image source (SVG URL, blob URL, data URL, Image element)
// into a standardized JPEG Base64 string for Gemini Multimodal Vision API

export async function ensureJpegBase64(imageSrc: string): Promise<string> {
  if (!imageSrc) return '';

  // If it is already a JPEG or PNG data URL and not an SVG data URL
  if (imageSrc.startsWith('data:image/jpeg') || imageSrc.startsWith('data:image/png') || imageSrc.startsWith('data:image/webp')) {
    return imageSrc;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(640, img.naturalWidth || 800);
        canvas.height = Math.max(480, img.naturalHeight || 600);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const jpegBase64 = canvas.toDataURL('image/jpeg', 0.88);
          resolve(jpegBase64);
          return;
        }
      } catch (err) {
        console.warn('Canvas rasterization notice:', err);
      }
      resolve(imageSrc);
    };
    img.onerror = () => {
      // If direct load fails, try fetch -> blob -> dataURL
      fetch(imageSrc)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(imageSrc);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(imageSrc));
    };
    img.src = imageSrc;
  });
}
