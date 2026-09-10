// Generate silhouette and foil mask textures from SVG
// Orange head with HIGH foil shimmer, dark eye cutouts with LOW foil (stay matte black)

export interface StampTextures {
  silhouette: string; // Data URL (original colors: orange head, dark eyes)
  foil: string; // Data URL (HIGH foil on orange head/rim, LOW on dark eyes)
}

export async function createGrokBotStampTextures(svgSrc: string, size = 1024): Promise<StampTextures> {
  // Load SVG
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svgSrc;
  });

  // Silhouette texture - KEEP ORIGINAL COLORS (orange #FF6B35 head, dark #0A0A0A eyes)
  const silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = size;
  silhouetteCanvas.height = size;
  const silhouetteCtx = silhouetteCanvas.getContext('2d')!;
  
  // Draw SVG as-is (preserves orange and dark colors)
  silhouetteCtx.drawImage(img, 0, 0, size, size);
  
  // NO conversion - keep original RGB values from SVG

  // Foil mask - INVERTED: HIGH foil on orange head (shimmer), LOW foil on dark eyes (matte slots)
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = size;
  foilCanvas.height = size;
  const foilCtx = foilCanvas.getContext('2d')!;
  
  // Fill black (outside mark)
  foilCtx.fillStyle = '#000000';
  foilCtx.fillRect(0, 0, size, size);
  
  // Draw SVG for luminance detection
  foilCtx.drawImage(img, 0, 0, size, size);
  
  // Create foil mask - INVERSE of previous: dark pixels (eyes) get LOW foil, light pixels (head) get HIGH foil
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
        
        // Edge detection for rim emphasis
        const neighbors = [
          foilData.data[((y - 1) * size + x) * 4 + 3],
          foilData.data[((y + 1) * size + x) * 4 + 3],
          foilData.data[(y * size + (x - 1)) * 4 + 3],
          foilData.data[(y * size + (x + 1)) * 4 + 3],
        ];
        const isEdge = neighbors.some(n => Math.abs(n - alpha) > 50);
        
        let brightness;
        if (isEdge) {
          // Rim → very high foil for strong bevel shimmer
          brightness = 200;
        } else if (luminance < 50) {
          // Dark pixels (eyes #0A0A0A) → VERY LOW foil, stay as dark matte slots
          brightness = 5;
        } else {
          // Light pixels (orange head #FF6B35) → HIGH foil for rainbow shimmer on orange
          brightness = 150;
        }
        
        tempData[idx] = brightness;
        tempData[idx + 1] = brightness;
        tempData[idx + 2] = brightness;
        tempData[idx + 3] = 255;
      } else {
        // Outside stays black
        tempData[idx] = 0;
        tempData[idx + 1] = 0;
        tempData[idx + 2] = 0;
        tempData[idx + 3] = 255;
      }
    }
  }
  
  foilData.data.set(tempData);
  foilCtx.putImageData(foilData, 0, 0);
  
  // Light blur for smooth foil gradients
  foilCtx.filter = 'blur(4px)';
  foilCtx.drawImage(foilCanvas, 0, 0);

  return {
    silhouette: silhouetteCanvas.toDataURL('image/png'),
    foil: foilCanvas.toDataURL('image/png'),
  };
}
