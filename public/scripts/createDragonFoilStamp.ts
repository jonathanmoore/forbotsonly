import * as THREE from 'three';
import { vertexShader, fragmentShader } from './dragonFoilShaders.ts';

export interface DragonFoilStampOptions {
  container: HTMLElement;
  imageSrc: string;
  foilSrc: string;
  width?: number;
  height?: number;
  // JM Dragon foil conventions
  foilSaturation?: number;  // 0.11 = chrome/silver (low sat for monochrome metallic)
  foilOpacity?: number;     // 0.92 default (high for strong replacement over orange)
  foilContrast?: number;    // 1.75 default (enhanced metallic pop)
}

export interface DragonFoilStamp {
  destroy: () => void;
  setHover: (hover: boolean) => void;
}

export function createDragonFoilStamp(options: DragonFoilStampOptions): DragonFoilStamp {
  const {
    container,
    imageSrc,
    foilSrc,
    width = 600,
    height = 600,
    foilSaturation = 0.11,  // Low saturation for silvery chrome
    foilOpacity = 0.92,     // Very high opacity for strong silver replacement over orange
    foilContrast = 1.75,    // Tuned contrast for metallic pop without over-brightening
  } = options;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // Textures
  const textureLoader = new THREE.TextureLoader();
  const diffuseTexture = textureLoader.load(imageSrc);
  const foilTexture = textureLoader.load(foilSrc);

  // Shader material
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tDiffuse: { value: diffuseTexture },
      tFoil: { value: foilTexture },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTilt: { value: new THREE.Vector2(0.0, 0.0) },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uFoilSaturation: { value: foilSaturation },
      uFoilOpacity: { value: foilOpacity },
      uFoilContrast: { value: foilContrast },
    },
    transparent: true,
    side: THREE.DoubleSide,
  });

  // Geometry
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Motion tracking state
  let mouseX = 0.5;
  let mouseY = 0.5;
  let targetMouseX = 0.5;
  let targetMouseY = 0.5;
  let tiltX = 0.0;
  let tiltY = 0.0;
  let targetTiltX = 0.0;
  let targetTiltY = 0.0;
  let isHovering = false;
  let targetHover = 0;
  let currentHover = 0;

  // Window-level pointer tracking (pointerSpace: 'window' from JM conventions)
  const handleMouseMove = (event: MouseEvent) => {
    // Normalize to 0-1 across entire window (not just container)
    targetMouseX = event.clientX / window.innerWidth;
    targetMouseY = 1.0 - (event.clientY / window.innerHeight);
  };

  const handleMouseEnter = () => {
    isHovering = true;
    targetHover = 1;
  };

  const handleMouseLeave = () => {
    isHovering = false;
    targetHover = 0;
  };

  // Device orientation support (phone tilt)
  let orientationPermissionGranted = false;
  
  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (!event.beta || !event.gamma) return;
    
    // β (beta): front-to-back tilt (-180 to 180)
    // γ (gamma): left-to-right tilt (-90 to 90)
    // Normalize and invert for natural feeling
    targetTiltX = Math.max(-1, Math.min(1, event.gamma / 45)); // -1 to 1
    targetTiltY = Math.max(-1, Math.min(1, event.beta / 45));  // -1 to 1
  };

  // Request orientation permission on iOS 13+
  const requestOrientationPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          orientationPermissionGranted = true;
          window.addEventListener('deviceorientation', handleOrientation);
        }
      } catch (error) {
        console.log('Orientation permission denied or not supported');
      }
    } else {
      // Non-iOS or older iOS - add listener directly
      orientationPermissionGranted = true;
      window.addEventListener('deviceorientation', handleOrientation);
    }
  };

  // Auto-request orientation on first user interaction
  const handleFirstInteraction = () => {
    if (!orientationPermissionGranted) {
      requestOrientationPermission();
    }
    window.removeEventListener('click', handleFirstInteraction);
    window.removeEventListener('touchstart', handleFirstInteraction);
  };

  // Event listeners
  window.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseenter', handleMouseEnter);
  container.addEventListener('mouseleave', handleMouseLeave);
  window.addEventListener('click', handleFirstInteraction);
  window.addEventListener('touchstart', handleFirstInteraction);

  // Animation loop
  let animationId: number;
  const clock = new THREE.Clock();

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    // Smooth mouse following
    mouseX += (targetMouseX - mouseX) * 0.1;
    mouseY += (targetMouseY - mouseY) * 0.1;

    // Smooth tilt following
    tiltX += (targetTiltX - tiltX) * 0.1;
    tiltY += (targetTiltY - tiltY) * 0.1;

    // Smooth hover transition
    currentHover += (targetHover - currentHover) * 0.1;

    // Update uniforms
    material.uniforms.uMouse.value.set(mouseX, mouseY);
    material.uniforms.uTilt.value.set(tiltX, tiltY);
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uHover.value = currentHover;

    // Idle wander when no interaction (subtle drift)
    if (!isHovering && !orientationPermissionGranted) {
      const idleX = 0.5 + Math.sin(elapsed * 0.5) * 0.1;
      const idleY = 0.5 + Math.cos(elapsed * 0.3) * 0.1;
      targetMouseX = idleX;
      targetMouseY = idleY;
    }

    renderer.render(scene, camera);
  };

  animate();

  // Handle window resize
  const handleResize = () => {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
  };

  window.addEventListener('resize', handleResize);

  // Public API
  return {
    destroy: () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      diffuseTexture.dispose();
      foilTexture.dispose();
      container.removeChild(renderer.domElement);
    },
    setHover: (hover: boolean) => {
      targetHover = hover ? 1 : 0;
    },
  };
}
