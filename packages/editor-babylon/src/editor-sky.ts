import type {
  BabylonRuntimeGlobal,
  RuntimeScene,
} from './types';

export interface BabylonEditorSkyColor {
  r: number;
  g: number;
  b: number;
}

export interface BabylonEditorSkyOptions {
  enabled?: boolean;
  radius?: number;
  topColor?: BabylonEditorSkyColor;
  horizonColor?: BabylonEditorSkyColor;
  bottomColor?: BabylonEditorSkyColor;
  cloudColor?: BabylonEditorSkyColor;
  cloudStrength?: number;
  sunColor?: BabylonEditorSkyColor;
  sunDirection?: { x: number; y: number; z: number };
}

export interface BabylonEditorSkyBackdrop {
  mesh: any;
  material: any;
  dispose(): void;
}

export interface BabylonEditorSkyBackdropOptions {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
  sky?: BabylonEditorSkyOptions | false;
}

const DEFAULT_EDITOR_SKY: Required<BabylonEditorSkyOptions> = {
  enabled: true,
  radius: 1200,
  topColor: { r: 0.28, g: 0.58, b: 0.86 },
  horizonColor: { r: 0.72, g: 0.83, b: 0.88 },
  bottomColor: { r: 0.56, g: 0.62, b: 0.64 },
  cloudColor: { r: 1, g: 0.96, b: 0.86 },
  cloudStrength: 0.42,
  sunColor: { r: 1, g: 0.86, b: 0.58 },
  sunDirection: { x: -0.36, y: 0.42, z: -0.82 },
};

const POSITION_KIND = 'position';
const COLOR_KIND = 'color';
const SKY_SHADER_NAME = 'editorSkyBackdrop';
const SKY_VERTEX_SHADER = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
varying vec3 vDirection;
void main(void) {
  vDirection = normalize(position);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;
const SKY_FRAGMENT_SHADER = `
precision highp float;
varying vec3 vDirection;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 bottomColor;
uniform vec3 cloudColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
uniform float cloudStrength;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float cloudNoise(vec2 p) {
  float n = valueNoise(p * 1.0) * 0.56;
  n += valueNoise(p * 2.2 + vec2(3.1, 1.7)) * 0.28;
  n += valueNoise(p * 4.1 + vec2(8.3, 4.4)) * 0.16;
  return n;
}

void main(void) {
  vec3 dir = normalize(vDirection);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 lowerSky = mix(bottomColor, horizonColor, smoothstep(0.0, 0.52, h));
  vec3 upperSky = mix(horizonColor, topColor, smoothstep(0.38, 1.0, h));
  vec3 sky = mix(lowerSky, upperSky, smoothstep(0.32, 0.76, h));

  float horizonMist = 1.0 - smoothstep(0.015, 0.26, abs(dir.y));
  sky += horizonMist * vec3(0.08, 0.09, 0.08);

  float sunDot = max(dot(dir, normalize(sunDirection)), 0.0);
  float sunGlow = pow(sunDot, 48.0) * 0.32 + pow(sunDot, 420.0) * 0.78;
  sky = mix(sky, sunColor, clamp(sunGlow, 0.0, 0.72));

  float cloudBand = smoothstep(0.05, 0.24, dir.y) * (1.0 - smoothstep(0.58, 0.82, dir.y));
  vec2 cloudUv = dir.xz / max(dir.y + 0.48, 0.18);
  float stretchedNoise = cloudNoise(vec2(cloudUv.x * 1.25, cloudUv.y * 0.34));
  float streaks = smoothstep(0.56, 0.82, stretchedNoise) * cloudBand * cloudStrength;
  sky = mix(sky, cloudColor, clamp(streaks, 0.0, 0.48));

  gl_FragColor = vec4(clamp(sky, 0.0, 1.0), 1.0);
}
`;

export function createBabylonEditorSkyBackdrop(
  options: BabylonEditorSkyBackdropOptions,
): BabylonEditorSkyBackdrop | null {
  const sky = resolveEditorSkyOptions(options.sky);
  if (!sky.enabled) return null;

  const MeshBuilder = options.babylon.MeshBuilder;
  const Color3 = options.babylon.Color3;
  if (!MeshBuilder?.CreateSphere || !Color3) return null;

  const mesh = MeshBuilder.CreateSphere(
    'editor.world.sky',
    {
      diameter: sky.radius * 2,
      segments: 32,
      sideOrientation: (options.babylon as any).Mesh?.BACKSIDE ?? 1,
    },
    options.scene,
  );
  mesh.isPickable = false;
  mesh.infiniteDistance = true;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.doNotSyncBoundingInfo = true;

  const skyMaterial = createSkyMaterial(options.babylon, options.scene, sky, canUseSkyShader(options.babylon));
  if (!skyMaterial) {
    mesh.dispose?.();
    return null;
  }
  const { material, shader } = skyMaterial;
  mesh.material = material;

  if (!shader) {
    applySkyVertexColors(mesh, sky);
  }

  return {
    mesh,
    material,
    dispose() {
      mesh.dispose?.();
      material.dispose?.();
    },
  };
}

function createSkyMaterial(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  sky: Required<BabylonEditorSkyOptions>,
  preferShader: boolean,
): { material: any; shader: boolean } | null {
  if (preferShader) {
    try {
      const shaderMaterial = createSkyShaderMaterial(babylon, scene, sky);
      if (shaderMaterial) return { material: shaderMaterial, shader: true };
    } catch {
      // Fallback below keeps editor preview usable on older Babylon runtimes.
    }
  }
  const fallbackMaterial = createSkyVertexColorMaterial(babylon, scene);
  return fallbackMaterial ? { material: fallbackMaterial, shader: false } : null;
}

function createSkyShaderMaterial(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  sky: Required<BabylonEditorSkyOptions>,
): any | null {
  if (!canUseSkyShader(babylon)) return null;
  const ShaderMaterial = babylon.ShaderMaterial!;
  const Color3 = babylon.Color3!;
  const Vector3 = babylon.Vector3;
  const store = babylon.Effect!.ShadersStore!;
  store[`${SKY_SHADER_NAME}VertexShader`] = SKY_VERTEX_SHADER;
  store[`${SKY_SHADER_NAME}FragmentShader`] = SKY_FRAGMENT_SHADER;

  const material = new ShaderMaterial(
    'editor.world.sky.shaderMaterial',
    scene,
    { vertex: SKY_SHADER_NAME, fragment: SKY_SHADER_NAME },
    {
      attributes: ['position'],
      uniforms: [
        'worldViewProjection',
        'topColor',
        'horizonColor',
        'bottomColor',
        'cloudColor',
        'sunColor',
        'sunDirection',
        'cloudStrength',
      ],
    },
  );
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  material.setColor3?.('topColor', toColor3(Color3, sky.topColor));
  material.setColor3?.('horizonColor', toColor3(Color3, sky.horizonColor));
  material.setColor3?.('bottomColor', toColor3(Color3, sky.bottomColor));
  material.setColor3?.('cloudColor', toColor3(Color3, sky.cloudColor));
  material.setColor3?.('sunColor', toColor3(Color3, sky.sunColor));
  if (Vector3 && material.setVector3) {
    material.setVector3('sunDirection', new Vector3(
      sky.sunDirection.x,
      sky.sunDirection.y,
      sky.sunDirection.z,
    ));
  }
  material.setFloat?.('cloudStrength', sky.cloudStrength);
  return material;
}

function canUseSkyShader(babylon: BabylonRuntimeGlobal): boolean {
  return (
    !!babylon.ShaderMaterial
    && !!babylon.Color3
    && !!babylon.Effect?.ShadersStore
  );
}

function createSkyVertexColorMaterial(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
): any | null {
  const StandardMaterial = babylon.StandardMaterial;
  const Color3 = babylon.Color3;
  if (!StandardMaterial || !Color3) return null;
  const material = new StandardMaterial('editor.world.sky.material', scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useVertexColors = true;
  material.diffuseColor = new Color3(1, 1, 1);
  material.emissiveColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0, 0, 0);
  material.freeze?.();
  return material;
}

function resolveEditorSkyOptions(
  sky: BabylonEditorSkyOptions | false | undefined,
): Required<BabylonEditorSkyOptions> {
  if (sky === false) return { ...DEFAULT_EDITOR_SKY, enabled: false };
  return {
    enabled: sky?.enabled ?? DEFAULT_EDITOR_SKY.enabled,
    radius: sky?.radius ?? DEFAULT_EDITOR_SKY.radius,
    topColor: sky?.topColor ?? DEFAULT_EDITOR_SKY.topColor,
    horizonColor: sky?.horizonColor ?? DEFAULT_EDITOR_SKY.horizonColor,
    bottomColor: sky?.bottomColor ?? DEFAULT_EDITOR_SKY.bottomColor,
    cloudColor: sky?.cloudColor ?? DEFAULT_EDITOR_SKY.cloudColor,
    cloudStrength: sky?.cloudStrength ?? DEFAULT_EDITOR_SKY.cloudStrength,
    sunColor: sky?.sunColor ?? DEFAULT_EDITOR_SKY.sunColor,
    sunDirection: sky?.sunDirection ?? DEFAULT_EDITOR_SKY.sunDirection,
  };
}

function applySkyVertexColors(mesh: any, sky: Required<BabylonEditorSkyOptions>): void {
  const positions = mesh.getVerticesData?.(POSITION_KIND) as number[] | Float32Array | null | undefined;
  if (!positions || !mesh.setVerticesData) return;

  const colors: number[] = [];
  for (let index = 0; index < positions.length; index += 3) {
    const normalizedY = clamp01((positions[index + 1] / sky.radius + 1) / 2);
    const color = normalizedY < 0.5
      ? mixColor(sky.bottomColor, sky.horizonColor, normalizedY / 0.5)
      : mixColor(sky.horizonColor, sky.topColor, (normalizedY - 0.5) / 0.5);
    colors.push(color.r, color.g, color.b, 1);
  }

  mesh.setVerticesData(COLOR_KIND, colors, false);
}

function mixColor(
  from: BabylonEditorSkyColor,
  to: BabylonEditorSkyColor,
  amount: number,
): BabylonEditorSkyColor {
  const t = clamp01(amount);
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toColor3(
  Color3: new (r: number, g: number, b: number) => any,
  color: BabylonEditorSkyColor,
): any {
  return new Color3(color.r, color.g, color.b);
}
