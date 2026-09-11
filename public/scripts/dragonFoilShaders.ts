// Dragon foil shaders - Chrome/pewter metallic foil effect
// Target: Cool silver metallic with pointer-driven shimmer (JM style)
// Fix #23 iterate 8: Restore high-power specular glints (256+) for metallic read
// Previous #43: Achromatic chrome (sat=0) + hard threshold fixed peach BUT low specular → matte
// This iter: Keep achromatic + threshold, restore sharp metallic highlights (not matte white)

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
    // CRITICAL: Pure achromatic metallic with STRONG CONTRAST for visible bands
    // Dark darks + bright brights = visible shimmer (previous palette was too bright/washed out)
    vec3 darkPewter = vec3(0.28);         // Dark pewter for contrast
    vec3 midSilver = vec3(0.60);          // Mid silver  
    vec3 brightChrome = vec3(0.92);       // Bright chrome highlight
    
    float phase = fract(t);
    vec3 baseColor;
    
    // Smooth transition through metallic range
    if (phase < 0.33) {
      baseColor = mix(darkPewter, midSilver, phase * 3.0);
    } else if (phase < 0.67) {
      baseColor = mix(midSilver, brightChrome, (phase - 0.33) * 3.0);
    } else {
      baseColor = mix(brightChrome, darkPewter, (phase - 0.67) * 3.0);
    }
    
    // Enforce achromatic chrome when saturation = 0
    float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luma), baseColor, saturation);
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
    // ITER 8: Increased strength multiplier for more pronounced normal variation
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
    
    // CRITICAL FIX: Desaturate base where foil will be applied
    // This prevents orange from contaminating the metallic chrome
    // Use luminance as the blend base instead of saturated orange
    vec3 desaturatedBase = vec3(baseLuminance);
    
    // Calculate view direction
    vec3 viewDir = normalize(vViewPosition);
    
    // Foil intensity from mask
    float foilIntensity = foilMask.r;
    
    // Calculate surface normal from bevel heightmap
    // ITER 8: Increased bevel strength for more pronounced normal variation (better specular read)
    vec3 surfaceNormal = calculateBevelNormal(vUv, tFoil, 4.0);
    
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
    
    // ITER 8 FIX: High-power specular glints for metallic pewter/chrome (not matte white)
    // JM reference uses ~256 shininess + strong contributions for sharp moving highlights
    // Previous #43 values (32/16/8 shininess, 0.8/0.4/0.5/0.3 contributions) → matte appearance
    float spec1 = calculateSpecular(surfaceNormal, lightDir1, viewDir, 256.0);  // Primary sharp glint
    float spec2 = calculateSpecular(surfaceNormal, lightDir2, viewDir, 128.0);  // Secondary highlight
    float spec3 = calculateSpecular(surfaceNormal, lightDir1, viewDir, 64.0);   // Broader sheen layer
    float specRim = calculateSpecular(surfaceNormal, rimLight, viewDir, 32.0);  // Rim accent
    
    // Fresnel rim for metallic edges
    float fresnelFactor = fresnel(viewDir, surfaceNormal, 3.0);
    
    // Keep low ambient for dark pewter recesses (contrast requirement)
    vec3 ambient = chromeColor * 0.22;
    
    // Diffuse-like term (metallic surfaces still have some directionality)
    float diffuse = max(0.0, dot(surfaceNormal, lightDir1)) * 0.5;
    
    // ITER 8: Restore strong specular contributions for metallic read
    // Wide luminance range: dark ambient (0.22) + bright glints (1.5+) = pewter/chrome
    vec3 lighting = ambient + 
                    chromeColor * diffuse +
                    chromeColor * spec1 * 1.5 +       // Sharp primary glint (boosted)
                    chromeColor * spec2 * 1.2 +       // Secondary highlight (boosted)
                    chromeColor * spec3 * 0.8 +       // Broader sheen layer (new)
                    vec3(0.96) * specRim * 0.9 +      // Rim contribution (boosted)
                    vec3(0.88) * fresnelFactor * 0.6; // Fresnel contribution (boosted)
    
    // Apply contrast boost for metallic pop
    lighting = pow(lighting, vec3(1.0 / uFoilContrast));
    
    // Subtle animated shimmer on highlights - pure achromatic
    float shimmer = sin(uTime * 1.2 + vUv.x * 10.0 + vUv.y * 8.0) * 0.5 + 0.5;
    lighting += vec3(0.92) * shimmer * foilIntensity * 0.04; // Already achromatic
    
    // CRITICAL FIX v3: Replace orange with chrome using desaturated base
    // Root cause: ANY blending/mixing of orange with chrome produces warm peach
    // Solution: Where foil exists, completely REPLACE orange with chrome (no mix/blend)
    float foilBlend = foilIntensity * uFoilOpacity;
    
    // Use pure chrome lighting where foil is strong (>0.5)
    // Use orange only where foil is absent (<0.2)  
    // Sharp threshold to prevent warm contamination
    vec3 finalColor;
    if (foilBlend > 0.5) {
      // Foil zone: PURE achromatic chrome, completely replace orange
      finalColor = lighting;
    } else if (foilBlend < 0.2) {
      // No foil: Show orange base
      finalColor = baseRGB;
    } else {
      // Narrow edge: Blend between gray base (not orange!) and chrome
      float edgeFactor = (foilBlend - 0.2) / 0.3; // 0 at 0.2, 1 at 0.5
      vec3 grayBase = vec3(baseLuminance * 0.9); // Slightly darkened gray, not orange
      finalColor = mix(grayBase, lighting, edgeFactor);
    }
    
    // Hover effect (subtle brightness boost) - achromatic boost only
    finalColor += vec3(0.06) * uHover * foilIntensity; // Already achromatic
    
    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;
