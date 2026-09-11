// Dragon foil shaders - PURE SILVER/CHROME metallic foil effect
// Target: Silvery raised bevel, NO rainbow (from JM reference images)
// FIX #23 (iterate 5): REMOVE BUGGY CONTRAST - was brightening and washing out
// - Achromatic palette: vec3(0.35) → vec3(0.95) for proper contrast (from PR #38)
// - Threshold logic: foilIntensity > 0.2 ? silver : baseRGB (no mixing)
// - LOW ambient (0.28) to allow specular/fresnel to show as moving highlights
// - FIXED: Removed pow(lighting, 1.0/contrast) which was compressing dynamic range

export const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tFoil;
  uniform vec2 uMouse;
  uniform vec2 uTilt;       // Device orientation offset
  uniform float uTime;
  uniform float uHover;
  uniform float uFoilSaturation;
  uniform float uFoilOpacity;
  uniform float uFoilContrast;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  // Chrome/pewter metallic with proper specular range
  vec3 chromeHighlight(float t, float saturation) {
    // PURE ACHROMATIC SILVER with PROPER DYNAMIC RANGE
    // Darker base allows specular highlights to read as moving chrome
    vec3 darkSilver = vec3(0.35);       // Dark pewter recesses (not 0.70 bright gray)
    vec3 midSilver = vec3(0.60);        // Mid-tone silver (not 0.85 near-white)
    vec3 brightChrome = vec3(0.95);     // Bright chrome highlight (preserved)
    
    float phase = fract(t);
    vec3 baseColor;
    
    // Smooth transition through metallic range
    if (phase < 0.33) {
      baseColor = mix(darkSilver, midSilver, phase * 3.0);
    } else if (phase < 0.67) {
      baseColor = mix(midSilver, brightChrome, (phase - 0.33) * 3.0);
    } else {
      baseColor = mix(brightChrome, darkSilver, (phase - 0.67) * 3.0);
    }
    
    // Force completely achromatic - ignore saturation parameter for pure silver
    // (saturation kept in signature for API compatibility but not used)
    return baseColor;
  }
  
  // Fresnel effect for metallic rim lighting
  float fresnel(vec3 viewDir, vec3 normal, float power) {
    return pow(1.0 - abs(dot(viewDir, normal)), power);
  }
  
  // Enhanced bevel/emboss with proper normal mapping
  vec3 calculateBevelNormal(vec2 uv, sampler2D foilMap, float strength) {
    vec2 texelSize = vec2(1.0 / 512.0);
    
    // Sample height map (foil mask)
    float center = texture2D(foilMap, uv).r;
    float right = texture2D(foilMap, uv + vec2(texelSize.x, 0.0)).r;
    float left = texture2D(foilMap, uv - vec2(texelSize.x, 0.0)).r;
    float top = texture2D(foilMap, uv + vec2(0.0, texelSize.y)).r;
    float bottom = texture2D(foilMap, uv - vec2(0.0, texelSize.y)).r;
    
    // Calculate surface normal from height gradients
    float dx = (right - left) * strength;
    float dy = (top - bottom) * strength;
    
    // Normal vector pointing away from surface
    vec3 normal = normalize(vec3(-dx, -dy, 1.0));
    return normal;
  }
  
  // Calculate specular highlight from normal and light direction
  float calculateSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess) {
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
    return spec;
  }
  
  void main() {
    // Sample base silhouette and foil mask
    vec4 baseColor = texture2D(tDiffuse, vUv);
    vec4 foilMask = texture2D(tFoil, vUv);
    
    // Early discard for transparent areas
    if (baseColor.a < 0.01) {
      discard;
    }
    
    // Base material color (orange head #FF6B35, dark eyes #0A0A0A)
    vec3 baseRGB = baseColor.rgb;
    float baseLuminance = dot(baseRGB, vec3(0.299, 0.587, 0.114));
    
    // Force dark matte for eyes - NO foil
    if (baseLuminance < 0.1) {
      gl_FragColor = vec4(baseRGB * 0.8, baseColor.a);
      return;
    }
    
    // Calculate view direction
    vec3 viewDir = normalize(vViewPosition);
    
    // Foil intensity from mask
    float foilIntensity = foilMask.r;
    
    // Calculate surface normal from bevel heightmap
    vec3 surfaceNormal = calculateBevelNormal(vUv, tFoil, 2.5);
    
    // Combined motion input: mouse + tilt
    // Increased motion influence for more obvious pointer-driven highlight changes
    vec2 motionOffset = (vUv - uMouse) * 0.8 + uTilt * 0.4;  // Increased from 0.5, 0.3
    float motionDist = length(motionOffset);
    
    // Dynamic light direction from motion - stronger XY influence for visible sweeping
    vec3 lightDir1 = normalize(vec3(motionOffset.x * 1.2, motionOffset.y * 1.2, 0.7));
    vec3 lightDir2 = normalize(vec3(-motionOffset.x * 0.7, -motionOffset.y * 0.7, 0.5));
    vec3 rimLight = normalize(vec3(0.0, 0.0, 1.0));
    
    // Rotate chrome phase for shimmer
    float angle = uTime * 0.15 + motionDist * 1.2;
    vec2 shimmerUV = vec2(
      cos(angle) * motionOffset.x - sin(angle) * motionOffset.y,
      sin(angle) * motionOffset.x + cos(angle) * motionOffset.y
    );
    
    // Chrome metallic color (very low saturation silver/pewter)
    float chromePhase = shimmerUV.x * 1.8 + shimmerUV.y * 1.2 + uTime * 0.12;
    vec3 chromeColor = chromeHighlight(chromePhase, uFoilSaturation);
    
    // Multi-layer specular lighting
    float spec1 = calculateSpecular(surfaceNormal, lightDir1, viewDir, 32.0);
    float spec2 = calculateSpecular(surfaceNormal, lightDir2, viewDir, 16.0);
    float specRim = calculateSpecular(surfaceNormal, rimLight, viewDir, 8.0);
    
    // Fresnel rim for metallic edges
    float fresnelFactor = fresnel(viewDir, surfaceNormal, 3.0);
    
    // CRITICAL: LOW ambient base to create dynamic range
    // Dark recesses allow specular/fresnel highlights to read as sweeping chrome
    vec3 ambient = chromeColor * 0.28;  // LOW ambient (was 0.85 → flat white)
    
    // Diffuse-like term (metallic surfaces still have some directionality)
    float diffuse = max(0.0, dot(surfaceNormal, lightDir1)) * 0.5;
    
    // Combine lighting layers - balanced for visibility with low ambient
    // Specular highlights create the "moving chrome" effect over darker base
    vec3 lighting = ambient + 
                    chromeColor * diffuse +
                    chromeColor * spec1 * 1.8 +              // Primary highlight (strong)
                    chromeColor * spec2 * 0.9 +              // Secondary highlight
                    vec3(0.95) * specRim * 1.2 +             // Rim specular (bright white)
                    vec3(0.88) * fresnelFactor * 0.9;        // Fresnel edge glow
    
    // REMOVED BUGGY CONTRAST: was pow(lighting, 1.0/uFoilContrast) which BRIGHTENED
    // and compressed range, washing out to flat white. Natural lighting range is correct.
    
    // Subtle animated shimmer on highlights
    float shimmer = sin(uTime * 1.2 + vUv.x * 10.0 + vUv.y * 8.0) * 0.5 + 0.5;
    lighting += vec3(0.92) * shimmer * foilIntensity * 0.04;
    
    // THRESHOLD REPLACEMENT: Completely discard orange where foil exists
    // This eliminates all orange→silver mixing that was causing peach
    vec3 finalColor;
    if (foilIntensity > 0.2) {
      // Strong foil: use ONLY silver lighting (no baseRGB contamination)
      finalColor = lighting;
      
      // Apply hover effect to silver only
      finalColor += vec3(0.06) * uHover;
    } else {
      // Weak/no foil: show base color (orange face, dark eyes)
      finalColor = baseRGB;
    }
    
    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;
