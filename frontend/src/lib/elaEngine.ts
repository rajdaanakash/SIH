/**
 * Client-Side Error Level Analysis (ELA) Engine
 * Compares an original image with a re-saved JPEG version to detect localized compression anomalies.
 */
export async function computeClientEla(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  scale: number = 25
): Promise<{ elaDataUrl: string; anomalyScore: number }> {
  return new Promise((resolve) => {
    const width = imageSource.width || 600;
    const height = imageSource.height || 400;

    // Canvas 1: Original image
    const canvasOrig = document.createElement('canvas');
    canvasOrig.width = width;
    canvasOrig.height = height;
    const ctxOrig = canvasOrig.getContext('2d');
    if (!ctxOrig) {
      resolve({ elaDataUrl: '', anomalyScore: 0 });
      return;
    }
    ctxOrig.drawImage(imageSource, 0, 0, width, height);
    const origData = ctxOrig.getImageData(0, 0, width, height);

    // Re-save at quality 0.75
    const jpegUrl = canvasOrig.toDataURL('image/jpeg', 0.75);
    const recompressedImg = new Image();
    recompressedImg.crossOrigin = 'anonymous';
    recompressedImg.onload = () => {
      // Canvas 2: Recompressed
      const canvasRecomp = document.createElement('canvas');
      canvasRecomp.width = width;
      canvasRecomp.height = height;
      const ctxRecomp = canvasRecomp.getContext('2d');
      if (!ctxRecomp) {
        resolve({ elaDataUrl: '', anomalyScore: 0 });
        return;
      }
      ctxRecomp.drawImage(recompressedImg, 0, 0, width, height);
      const recompData = ctxRecomp.getImageData(0, 0, width, height);

      // Canvas 3: ELA Difference output
      const canvasDiff = document.createElement('canvas');
      canvasDiff.width = width;
      canvasDiff.height = height;
      const ctxDiff = canvasDiff.getContext('2d');
      if (!ctxDiff) {
        resolve({ elaDataUrl: '', anomalyScore: 0 });
        return;
      }
      const diffData = ctxDiff.createImageData(width, height);

      let totalDiff = 0;
      let maxDiff = 0;
      const pixelCount = width * height;

      for (let i = 0; i < origData.data.length; i += 4) {
        const dr = Math.abs(origData.data[i] - recompData.data[i]) * scale;
        const dg = Math.abs(origData.data[i + 1] - recompData.data[i + 1]) * scale;
        const db = Math.abs(origData.data[i + 2] - recompData.data[i + 2]) * scale;

        const avgDiff = (dr + dg + db) / 3;
        totalDiff += avgDiff;
        if (avgDiff > maxDiff) maxDiff = avgDiff;

        // Visual Heatmap mapping: cool dark indigo for low diff, neon cyan/orange/red for high diff
        if (avgDiff > 180) {
          diffData.data[i] = Math.min(255, dr * 1.4);     // High Alert: Crimson/Orange
          diffData.data[i + 1] = Math.max(0, 255 - dg);
          diffData.data[i + 2] = 40;
        } else if (avgDiff > 90) {
          diffData.data[i] = 30;                          // Medium: Cyan / Turquoise
          diffData.data[i + 1] = Math.min(255, dg * 1.3);
          diffData.data[i + 2] = Math.min(255, db * 1.5);
        } else {
          diffData.data[i] = Math.min(255, dr * 0.4);     // Low / Normal background: Deep Slate
          diffData.data[i + 1] = Math.min(255, dg * 0.4);
          diffData.data[i + 2] = Math.min(255, db * 0.7 + 20);
        }
        diffData.data[i + 3] = 255;
      }

      ctxDiff.putImageData(diffData, 0, 0);

      // Normalize anomaly score between 0.00 and 1.00
      const meanDiff = totalDiff / pixelCount;
      const anomalyScore = Math.min(1.0, Math.max(0.02, meanDiff / 80));

      resolve({
        elaDataUrl: canvasDiff.toDataURL('image/png'),
        anomalyScore: Number(anomalyScore.toFixed(2)),
      });
    };
    recompressedImg.src = jpegUrl;
  });
}
