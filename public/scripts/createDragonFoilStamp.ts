import * as THREE from 'three';
import { vertexShader, fragmentShader } from './dragonFoilShaders.ts';

export interface DragonFoilStampOptions {
  container: HTMLElement;
  imageSrc: string;
  foilSrc: string;
  width?: number;
  height?: number;
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
      uTime: { value: 0 },
      uHover: { value: 0 },
    },
    transparent: true,
    side: THREE.DoubleSide,
  });

  // Geometry
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Mouse tracking
  let mouseX = 0.5;
  let mouseY = 0.5;
  let targetMouseX = 0.5;
  let targetMouseY = 0.5;
  let isHovering = false;
  let targetHover = 0;
  let currentHover = 0;

  const handleMouseMove = (event: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    targetMouseX = (event.clientX - rect.left) / rect.width;
    targetMouseY = 1.0 - (event.clientY - rect.top) / rect.height;
  };

  const handleMouseEnter = () => {
    isHovering = true;
    targetHover = 1;
  };

  const handleMouseLeave = () => {
    isHovering = false;
    targetHover = 0;
    targetMouseX = 0.5;
    targetMouseY = 0.5;
  };

  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseenter', handleMouseEnter);
  container.addEventListener('mouseleave', handleMouseLeave);

  // Animation loop
  let animationId: number;
  const clock = new THREE.Clock();

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    const elapsed = clock.getElapsedTime();

    // Smooth mouse following
    mouseX += (targetMouseX - mouseX) * 0.1;
    mouseY += (targetMouseY - mouseY) * 0.1;

    // Smooth hover transition
    currentHover += (targetHover - currentHover) * 0.1;

    // Update uniforms
    material.uniforms.uMouse.value.set(mouseX, mouseY);
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uHover.value = currentHover;

    // Subtle idle animation
    if (!isHovering) {
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
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
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
