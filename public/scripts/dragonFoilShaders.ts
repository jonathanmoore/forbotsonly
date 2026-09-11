// Dragon foil shaders - Silvery metallic foil effect
// Ported from jonathanmoore.com DragonFoilStamp conventions
// Spec: foilSaturation 0.11 (chrome/silver), foilOpacity 0.44, foilContrast 1.68

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
  
  // Silvery metallic color with subtle hue shift (not full rainbow)
  vec3 metallicSheen(float t, float saturation) {
    // Cool silver-blue-violet palette for metallic foil
    vec3 silver = vec3(0.95, 0.96, 1.0);      // Cool white
    vec3 coolBlue = vec3(0.7, 0.85, 1.0);     // Light blue
    vec3 warmGold = vec3(1.0, 0.95, 0.8);     // Warm highlight
    
    float phase = fract(t);
    vec3 baseColor;
    
    if (phase < 0.33) {
      baseColor = mix(silver, coolBlue, phase * 3.0);
    } else if (phase < 0.66) {
      baseColor = mix(coolBlue, warmGold, (phase - 0.33) * 3.0);
    } else {
      baseColor = mix(warmGold, silver, (phase - 0.66) * 3.0);
    }
    
    // Desaturate to metallic chrome/silver
    float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
    return mix(vec3(luma), baseColor, saturation);
  }
  
  // Fresnel effect for metallic rim lighting
  float fresnel(vec3 viewDir, vec3 normal, float power) {
    return pow(1.0 - abs(dot(viewDir, normal)), power);
  }
  
  // Bevel/emboss from foil mask gradient
  float bevel(vec2 uv, sampler2D foilMap) {
    vec2 texelSize = vec2(1.0 / 512.0); // Approx texture resolution
    
    float center = texture2D(foilMap, uv).r;
    float right = texture2D(foilMap, uv + vec2(texelSize.x, 0.0)).r;
    float top = texture2D(foilMap, uv + vec2(0.0, texelSize.y)).r;
    
    float dx = center - right;
    float dy = center - top;
    
    return (dx + dy) * 0.5;
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
    
    // Combined motion input: mouse + tilt + time
    vec2 motionOffset = (vUv - uMouse) * 0.5 + uTilt * 0.3;
    float motionDist = length(motionOffset);
    
    // Animated rotation for shimmer
    float angle = uTime * 0.3 + motionDist * 2.0;
    vec2 shimmerUV = vec2(
      cos(angle) * motionOffset.x - sin(angle) * motionOffset.y,
      sin(angle) * motionOffset.x + cos(angle) * motionOffset.y
    );
    
    // Silvery metallic sheen (subtle hue shift)
    float sheenPhase = shimmerUV.x * 2.0 + shimmerUV.y * 1.5 + uTime * 0.2;
    vec3 metallicColor = metallicSheen(sheenPhase, uFoilSaturation);
    
    // Fresnel rim light for metallic edge
    float fresnelFactor = fresnel(viewDir, vNormal, 3.0);
    
    // Foil intensity from mask
    float foilIntensity = foilMask.r;
    
    // Bevel effect for raised metallic look
    float bevelAmount = bevel(vUv, tFoil) * foilIntensity;
    
    // Base material color (orange head #FF6B35, dark eyes #0A0A0A from SVG)
    vec3 baseRGB = baseColor.rgb;
    float baseLuminance = dot(baseRGB, vec3(0.299, 0.587, 0.114));
    
    // Force dark matte for near-black pixels (eyes) - ignore foil overlay
    if (baseLuminance < 0.1) {
      // Eyes: stay dark matte, no metallic glow
      gl_FragColor = vec4(baseRGB * 0.8, baseColor.a);
      return;
    }
    
    // Orange head: apply silvery foil as layered overlay
    // Metallic specular highlights
    vec3 specular = metallicColor * foilIntensity * uFoilOpacity;
    
    // Fresnel rim adds brightness at edges
    specular += fresnelFactor * metallicColor * foilIntensity * 0.3;
    
    // Bevel adds dimensionality (raised foil)
    specular += vec3(bevelAmount) * 0.4;
    
    // Contrast boost for metallic pop
    specular = pow(specular, vec3(1.0 / uFoilContrast));
    
    // Idle shimmer (very subtle on metallic)
    float shimmer = sin(uTime * 2.0 + vUv.x * 10.0 + vUv.y * 8.0) * 0.5 + 0.5;
    specular += metallicColor * shimmer * foilIntensity * 0.05;
    
    // Final: base orange + metallic foil overlay (additive)
    vec3 finalColor = baseRGB + specular;
    
    // Hover effect
    finalColor += vec3(0.05) * uHover * foilIntensity;
    
    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;
