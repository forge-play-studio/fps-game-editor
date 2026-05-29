import { Effect } from '@babylonjs/core/Materials/effect';

export const PLANAR_SHADOW_SHADER_NAME = 'fpsPlanarShadow';

export function registerPlanarShadowShaders(): void {
  const vertexKey = `${PLANAR_SHADOW_SHADER_NAME}VertexShader`;
  if (Effect.ShadersStore[vertexKey]) return;

  Effect.ShadersStore[vertexKey] = `
precision highp float;

attribute vec3 position;

#ifdef BONE
attribute vec4 matricesIndices;
attribute vec4 matricesWeights;
#ifdef BONETEXTURE
uniform sampler2D boneSampler;
uniform float boneTextureWidth;
#else
uniform mat4 mBones[BonesPerMesh];
#endif
#ifdef BONES_VELOCITY_ENABLED
attribute vec4 matricesIndicesExtra;
attribute vec4 matricesWeightsExtra;
#endif
#endif

uniform mat4 world;
uniform mat4 viewProjection;
uniform vec3 u_lightDir;
uniform vec3 u_planeNormal;
uniform vec3 u_shadowCenter;
uniform float u_planeHeight;
uniform float u_planeBias;
uniform float u_footprintScale;

varying float v_t;

#ifdef BONE
#ifdef BONETEXTURE
mat4 readMatrixFromRawSampler(sampler2D smp, float index) {
  float offset = index * 4.0;
  float dx = 1.0 / boneTextureWidth;
  vec4 m0 = texture2D(smp, vec2(dx * (offset + 0.5), 0.));
  vec4 m1 = texture2D(smp, vec2(dx * (offset + 1.5), 0.));
  vec4 m2 = texture2D(smp, vec2(dx * (offset + 2.5), 0.));
  vec4 m3 = texture2D(smp, vec2(dx * (offset + 3.5), 0.));
  return mat4(m0, m1, m2, m3);
}
#endif
#endif

void main() {
  #ifdef FLAT_SHADOW
  vec3 projPos = (world * vec4(position, 1.0)).xyz;
  v_t = 1.0;

  vec4 clipPos = viewProjection * vec4(projPos, 1.0);
  clipPos.z -= u_planeBias * 2e-4 * clipPos.w;

  gl_Position = clipPos;
  return;
  #endif

  #ifdef BONE
  #ifdef BONETEXTURE
  mat4 m0 = readMatrixFromRawSampler(boneSampler, matricesIndices.x);
  mat4 m1 = readMatrixFromRawSampler(boneSampler, matricesIndices.y);
  mat4 m2 = readMatrixFromRawSampler(boneSampler, matricesIndices.z);
  mat4 m3 = readMatrixFromRawSampler(boneSampler, matricesIndices.w);
  #else
  mat4 m0 = mBones[int(matricesIndices.x)];
  mat4 m1 = mBones[int(matricesIndices.y)];
  mat4 m2 = mBones[int(matricesIndices.z)];
  mat4 m3 = mBones[int(matricesIndices.w)];
  #endif

  mat4 influence = m0 * matricesWeights.x +
                  m1 * matricesWeights.y +
                  m2 * matricesWeights.z +
                  m3 * matricesWeights.w;

  #ifdef BONES_VELOCITY_ENABLED
  #ifdef BONETEXTURE
  mat4 m4 = readMatrixFromRawSampler(boneSampler, matricesIndicesExtra.x);
  mat4 m5 = readMatrixFromRawSampler(boneSampler, matricesIndicesExtra.y);
  mat4 m6 = readMatrixFromRawSampler(boneSampler, matricesIndicesExtra.z);
  mat4 m7 = readMatrixFromRawSampler(boneSampler, matricesIndicesExtra.w);
  #else
  mat4 m4 = mBones[int(matricesIndicesExtra.x)];
  mat4 m5 = mBones[int(matricesIndicesExtra.y)];
  mat4 m6 = mBones[int(matricesIndicesExtra.z)];
  mat4 m7 = mBones[int(matricesIndicesExtra.w)];
  #endif

  influence += m4 * matricesWeightsExtra.x +
              m5 * matricesWeightsExtra.y +
              m6 * matricesWeightsExtra.z +
              m7 * matricesWeightsExtra.w;
  #endif

  mat4 finalWorld = world * influence;
  vec3 worldPos = (finalWorld * vec4(position, 1.0)).xyz;
  #else
  vec3 worldPos = (world * vec4(position, 1.0)).xyz;
  #endif

  float denom = dot(u_planeNormal, u_lightDir);
  if (abs(denom) < 1e-5) {
    v_t = -1.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  float t = (u_planeHeight - dot(u_planeNormal, worldPos)) / denom;
  v_t = t;

  vec3 projPos = worldPos + u_lightDir * t;
  projPos = u_shadowCenter + (projPos - u_shadowCenter) * u_footprintScale;
  projPos += u_planeNormal * (u_planeBias * 0.002);

  vec4 clipPos = viewProjection * vec4(projPos, 1.0);
  clipPos.z -= u_planeBias * 2e-4 * clipPos.w;

  gl_Position = clipPos;
}
`;

  Effect.ShadersStore[`${PLANAR_SHADOW_SHADER_NAME}FragmentShader`] = `
precision highp float;

uniform vec4 u_shadowColor;
varying float v_t;

void main() {
  if (v_t < 0.0) discard;
  gl_FragColor = u_shadowColor;
}
`;
}

export function getPlanarShadowShaderAttributes(): string[] {
  return [
    'position',
    'matricesIndices',
    'matricesWeights',
    'matricesIndicesExtra',
    'matricesWeightsExtra',
  ];
}

export function getPlanarShadowShaderUniforms(): string[] {
  return [
    'world',
    'viewProjection',
    'u_lightDir',
    'u_planeNormal',
    'u_shadowCenter',
    'u_planeHeight',
    'u_planeBias',
    'u_footprintScale',
    'u_shadowColor',
    'mBones',
    'boneTextureWidth',
  ];
}

export function getPlanarShadowShaderSamplers(): string[] {
  return ['boneSampler'];
}

export function getPlanarShadowSkeletonDefines(
  numBones: number,
  useTexture: boolean,
  hasExtraInfluence: boolean,
): string[] {
  const defines = ['BONE'];
  if (useTexture) defines.push('BONETEXTURE');
  else defines.push(`BonesPerMesh ${numBones}`);
  if (hasExtraInfluence) defines.push('BONES_VELOCITY_ENABLED');
  return defines;
}
