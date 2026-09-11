// Dragon foil shaders - holographic foil effect with rainbow iridescence

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
  uniform float uTime;
  uniform float uHover;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  
  // Rainbow/holographic color generation
  vec3 rainbow(float t) {
    t = fract(t);
    float r = abs(t * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(t * 6.0 - 2.0);
    float b = 2.0 - abs(t * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
  }
  
  // Fresnel effect for rim lighting
  float fresnel(vec3 viewDir, vec3 normal, float power) {
    return pow(1.0 - abs(dot(viewDir, normal)), power);
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
    
    // Mouse-reactive offset for holographic effect
    vec2 mouseOffset = (vUv - uMouse) * 0.5;
    float mouseDist = length(mouseOffset);
    
    // Animated rotation for shimmer
    float angle = uTime * 0.3 + mouseDist * 2.0;
    vec2 shimmerUV = vec2(
      cos(angle) * mouseOffset.x - sin(angle) * mouseOffset.y,
      sin(angle) * mouseOffset.x + cos(angle) * mouseOffset.y
    );
    
    // Holographic rainbow based on UV and time
    float rainbowT = shimmerUV.x * 2.0 + shimmerUV.y * 1.5 + uTime * 0.2;
    vec3 rainbowColor = rainbow(rainbowT);
    
    // Fresnel rim light
    float fresnelFactor = fresnel(viewDir, vNormal, 3.0);
    
    // Foil intensity from mask (texture2D already returns 0-1, DON'T divide by 255!)
    float foilIntensity = foilMask.r;
    
    // Base material color (orange head #FF6B35, dark eyes #0A0A0A from SVG)
    vec3 baseRGB = baseColor.rgb;
    float baseLuminance = dot(baseRGB, vec3(0.299, 0.587, 0.114));
    
    // Force dark matte for near-black pixels (eyes) - ignore foil overlay
    if (baseLuminance < 0.1) {
      // Eyes: stay dark matte, no rainbow glow
      gl_FragColor = vec4(baseRGB * 0.8, baseColor.a);
      return;
    }
    
    // Orange head: apply foil as additive shimmer overlay
    vec3 foilOverlay = rainbowColor * foilIntensity * 0.8;
    foilOverlay += fresnelFactor * rainbowColor * foilIntensity * 0.4;
    
    // Idle shimmer (subtle)
    float shimmer = sin(uTime * 2.0 + vUv.x * 10.0 + vUv.y * 8.0) * 0.5 + 0.5;
    foilOverlay += rainbowColor * shimmer * foilIntensity * 0.1;
    
    // Final: base orange + foil overlay (not replacement)
    vec3 finalColor = baseRGB + foilOverlay;
    
    // Hover effect
    finalColor += vec3(0.05) * uHover * foilIntensity;
    
    gl_FragColor = vec4(finalColor, baseColor.a);
  }
`;
