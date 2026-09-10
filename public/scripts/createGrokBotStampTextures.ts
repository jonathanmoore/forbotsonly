// Generate silhouette and foil mask textures from SVG
// Preserves face structure (eyes vs head) for readable Grok Bot mark

export interface StampTextures {
  silhouette: string; // Data URL for silhouette (preserves luminance - eyes dark, head light)
  foil: string; // Data URL for foil mask (eyes + rim bright white for detail)
}

export async function createGrokBotStampTextures(svgSrc: string, size = 1024): Promise<StampTextures> {
  // Load SVG
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svgSrc;
  });

  // Create silhouette texture - preserve luminance from SVG (desaturate, don't crush)
  const silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = size;
  silhouetteCanvas.height = size;
  const silhouetteCtx = silhouetteCanvas.getContext('2d')!;
  
  // Draw SVG
  silhouetteCtx.drawImage(img, 0, 0, size, size);
  
  // Preserve luminance: convert to greyscale but keep dark (eyes) vs light (head) contrast
  const silhouetteData = silhouetteCtx.getImageData(0, 0, size, size);
  for (let i = 0; i < silhouetteData.data.length; i += 4) {
    const r = silhouetteData.data[i];
    const g = silhouetteData.data[i + 1];
    const b = silhouetteData.data[i + 2];
    const alpha = silhouetteData.data[i + 3];
    
    if (alpha > 0) {
      // Desaturate to greyscale, preserving luminance (eyes stay dark, head stays light)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      silhouetteData.data[i] = luminance;
      silhouetteData.data[i + 1] = luminance;
      silhouetteData.data[i + 2] = luminance;
      // Keep alpha
    }
  }
  silhouetteCtx.putImageData(silhouetteData, 0, 0);

  // Create foil mask - eyes + rim get bright white (strong foil), body gets matte
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = size;
  foilCanvas.height = size;
  const foilCtx = foilCanvas.getContext('2d')!;
  
  // Fill black (outside mark)
  foilCtx.fillStyle = '#000000';
  foilCtx.fillRect(0, 0, size, size);
  
  // Draw SVG
  foilCtx.drawImage(img, 0, 0, size, size);
  
  // Create foil mask: dark pixels (eyes) → bright white (detail/foil), light pixels (head) → mid grey (matte)
  const foilData = foilCtx.getImageData(0, 0, size, size);
  const tempData = new Uint8ClampedArray(foilData.data);
  
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = (y * size + x) * 4;
      const r = foilData.data[idx];
      const g = foilData.data[idx + 1];
      const b = foilData.data[idx + 2];
      const alpha = foilData.data[idx + 3];
      
      if (alpha > 0) {
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Check for edges (silhouette rim)
        const neighbors = [
          foilData.data[((y - 1) * size + x) * 4 + 3],
          foilData.data[((y + 1) * size + x) * 4 + 3],
          foilData.data[(y * size + (x - 1)) * 4 + 3],
          foilData.data[(y * size + (x + 1)) * 4 + 3],
        ];
        const isEdge = neighbors.some(n => Math.abs(n - alpha) > 50);
        
        let brightness;
        if (isEdge) {
          // Rim/edge → bright white (strong foil)
          brightness = 255;
        } else if (luminance < 50) {
          // Dark pixels (eyes) → bright white (detail foil so eyes are visible)
          brightness = 255;
        } else {
          // Light pixels (head body) → mid grey (matte/subtle foil)
          brightness = 80;
        }
        
        tempData[idx] = brightness;
        tempData[idx + 1] = brightness;
        tempData[idx + 2] = brightness;
        tempData[idx + 3] = 255;
      } else {
        // Outside shape stays black
        tempData[idx] = 0;
        tempData[idx + 1] = 0;
        tempData[idx + 2] = 0;
        tempData[idx + 3] = 255;
      }
    }
  }
  
  foilData.data.set(tempData);
  foilCtx.putImageData(foilData, 0, 0);
  
  // Optional: light blur on foil mask (a16z style foilBlurPx)
  foilCtx.filter = 'blur(2px)';
  foilCtx.drawImage(foilCanvas, 0, 0);

  return {
    silhouette: silhouetteCanvas.toDataURL('image/png'),
    foil: foilCanvas.toDataURL('image/png'),
  };
}
