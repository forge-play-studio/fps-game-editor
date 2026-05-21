import {
  Scene,
  Vector3,
  ParticleSystem,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Animation,
  DynamicTexture
} from '@babylonjs/core';

let cachedGlowTex: DynamicTexture | null = null;
let cachedLightBeamTex: DynamicTexture | null = null;

function getGlowTexture(scene: Scene): DynamicTexture {
  if (cachedGlowTex) return cachedGlowTex;

  const size = 128;
  cachedGlowTex = new DynamicTexture('doorGlowTex', size, scene, false);
  cachedGlowTex.hasAlpha = true;

  const ctx = cachedGlowTex.getContext();

  const gradient = ctx.createLinearGradient(0, size, 0, 0); // from bottom to top
  gradient.addColorStop(0, 'rgba(255, 230, 150, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 180, 50, 0.8)');
  gradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  cachedGlowTex.update();

  cachedGlowTex.onDisposeObservable.addOnce(() => { cachedGlowTex = null; });
  return cachedGlowTex;
}

function getLightBeamTexture(scene: Scene): DynamicTexture {
  if (cachedLightBeamTex) return cachedLightBeamTex;

  const size = 64;
  cachedLightBeamTex = new DynamicTexture('doorLightBeamTex', size, scene, false);
  cachedLightBeamTex.hasAlpha = true;

  const ctx = cachedLightBeamTex.getContext();
  // Draw a vertical streak
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 220, 100, 1)');
  gradient.addColorStop(0.8, 'rgba(255, 200, 50, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(size/2 - 4, 0, 8, size);

  // Add an inner glowing core
  const coreGrad = ctx.createLinearGradient(0, size * 0.1, 0, size * 0.9);
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  coreGrad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
  coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = coreGrad;
  ctx.fillRect(size/2 - 1, size * 0.1, 2, size * 0.8);

  cachedLightBeamTex.update();
  cachedLightBeamTex.onDisposeObservable.addOnce(() => { cachedLightBeamTex = null; });
  return cachedLightBeamTex;
}

export function disposeDoorUnlockVFXCache(): void {
  cachedGlowTex?.dispose();
  cachedGlowTex = null;
  cachedLightBeamTex?.dispose();
  cachedLightBeamTex = null;
}

export function playDoorUnlockVFX(
  scene: Scene,
  position: Vector3
): { dispose: () => void } {
  // 1. Create a glowing vertical plane (Light Wall)
  const wallWidth = 4.2; // span across both doors (-1.27 to 0.92 plus width)
  const wallHeight = 2.0;

  const lightWall = MeshBuilder.CreatePlane("doorLightWall", { width: wallWidth, height: wallHeight }, scene);
  lightWall.position.copyFrom(position);
  lightWall.position.y += wallHeight / 2; // Move up so base is at floor
  lightWall.position.z += 0.05; // Slightly behind the door frame

  const wallMat = new StandardMaterial("doorLightWallMat", scene);
  const glowTex = getGlowTexture(scene);
  wallMat.diffuseTexture = glowTex;
  wallMat.emissiveTexture = glowTex;
  wallMat.opacityTexture = glowTex;
  wallMat.disableLighting = true;
  wallMat.useAlphaFromDiffuseTexture = true;
  // Blend mode Additive for glowing effect
  wallMat.alphaMode = 1; // Engine.ALPHA_ADD
  wallMat.backFaceCulling = false;
  wallMat.disableDepthWrite = true; // Don't occlude particles
  lightWall.material = wallMat;

  // Animate light wall fade in and out
  const alphaAnim = new Animation(
    "wallAlphaAnim",
    "visibility",
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  const alphaKeys = [
    { frame: 0, value: 0 },
    { frame: 10, value: 0.8 },
    { frame: 30, value: 0.8 },
    { frame: 45, value: 0 }
  ];
  alphaAnim.setKeys(alphaKeys);
  lightWall.animations.push(alphaAnim);
  scene.beginAnimation(lightWall, 0, 45, false);

  // 2. Create rising light beam particles
  const beamTex = getLightBeamTexture(scene);
  const emitter = MeshBuilder.CreateBox("beam_emitter", { width: wallWidth, height: 0.01, depth: 0.2 }, scene);
  emitter.position.copyFrom(position);
  emitter.isVisible = false;

  const ps = new ParticleSystem("doorBeams", 40, scene);
  ps.particleTexture = beamTex;
  ps.emitter = emitter;

  ps.color1 = new Color4(1.0, 0.8, 0.2, 1.0); // Bright gold
  ps.color2 = new Color4(1.0, 0.5, 0.0, 0.8); // Orange gold
  ps.colorDead = new Color4(1.0, 0.2, 0.0, 0.0);

  // Tall vertical streaks
  ps.minSize = 0.3;
  ps.maxSize = 0.6;
  ps.minScaleY = 3.0;
  ps.maxScaleY = 6.0;

  ps.minLifeTime = 0.4;
  ps.maxLifeTime = 0.7;

  ps.emitRate = 80;

  // Emit upwards (faster since lifetime is halved)
  ps.direction1 = new Vector3(0, 1.0, 0);
  ps.direction2 = new Vector3(0, 1.0, 0);
  ps.minEmitPower = 3.0;
  ps.maxEmitPower = 4.5;

  // 加快粒子整体播放速率
  ps.updateSpeed = 0.02;

  // No gravity, straight float up
  ps.gravity = new Vector3(0, 0, 0);

  ps.blendMode = ParticleSystem.BLENDMODE_ADD;

  ps.start();

  // Stop emitting after 1.5 seconds
  const emitTimer = window.setTimeout(() => {
    ps.stop();
  }, 1500);

  // Cleanup after effect completes
  const cleanupTimer = window.setTimeout(() => {
    ps.dispose(false);
    emitter.dispose();
    lightWall.dispose();
    wallMat.dispose();
  }, 2500);

  return {
    dispose() {
      window.clearTimeout(emitTimer);
      window.clearTimeout(cleanupTimer);
      ps.stop();
      ps.dispose(false);
      emitter.dispose();
      lightWall.dispose();
      wallMat.dispose();
    }
  };
}