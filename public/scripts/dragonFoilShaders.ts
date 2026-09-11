// Dragon foil shaders - Chrome/pewter metallic foil effect
// Target: Silvery raised bevel, NO rainbow (from JM reference images)
// Spec: foilSaturation 0.11 → nearly monochrome chrome

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
  
  // Chrome/pewter metallic (nearly monochrome with subtle warm/cool shift)
  vec3 chromeHighlight(float t, float saturation) {
    // Pure metallic: cool silver → neutral grey → warm pewter
    vec3 coolSilver = vec3(0.92, 0.93, 0.95);     // Cool white-silver
    vec3 neutralGrey = vec3(0.85, 0.85, 0.85);    // Neutral mid-tone
    vec3 warmPewter = vec3(0.88, 0.86, 0.84);     // Warm grey-pewter
    
    float phase = fract(t);
    vec3 baseColor;
    
    if (phase < 0.5) {
      baseColor = mix(coolSilver, neutralGrey, phase * 2.0);
    } else {
      baseColor = mix(neutralGrey, warmPewter, (phase - 0.5) * 2.0);
    }
    
    // Minimal saturation for pure metallic chrome look
    float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luma), baseColor, saturation);
  }
  
  // Fresnel effect for metallic rim lighting
  float fresnel(vec3 viewDir, vec3 normal, float power) {
    return pow(1.0 - abs(dot(viewDir, normal)), power);
  }
  
  // Enhanced bevel/emboss for raised foil depth
  float bevelDepth(vec2 uv, sampler2D foilMap, float strength) {
    vec2 texelSize = vec2(1.0 / 512.0);
    
    // Sample surrounding pixels for gradient
    float center = texture2D(foilMap, uv).r;
    float right = texture2D(foilMap, uv + vec2(texelSize.x, 0.0)).r;
    float left = texture2D(foilMap, uv - vec2(texelSize.x, 0.0)).r;
    float top = texture2D(foilMap, uv + vec2(0.0, texelSize.y)).r;
    float bottom = texture2D(foilMap, uv - vec2(0.0, texelSize.y)).r;
    
    // Calculate gradients (emboss effect)
    float dx = (right - left) * 0.5;
    float dy = (top - bottom) * 0.5;
    
    // Combine gradients for depth illusion
    float depth = (dx + dy) * strength;
    
    // Add specular highlight on raised edges
    float edgeHighlight = max(dx, dy) * 2.0;
    
    return depth + edgeHighlight * 0.5;
  }
  
  void main() {
    // Sample base silhouette and foil mask
    vec4 baseColor = texture2D(tDiffuse, vUv);
    vec4 foilMask = texture2D(tFoil, vUv);
    
    // Early discard for transparent areas
    if (baseColor.a < 0.01) {
      discard;
    }
    
    // Calculate view direction
    vec3 viewDir = normalize(vViewPosition);
    
    // Combined motion input: mouse + tilt
    vec2 motionOffset = (vUv - uMouse) * 0.4 + uTilt * 0.25;
    float motionDist = length(motionOffset);
    
    // Slow rotation for subtle shimmer (less aggressive than rainbow)
    float angle = uTime * 0.2 + motionDist * 1.5;
    vec2 shimmerUV = vec2(
      cos(angle) * motionOffset.x - sin(angle) * motionOffset.y,
      sin(angle) * motionOffset.x + cos(angle) * motionOffset.y
    );
    
    // Chrome metallic highlight (very low saturation)
    float chromePhase = shimmerUV.x * 1.5 + shimmerUV.y * 1.0 + uTime * 0.15;
    vec3 chromeColor = chromeHighlight(chromePhase, uFoilSaturation);
    
    // Fresnel rim for metallic edge
    float fresnelFactor = fresnel(viewDir, vNormal, 2.5);
    
    // Foil intensity from mask
    float foilIntensity = foilMask.r;
    
    // Multi-layer bevel for raised depth
    float bevel = bevelDepth(vUv, tFoil, 1.5) * foilIntensity;
    
    // Base material color (orange head #FF6B35, dark eyes #0A0A0A)
    vec3 baseRGB = baseColor.rgb;
    float baseLuminance = dot(baseRGB, vec3(0.299, 0.587, 0.114));
    
    // Force dark matte for eyes - NO foil
    if (baseLuminance < 0.1) {
      gl_FragColor = vec4(baseRGB * 0.8, baseColor.a);
      return;
    }
    
    // Layer 1: Base chrome specular
    vec3 specular = chromeColor * foilIntensity * uFoilOpacity * 0.6;
    
    // Layer 2: Fresnel rim adds metallic edge brightness
    specular += fresnelFactor * chromeColor * foilIntensity * 0.25;
    
    // Layer 3: Bevel adds raised depth (highlight on high edges, shadow on low)
    specular += vec3(bevel) * 0.6;
    
    // Layer 4: Directional highlight from motion
    float directionalHighlight = max(0.0, dot(normalize(motionOffset), vec2(0.7071, 0.7071)));
    specular += chromeColor * directionalHighlight * foilIntensity * 0.2;
    
    // Contrast boost for metallic pop
    specular = pow(specular, vec3(1.0 / uFoilContrast));
    
    // Very subtle idle shimmer (much less than before)
    float shimmer = sin(uTime * 1.5 + vUv.x * 8.0 + vUv.y * 6.0) * 0.5 + 0.5;
    specular += vec3(0.85) * shimmer * foilIntensity * 0.03; // Nearly white shimmer
    
    // Final: base orange + chrome foil layers (additive)
    vec3 finalColor = baseRGB + specular;
    
    // Hover effect (subtle)
    finalColor += vec3(0.04) * uHover * foilIntensity;
    
    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;
