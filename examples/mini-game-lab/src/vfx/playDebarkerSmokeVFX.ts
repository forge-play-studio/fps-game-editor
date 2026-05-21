import {
  Scene,
  Vector3,
  ParticleSystem,
  DynamicTexture,
  Color4,
  MeshBuilder,
} from '@babylonjs/core';

let cachedSmokeTex: DynamicTexture | null = null;

function getSmokeTexture(scene: Scene): DynamicTexture {
  if (cachedSmokeTex) return cachedSmokeTex;

  const size = 128;
  cachedSmokeTex = new DynamicTexture('debarkerSmokeTex', size, scene, false);
  cachedSmokeTex.hasAlpha = true;

  const ctx = cachedSmokeTex.getContext();
  // Draw a soft radial gradient for a puffy smoke look
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2;

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  cachedSmokeTex.update();

  cachedSmokeTex.onDisposeObservable.addOnce(() => { cachedSmokeTex = null; });
  return cachedSmokeTex;
}

export function disposeDebarkerSmokeVFXCache(): void {
  cachedSmokeTex?.dispose();
  cachedSmokeTex = null;
}

export function playDebarkerSmokeVFX(
  scene: Scene,
  position: Vector3,
  durationMs: number = 200
): { dispose: () => void } {
  const tex = getSmokeTexture(scene);

  const emitter = MeshBuilder.CreateBox("smoke_emitter", { size: 0.01 }, scene);
  emitter.position.copyFrom(position);
  emitter.isVisible = false;

  const ps = new ParticleSystem("debarkerSmoke", 30, scene);
  ps.particleTexture = tex;
  ps.emitter = emitter;

  // Dark, solid cartoon smoke properties
  ps.color1 = new Color4(0.15, 0.15, 0.15, 0.9); // Dark grey/black
  ps.color2 = new Color4(0.05, 0.05, 0.05, 0.7);
  ps.colorDead = new Color4(0.0, 0.0, 0.0, 0.0);

  // Size: smaller chunks
  ps.minSize = 0.15;
  ps.maxSize = 0.35;

  // Lifetime: quick pop
  ps.minLifeTime = 0.4;
  ps.maxLifeTime = 0.7;

  // Emit rate: dense but short burst
  ps.emitRate = 45;

  // Velocity (popping outwards and slightly upwards)
  ps.direction1 = new Vector3(-2, 0.5, -2);
  ps.direction2 = new Vector3(2, 3.5, 2);

  ps.minEmitPower = 0.8;
  ps.maxEmitPower = 2.0;

  // Gravity/Drift (drift up)
  ps.gravity = new Vector3(0, 2.0, 0);

  ps.start();

  const timer = window.setTimeout(() => {
    ps.stop();
    // Allow lingering particles to finish fading
    window.setTimeout(() => {
      ps.dispose(false); // false = preserve shared texture
      emitter.dispose();
    }, 1500);
  }, durationMs);

  return {
    dispose() {
      window.clearTimeout(timer);
      ps.stop();
      ps.dispose(false);
      emitter.dispose();
    }
  };
}
