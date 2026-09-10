// Generate silhouette and foil mask textures from SVG
// Similar to createA16zStampTextures pattern

export interface StampTextures {
  silhouette: string; // Data URL for silhouette (grey shape on transparent)
  foil: string; // Data URL for foil mask (black with white cutout)
}

export async function createGrokBotStampTextures(svgSrc: string, size = 1024): Promise<StampTextures> {
  // Load SVG
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = svgSrc;
  });

  // Create silhouette texture (grey shape on transparent)
  const silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = size;
  silhouetteCanvas.height = size;
  const silhouetteCtx = silhouetteCanvas.getContext('2d')!;
  
  // Draw SVG
  silhouetteCtx.drawImage(img, 0, 0, size, size);
  
  // Convert to grey silhouette
  const silhouetteData = silhouetteCtx.getImageData(0, 0, size, size);
  for (let i = 0; i < silhouetteData.data.length; i += 4) {
    const alpha = silhouetteData.data[i + 3];
    if (alpha > 0) {
      // Grey fill for the shape
      silhouetteData.data[i] = 180;
      silhouetteData.data[i + 1] = 180;
      silhouetteData.data[i + 2] = 180;
    }
  }
  silhouetteCtx.putImageData(silhouetteData, 0, 0);

  // Create foil mask texture (black body with bright details)
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = size;
  foilCanvas.height = size;
  const foilCtx = foilCanvas.getContext('2d')!;
  
  // Fill black
  foilCtx.fillStyle = '#000000';
  foilCtx.fillRect(0, 0, size, size);
  
  // Draw SVG again
  foilCtx.drawImage(img, 0, 0, size, size);
  
  // Create foil mask - detect edges and details for bright foil areas
  const foilData = foilCtx.getImageData(0, 0, size, size);
  const tempData = new Uint8ClampedArray(foilData.data);
  
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = (y * size + x) * 4;
      const alpha = foilData.data[idx + 3];
      
      if (alpha > 0) {
        // Check neighboring pixels for edges
        const neighbors = [
          foilData.data[((y - 1) * size + x) * 4 + 3],
          foilData.data[((y + 1) * size + x) * 4 + 3],
          foilData.data[(y * size + (x - 1)) * 4 + 3],
          foilData.data[(y * size + (x + 1)) * 4 + 3],
        ];
        
        const isEdge = neighbors.some(n => Math.abs(n - alpha) > 50);
        
        // Edges and details get bright foil (white)
        // Center areas get matte (dark grey)
        const brightness = isEdge ? 255 : 80;
        
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

  return {
    silhouette: silhouetteCanvas.toDataURL('image/png'),
    foil: foilCanvas.toDataURL('image/png'),
  };
}
