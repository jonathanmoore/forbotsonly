// Dragon foil shaders - JM COMPOSITOR PORT
// FIX #23 (iterate 6): Port JM's real foil compositor that KEEPS colored base
// 
// WHY #37-#40 FAILED: Threshold replacement (`if foilIntensity > 0.2 → lighting only`)
// discards the orange base, leaving only silver lighting. With nearly-flat bevel normals
// across the orange head, specular ≈ 1 everywhere → flat white disc. No amount of 
// constant retuning can fix a compositor that throws away the colored base.
//
// JM COMPOSITING (source of truth from jonathanmoore.com dragon foil):
// - Keep colored base (texColor.rgb / orange silhouette) under foil
// - Desaturate holographic rainbow via uFoilSaturation (~0.11) → chrome/silver
// - hardLight(baseColor_beveled, foilTint) then mix(finalBase, foilColor, foilStrength * uFoilOpacity)
// - foilOpacity ~0.44 allows orange to show through
// - Specular glints + bevel from foil-map gradients
// - Pointer drives light position (window space)

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
  uniform vec2 uTilt;
  uniform float uTime;
  uniform float uHover;
  uniform float uFoilSaturation;
  uniform float uFoilOpacity;
  uniform float uFoilContrast;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  // Fresnel effect for metallic rim lighting
  float fresnel(vec3 viewDir, vec3 normal, float power) {
    return pow(1.0 - abs(dot(viewDir, normal)), power);
  }
  
  // Hard light blend mode (from JM compositor)
  // Combines base color with overlay using photoshop-style hard light
  vec3 hardLight(vec3 base, vec3 blend) {
    vec3 result;
    result.r = (blend.r < 0.5) ? (2.0 * base.r * blend.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r));
    result.g = (blend.g < 0.5) ? (2.0 * base.g * blend.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g));
    result.b = (blend.b < 0.5) ? (2.0 * base.b * blend.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b));
    return result;
  }
  
  // Calculate surface normal from bevel heightmap
  vec3 calculateBevelNormal(vec2 uv, sampler2D foilMap, float strength) {
    vec2 texelSize = vec2(1.0 / 512.0);
    
    float center = texture2D(foilMap, uv).r;
    float right = texture2D(foilMap, uv + vec2(texelSize.x, 0.0)).r;
    float left = texture2D(foilMap, uv - vec2(texelSize.x, 0.0)).r;
    float top = texture2D(foilMap, uv + vec2(0.0, texelSize.y)).r;
    float bottom = texture2D(foilMap, uv - vec2(0.0, texelSize.y)).r;
    
    float dx = (right - left) * strength;
    float dy = (top - bottom) * strength;
    
    vec3 normal = normalize(vec3(-dx, -dy, 1.0));
    return normal;
  }
  
  // Calculate specular highlight
  float calculateSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess) {
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
    return spec;
  }
  
  // Holographic rainbow gradient (will be desaturated for chrome look)
  vec3 rainbowGradient(float t) {
    // Cycle through spectrum for holographic shimmer
    t = fract(t);
    vec3 c;
    if (t < 0.166) {
      c = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.5, 0.0), t * 6.0);
    } else if (t < 0.333) {
      c = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.166) * 6.0);
    } else if (t < 0.5) {
      c = mix(vec3(1.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0), (t - 0.333) * 6.0);
    } else if (t < 0.666) {
      c = mix(vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0), (t - 0.5) * 6.0);
    } else if (t < 0.833) {
      c = mix(vec3(0.0, 0.0, 1.0), vec3(0.5, 0.0, 1.0), (t - 0.666) * 6.0);
    } else {
      c = mix(vec3(0.5, 0.0, 1.0), vec3(1.0, 0.0, 0.0), (t - 0.833) * 6.0);
    }
    return c;
  }
  
  void main() {
    // Sample base silhouette and foil mask
    vec4 baseColor = texture2D(tDiffuse, vUv);
    vec4 foilMask = texture2D(tFoil, vUv);
    
    if (baseColor.a < 0.01) {
      discard;
    }
    
    // Base material color (orange head #FF6B35, dark eyes #0A0A0A)
    vec3 baseRGB = baseColor.rgb;
    float baseLuminance = dot(baseRGB, vec3(0.299, 0.587, 0.114));
    
    // Force dark matte for eyes - NO foil effect
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
    vec2 motionOffset = (vUv - uMouse) * 0.8 + uTilt * 0.4;
    float motionDist = length(motionOffset);
    
    // Dynamic light direction from pointer/tilt (JM convention)
    vec3 lightDir1 = normalize(vec3(motionOffset.x * 1.2, motionOffset.y * 1.2, 0.7));
    vec3 lightDir2 = normalize(vec3(-motionOffset.x * 0.7, -motionOffset.y * 0.7, 0.5));
    vec3 rimLight = normalize(vec3(0.0, 0.0, 1.0));
    
    // Rotating shimmer for holographic effect
    float angle = uTime * 0.15 + motionDist * 1.2;
    vec2 shimmerUV = vec2(
      cos(angle) * motionOffset.x - sin(angle) * motionOffset.y,
      sin(angle) * motionOffset.x + cos(angle) * motionOffset.y
    );
    
    // Generate holographic rainbow
    float rainbowPhase = shimmerUV.x * 1.8 + shimmerUV.y * 1.2 + uTime * 0.12;
    vec3 rainbowColor = rainbowGradient(rainbowPhase);
    
    // Desaturate rainbow to chrome/silver (JM foilSaturation ~0.11)
    float gray = dot(rainbowColor, vec3(0.299, 0.587, 0.114));
    vec3 chromeColor = mix(vec3(gray), rainbowColor, uFoilSaturation);
    
    // Calculate lighting components for foil
    float spec1 = calculateSpecular(surfaceNormal, lightDir1, viewDir, 32.0);
    float spec2 = calculateSpecular(surfaceNormal, lightDir2, viewDir, 16.0);
    float specRim = calculateSpecular(surfaceNormal, rimLight, viewDir, 8.0);
    float fresnelFactor = fresnel(viewDir, surfaceNormal, 3.0);
    
    // Build foil lighting
    float diffuse = max(0.0, dot(surfaceNormal, lightDir1)) * 0.5;
    vec3 foilLighting = chromeColor * (0.4 + diffuse) +              // Base chrome + diffuse
                        chromeColor * spec1 * 2.0 +                   // Primary specular
                        chromeColor * spec2 * 1.0 +                   // Secondary specular
                        vec3(0.95) * specRim * 1.2 +                  // Rim highlights
                        vec3(0.88) * fresnelFactor * 0.8;             // Fresnel edge
    
    // Apply contrast adjustment to foil lighting
    foilLighting = pow(foilLighting, vec3(uFoilContrast));
    
    // Subtle shimmer overlay
    float shimmer = sin(uTime * 1.2 + vUv.x * 10.0 + vUv.y * 8.0) * 0.5 + 0.5;
    foilLighting += vec3(0.92) * shimmer * foilIntensity * 0.05;
    
    // JM COMPOSITOR: Keep colored base, blend foil over it
    // 1. Apply bevel lighting to base (gives depth to orange)
    float bevelLight = max(0.3, dot(surfaceNormal, lightDir1));
    vec3 baseWithBevel = baseRGB * bevelLight;
    
    // 2. Hard light blend: combines beveled base with foil tint
    vec3 blendedColor = hardLight(baseWithBevel, foilLighting);
    
    // 3. Mix base with foil using opacity (JM foilOpacity ~0.44)
    //    Lower foilIntensity in mask → more orange shows through
    //    This is KEY: we never fully replace the orange, just overlay silver
    float foilStrength = foilIntensity * uFoilOpacity;
    vec3 finalColor = mix(baseWithBevel, blendedColor, foilStrength);
    
    // Add hover effect
    finalColor += vec3(0.06) * uHover * foilIntensity;
    
    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;
