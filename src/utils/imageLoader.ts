/**
 * Utility to load original raster image assets directly from public/ paths.
 * Strictly NO AI generation, NO redrawing, NO SVGs, NO hardcoded base64 strings.
 * Reads real binary image files from public paths and calculates exact natural dimensions.
 */

export interface LoadedPublicImage {
  data: Uint8Array | HTMLImageElement;
  width: number;
  height: number;
  aspect: number;
  format: 'PNG' | 'JPEG';
}

const memoryCache = new Map<string, LoadedPublicImage>();

/**
 * Loads an image directly from its public absolute path (e.g. '/loghi_originali_pdf.png')
 * preserving 100% of the original raster pixels without any alteration.
 */
export async function loadOriginalPublicImage(publicUrl: string): Promise<LoadedPublicImage> {
  if (memoryCache.has(publicUrl)) {
    return memoryCache.get(publicUrl)!;
  }

  const cleanUrl = publicUrl.split('?')[0];
  const isJpeg = cleanUrl.toLowerCase().endsWith('.jpg') || cleanUrl.toLowerCase().endsWith('.jpeg');
  const format: 'PNG' | 'JPEG' = isJpeg ? 'JPEG' : 'PNG';

  if (typeof window !== 'undefined') {
    // In Browser: fetch original binary file from the public path and decode via Image element
    const response = await fetch(publicUrl);
    if (!response.ok) {
      throw new Error(`Impossibile caricare il file originale da: ${publicUrl} (status ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Get exact intrinsic dimensions from Image object
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      };
      img.onerror = () => reject(new Error(`Errore decodifica immagine da: ${publicUrl}`));
      img.src = publicUrl;
    });

    const result: LoadedPublicImage = {
      data: uint8,
      width: dimensions.width,
      height: dimensions.height,
      aspect: dimensions.width / dimensions.height,
      format,
    };
    memoryCache.set(publicUrl, result);
    return result;
  } else {
    // In Node.js environment (for verification scripts/CLI)
    const fs = await import('fs');
    const path = await import('path');
    const cleanPath = publicUrl.split('?')[0].replace(/^\//, '');
    const fullPath = path.join(process.cwd(), 'public', cleanPath);
    const buffer = fs.readFileSync(fullPath);
    const uint8 = new Uint8Array(buffer);

    let width = 100;
    let height = 100;
    if (!isJpeg && uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
      width = (uint8[16] << 24) | (uint8[17] << 16) | (uint8[18] << 8) | uint8[19];
      height = (uint8[20] << 24) | (uint8[21] << 16) | (uint8[22] << 8) | uint8[23];
    } else if (isJpeg) {
      // Find JPEG SOF0/SOF2 marker
      for (let i = 0; i < uint8.length - 8; i++) {
        if (uint8[i] === 0xFF && (uint8[i + 1] === 0xC0 || uint8[i + 1] === 0xC2)) {
          height = (uint8[i + 5] << 8) | uint8[i + 6];
          width = (uint8[i + 7] << 8) | uint8[i + 8];
          break;
        }
      }
    }

    const result: LoadedPublicImage = {
      data: uint8,
      width,
      height,
      aspect: width / height,
      format,
    };
    memoryCache.set(publicUrl, result);
    return result;
  }
}
