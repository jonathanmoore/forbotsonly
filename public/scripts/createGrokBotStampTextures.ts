// Generate silhouette and foil mask textures from SVG
// Keeps original SVG colors (orange head, dark eyes) with subtle foil overlay

export interface StampTextures {
  silhouette: string; // Data URL for silhouette (ORIGINAL colors - orange head, dark eyes)
  foil: string; // Data URL for foil mask (low foil on head/eyes, higher on rim only)
}

export async function createGrokBotStampTextures(svgSrc: string, size = 1024): Promise<StampTextures> {
  // Load SVG
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svgSrc;
  });

  // Create silhouette texture - KEEP ORIGINAL COLORS (orange head #FF6B35, dark eyes #0A0A0A)
  const silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = size;
  silhouetteCanvas.height = size;
  const silhouetteCtx = silhouetteCanvas.getContext('2d')!;
  
  // Draw SVG as-is (preserves original colors)
  silhouetteCtx.drawImage(img, 0, 0, size, size);
  
  // NO desaturation, NO grey conversion - keep orange and black from SVG

  // Create foil mask - rim gets shimmer, head/eyes stay mostly matte so color shows through
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = size;
  foilCanvas.height = size;
  const foilCtx = foilCanvas.getContext('2d')!;
  
  // Fill black (outside mark)
  foilCtx.fillStyle = '#000000';
  foilCtx.fillRect(0, 0, size, size);
  
  // Draw SVG for shape detection
  foilCtx.drawImage(img, 0, 0, size, size);
  
  // Create foil mask: low foil on head/eyes (matte), higher only on rim (shimmer)
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
          // Rim/edge → moderate foil for subtle shimmer
          brightness = 120;
        } else if (luminance < 50) {
          // Dark pixels (eyes) → VERY LOW foil so they stay dark matte (not rainbow glow)
          brightness = 10;
        } else {
          // Light pixels (orange head) → LOW foil so orange shows through as matte
          brightness = 40;
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
  
  // Light blur on foil mask for smooth transitions
  foilCtx.filter = 'blur(3px)';
  foilCtx.drawImage(foilCanvas, 0, 0);

  return {
    silhouette: silhouetteCanvas.toDataURL('image/png'),
    foil: foilCanvas.toDataURL('image/png'),
  };
}
