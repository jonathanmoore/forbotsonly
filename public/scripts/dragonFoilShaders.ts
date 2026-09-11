// Dragon foil shaders - Chrome/pewter metallic foil effect
// Target: Cool silver metallic with pointer-driven shimmer (JM style)
// Fix #23 iterate 7: Fully achromatic chrome (sat=0) blended over desaturated base
// Prevents orange contamination → NO PEACH, pure pewter/chrome bands

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
    
    // CRITICAL: Lower ambient for visible contrast bands (was 0.75, too bright/washed out)
    // Dark ambient + bright highlights = visible metallic shimmer
    vec3 ambient = chromeColor * 0.25;  // Low ambient for contrast
    
    // Diffuse-like term (metallic surfaces still have some directionality)
    float diffuse = max(0.0, dot(surfaceNormal, lightDir1)) * 0.5;
    
    // Combine lighting layers - ALL grayscale, balanced for visible contrast
    vec3 lighting = ambient + 
                    chromeColor * diffuse +
                    chromeColor * spec1 * 0.8 +       // Reduced to prevent washout
                    chromeColor * spec2 * 0.4 +       // Reduced to prevent washout
                    vec3(0.96) * specRim * 0.5 +      // Reduced rim contribution
                    vec3(0.86) * fresnelFactor * 0.3; // Reduced fresnel contribution
    
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
