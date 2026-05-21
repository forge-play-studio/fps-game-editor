/**
 * ShadowService - 阴影管理服务
 *
 * 职责：管理场景阴影系统，包括 CSM 阴影和阴影投射/接收配置
 * 移植自旧系统的 ShadowManager
 */

import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Observer } from '@babylonjs/core/Misc/observable';
import { Scene } from '@babylonjs/core/scene';
import { Engine } from '@babylonjs/core/Engines/engine';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { Material } from '@babylonjs/core/Materials/material';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Effect } from '@babylonjs/core/Materials/effect';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';

// 副作用导入：注册阴影场景组件
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

// 导入配置
import renderingConfig from '../config/rendering.json';
import { configService } from '../config';

// ============================================================
// 类型定义
// ============================================================

interface ColorConfig {
  r: number;
  g: number;
  b: number;
}

interface ShadowSettings {
  mapSize: number;
  darkness: number;
  blurKernel: number;
  bias: number;
  normalBias: number;
  useBlurExponentialShadowMap: boolean;
  shadowMinZ: number;
  shadowMaxZ: number;
  shadowColor: ColorConfig;
}

interface CSMSettings {
  numCascades: number;
  lambda: number;
  cascadeBlendPercentage: number;
  stabilizeCascades: boolean;
}

interface ShadowOrtho {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ShadowsConfig {
  enabled: boolean;
  useCsm: boolean;
  useBlobShadow: boolean;
  settings: ShadowSettings;
  blobSettings: {
    opacity: number;
    yOffset: number;
    sizeMultiplier: number;
    minSize: number;
  };
  shadowRange: {
    minZ: number;
    maxZ: number;
  };
  shadowOrtho: ShadowOrtho;
  csm: CSMSettings;
}

interface ShadowMeshesConfig {
  shadowReceivers: string[];
  shadowCasters: string[];
  excludeFromShadow: string[];
}

interface TreeBlobShadowsConfig {
  enabled?: boolean;
  targetPatterns?: string[];
  opacity?: number;
  yOffset?: number;
  sizeMultiplier?: number;
  minSize?: number;
}

interface TreeBlobShadowRuntime {
  target: TransformNode;
  shadow: Mesh;
}

interface PlanarProjectionShadowsConfig {
  enabled?: boolean;
  targetPatterns?: string[];
  groundHeight?: number;
  depthBias?: number;
  alpha?: number;
  footprintScale?: number;
  color?: ColorConfig;
  renderingGroupId?: number;
  alphaIndex?: number;
  groups?: PlanarProjectionShadowGroupConfig[];
}

interface PlanarProjectionShadowGroupConfig {
  id?: string;
  enabled?: boolean;
  targetPatterns?: string[];
  groundHeight?: number;
  depthBias?: number;
  alpha?: number;
  footprintScale?: number;
  color?: ColorConfig;
  renderingGroupId?: number;
  alphaIndex?: number;
}

interface PlanarProjectionShadowEntry {
  source: AbstractMesh;
  shadow: Mesh;
  material: ShaderMaterial;
}

interface PlanarProjectionShadowRuntime {
  target: TransformNode;
  groupId: string;
  entries: PlanarProjectionShadowEntry[];
}

// ============================================================
// ShadowService 类
// ============================================================

/**
 * ShadowService
 *
 * 管理场景阴影系统
 */
export class ShadowService {
  private scene: Scene;
  private camera: Camera | null;
  private light: DirectionalLight;
  private shadowGenerator: ShadowGenerator | null = null;
  private config: ShadowsConfig;
  private meshConfig: ShadowMeshesConfig;
  private shadowReceivers: string[];
  private shadowCasters: string[];
  private excluded: string[];
  private sceneTreeBlobShadowsConfig: TreeBlobShadowsConfig;
  private planarProjectionShadowsConfig: PlanarProjectionShadowsConfig;
  private newMeshObserver: Observer<AbstractMesh> | null = null;
  private beforeRenderObserver: Observer<Scene> | null = null;
  private blobShadowMaterial: StandardMaterial | null = null;
  private blobShadowTexture: DynamicTexture | null = null;
  private treeBlobShadows = new Map<string, TreeBlobShadowRuntime>();
  private planarProjectionShadows = new Map<string, PlanarProjectionShadowRuntime>();

  constructor(scene: Scene, light: DirectionalLight, camera?: Camera | null) {
    this.scene = scene;
    this.light = light;
    this.camera = camera || null;
    this.config = renderingConfig.shadows as ShadowsConfig;
    this.meshConfig = renderingConfig.shadowMeshes as ShadowMeshesConfig;
    this.shadowReceivers = this.meshConfig.shadowReceivers || [];
    this.shadowCasters = this.meshConfig.shadowCasters || [];
    this.excluded = this.meshConfig.excludeFromShadow || [];
    this.sceneTreeBlobShadowsConfig = this.readSceneTreeBlobShadowsConfig();
    this.planarProjectionShadowsConfig = this.readPlanarProjectionShadowsConfig();
    this.registerPlanarProjectionShadowShader();
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 初始化阴影系统
   */
  initialize(): void {
    const useBlobShadow = this.isTreeBlobShadowEnabled();
    const usePlanarProjectionShadow = this.isPlanarProjectionShadowEnabled();
    const useRealtimeShadow = this.config.enabled && !usePlanarProjectionShadow;
    if (!useRealtimeShadow && !useBlobShadow && !usePlanarProjectionShadow) {
      this.scene.shadowsEnabled = false;
      return;
    }

    this.scene.shadowsEnabled = useRealtimeShadow;

    if (!useRealtimeShadow) {
      this.syncShadowEffects();
      this.attachBeforeRenderObserver();
      return;
    }

    // 确保光源不被父节点影响（对阴影关键）
    this.light.parent = null;
    this.light.shadowEnabled = true;

    const settings = this.config.settings;
    const csm = this.config.csm;
    const useCsm = this.config.useCsm ?? true;
    const useBlur = settings.useBlurExponentialShadowMap;

    // 创建阴影生成器（优先 CSM，不支持时回退）
    if (useCsm && CascadedShadowGenerator.IsSupported) {
      const csmGenerator = new CascadedShadowGenerator(
        settings.mapSize,
        this.light,
        undefined,
        this.camera || undefined
      );

      csmGenerator.shadowMaxZ = settings.shadowMaxZ;

      if (csm.numCascades !== undefined) {
        csmGenerator.numCascades = csm.numCascades;
      }
      if (csm.lambda !== undefined) {
        csmGenerator.lambda = csm.lambda;
      }
      if (csm.cascadeBlendPercentage !== undefined) {
        csmGenerator.cascadeBlendPercentage = csm.cascadeBlendPercentage;
      }
      if (csm.stabilizeCascades !== undefined) {
        csmGenerator.stabilizeCascades = csm.stabilizeCascades;
      }

      csmGenerator.usePercentageCloserFiltering = true;
      csmGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

      this.shadowGenerator = csmGenerator;
    } else {
      this.shadowGenerator = new ShadowGenerator(settings.mapSize, this.light);
    }

    if (!this.shadowGenerator) {
      return;
    }

    // 应用模糊设置
    if (useBlur) {
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = settings.blurKernel;
    }

    // 应用其他设置
    this.shadowGenerator.setDarkness(settings.darkness);
    this.shadowGenerator.bias = settings.bias;
    this.shadowGenerator.normalBias = settings.normalBias;

    // 设置光源阴影范围
    this.light.shadowMinZ = settings.shadowMinZ;
    this.light.shadowMaxZ = settings.shadowMaxZ;

    // 配置方向光的正交投影边界
    this.light.orthoLeft = this.config.shadowOrtho.left;
    this.light.orthoRight = this.config.shadowOrtho.right;
    this.light.orthoTop = this.config.shadowOrtho.top;
    this.light.orthoBottom = this.config.shadowOrtho.bottom;

    // 应用阴影网格配置
    this.applyShadowMeshes();

    // 监听新网格添加
    this.attachNewMeshObserver();
    this.syncShadowEffects();
    this.attachBeforeRenderObserver();

  }

  /**
   * 刷新阴影网格配置
   *
   * 在场景模型加载后调用
   */
  refreshShadowMeshes(): void {
    if (this.shadowGenerator) {
      this.applyShadowMeshes();
    }
    this.syncShadowEffects();
  }

  /**
   * 获取阴影生成器实例
   */
  getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator;
  }

  /**
   * 手动添加阴影投射者
   */
  addShadowCaster(mesh: AbstractMesh): void {
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh, true);
    }
  }

  /**
   * 手动移除阴影投射者
   */
  removeShadowCaster(mesh: AbstractMesh): void {
    if (this.shadowGenerator) {
      this.shadowGenerator.removeShadowCaster(mesh, true);
    }
  }

  /**
   * 设置网格为阴影接收者
   */
  setShadowReceiver(mesh: AbstractMesh, receive: boolean): void {
    mesh.receiveShadows = receive;
  }

  getPlanarProjectionShadowSettings(groupId = 'default'): Required<Pick<PlanarProjectionShadowGroupConfig, 'enabled' | 'groundHeight' | 'depthBias' | 'alpha' | 'footprintScale'>> {
    const group = this.getPlanarProjectionGroupById(groupId);
    return {
      enabled: this.isPlanarProjectionGroupEnabled(group),
      groundHeight: this.getPlanarProjectionGroupNumber(group, 'groundHeight', 0),
      depthBias: this.getPlanarProjectionGroupNumber(group, 'depthBias', 0.02),
      alpha: this.getPlanarProjectionGroupNumber(group, 'alpha', 0.32),
      footprintScale: this.getPlanarProjectionGroupNumber(group, 'footprintScale', 1),
    };
  }

  updatePlanarProjectionShadowSettings(settings: Partial<Pick<PlanarProjectionShadowGroupConfig, 'enabled' | 'groundHeight' | 'depthBias' | 'alpha' | 'footprintScale'>>, groupId = 'default'): void {
    this.updatePlanarProjectionGroupConfig(groupId, settings);

    if (!this.isPlanarProjectionShadowEnabled()) {
      this.disposePlanarProjectionShadows();
      return;
    }

    this.syncPlanarProjectionShadows();
    const lightDirection = this.getPlanarProjectionLightDirection();
    for (const runtime of this.planarProjectionShadows.values()) {
      this.updatePlanarProjectionShadowRuntime(runtime, lightDirection);
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 监听新网格添加
   */
  private attachNewMeshObserver(): void {
    this.newMeshObserver = this.scene.onNewMeshAddedObservable.add((mesh) => {
      if (!this.shadowGenerator) return;
      this.applyShadowToMesh(mesh);
    });
  }

  private registerPlanarProjectionShadowShader(): void {
    if (!Effect.ShadersStore.planarProjectionShadowVertexShader) {
      Effect.ShadersStore.planarProjectionShadowVertexShader = `
precision highp float;
attribute vec3 position;
#if NUM_BONE_INFLUENCERS > 0
attribute vec4 matricesIndices;
attribute vec4 matricesWeights;
#if NUM_BONE_INFLUENCERS > 4
attribute vec4 matricesIndicesExtra;
attribute vec4 matricesWeightsExtra;
#endif
uniform mat4 mBones[BonesPerMesh];
#endif
uniform mat4 world;
uniform mat4 viewProjection;
uniform vec3 lightDirection;
uniform vec3 shadowCenter;
uniform float groundHeight;
uniform float depthBias;
uniform float footprintScale;

void main(void) {
  vec4 localPosition = vec4(position, 1.0);
#if NUM_BONE_INFLUENCERS > 0
  mat4 influence = matricesWeights.x * mBones[int(matricesIndices.x)]
    + matricesWeights.y * mBones[int(matricesIndices.y)]
    + matricesWeights.z * mBones[int(matricesIndices.z)]
    + matricesWeights.w * mBones[int(matricesIndices.w)];
#if NUM_BONE_INFLUENCERS > 4
  influence += matricesWeightsExtra.x * mBones[int(matricesIndicesExtra.x)]
    + matricesWeightsExtra.y * mBones[int(matricesIndicesExtra.y)]
    + matricesWeightsExtra.z * mBones[int(matricesIndicesExtra.z)]
    + matricesWeightsExtra.w * mBones[int(matricesIndicesExtra.w)];
#endif
  localPosition = influence * localPosition;
#endif
  vec4 worldPosition = world * localPosition;
  float denom = abs(lightDirection.y) < 0.001 ? -1.0 : lightDirection.y;
  float t = (groundHeight - worldPosition.y) / denom;
  vec3 projected = worldPosition.xyz + lightDirection * t;
  projected.xz = mix(shadowCenter.xz, projected.xz, footprintScale);
  projected.y = groundHeight + depthBias;
  gl_Position = viewProjection * vec4(projected, 1.0);
}`;
    }

    if (!Effect.ShadersStore.planarProjectionShadowFragmentShader) {
      Effect.ShadersStore.planarProjectionShadowFragmentShader = `
precision highp float;
uniform vec4 shadowColor;

void main(void) {
  gl_FragColor = shadowColor;
}`;
    }
  }

  private attachBeforeRenderObserver(): void {
    if (this.beforeRenderObserver) return;
    this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.updateShadowEffects();
    });
  }

  private syncShadowEffects(): void {
    this.syncTreeBlobShadows();
    this.syncPlanarProjectionShadows();
  }

  private updateShadowEffects(): void {
    this.updateTreeBlobShadows();
    this.updatePlanarProjectionShadows();
  }

  private updatePlanarProjectionShadows(): void {
    if (!this.isPlanarProjectionShadowEnabled()) return;
    this.syncPlanarProjectionShadows();
    const lightDirection = this.getPlanarProjectionLightDirection();
    for (const runtime of this.planarProjectionShadows.values()) {
      this.updatePlanarProjectionShadowRuntime(runtime, lightDirection);
    }
  }

  private syncPlanarProjectionShadows(): void {
    if (!this.isPlanarProjectionShadowEnabled()) {
      this.disposePlanarProjectionShadows();
      return;
    }

    const nextKeys = new Set<string>();
    const targets: TransformNode[] = [
      ...this.scene.transformNodes,
      ...this.scene.meshes.filter((mesh) => this.isRuntimeRawWoodShadowRoot(mesh)),
    ];
    for (const node of targets) {
      if (this.isPlanarProjectionShadowDisabled(node)) continue;
      const group = this.findRuntimeDropPlanarProjectionShadowGroup(node) ?? this.findPlanarProjectionShadowGroup(node);
      if (!group) continue;
      const baseKey = this.getTreeShadowKey(node);
      if (!baseKey) continue;
      const groupId = this.getPlanarProjectionGroupId(group);
      const key = `${groupId}:${baseKey}`;
      nextKeys.add(key);

      let runtime = this.planarProjectionShadows.get(key) ?? null;
      if (!runtime) {
        runtime = { target: node, groupId, entries: [] };
        this.planarProjectionShadows.set(key, runtime);
      } else {
        runtime.target = node;
        runtime.groupId = groupId;
      }
      this.reconcilePlanarProjectionShadowRuntime(runtime, key, group);
    }

    for (const [key, runtime] of this.planarProjectionShadows.entries()) {
      if (nextKeys.has(key)) continue;
      this.disposePlanarProjectionShadowRuntime(runtime);
      this.planarProjectionShadows.delete(key);
    }
  }

  private reconcilePlanarProjectionShadowRuntime(runtime: PlanarProjectionShadowRuntime, key: string, group: PlanarProjectionShadowGroupConfig): void {
    const sources = this.getPlanarProjectionSourceMeshes(runtime.target);
    const currentIds = runtime.entries.map((entry) => entry.source.uniqueId).join(',');
    const nextIds = sources.map((source) => source.uniqueId).join(',');
    if (currentIds === nextIds) return;

    this.disposePlanarProjectionShadowRuntime(runtime);
    runtime.entries = [];

    sources.forEach((source, index) => {
      const entry = this.createPlanarProjectionShadowEntry(source, key, index, group);
      if (entry) runtime.entries.push(entry);
    });
  }

  private getPlanarProjectionSourceMeshes(target: TransformNode): AbstractMesh[] {
    const sources: AbstractMesh[] = [];
    if (target instanceof AbstractMesh && this.isPlanarProjectionSourceMesh(target)) {
      sources.push(target);
    }
    sources.push(...target.getChildMeshes(false).filter((mesh) => this.isPlanarProjectionSourceMesh(mesh)));
    return sources;
  }

  private isPlanarProjectionSourceMesh(mesh: AbstractMesh): boolean {
    return !mesh.isDisposed()
      && mesh.getTotalVertices() > 0
      && !this.isPlanarProjectionShadowDisabled(mesh)
      && !(mesh.metadata as any)?.isPlanarProjectionShadow
      && !!this.getPlanarProjectionGeometrySource(mesh);
  }

  private isPlanarProjectionShadowDisabled(node: TransformNode | AbstractMesh): boolean {
    const metadata = node.metadata as any;
    return metadata?.disablePlanarProjectionShadow === true || this.isRuntimeDropPlanarProjectionBlocked(node);
  }

  private isRuntimeRawWoodShadowRoot(node: TransformNode | AbstractMesh): boolean {
    const metadata = node.metadata as any;
    return metadata?.runtimeDropShadowRoot === true
      && metadata?.runtimeDropKind === 'wood'
      && metadata?.runtimeDropProcessed !== true;
  }

  private isRuntimeDropPlanarProjectionBlocked(node: TransformNode | AbstractMesh): boolean {
    const metadata = node.metadata as any;
    return metadata?.runtimeDropKind === 'wood'
      && metadata?.runtimeDropProcessed !== true
      && metadata?.runtimeDropState !== 'ground';
  }

  private createPlanarProjectionShadowEntry(source: AbstractMesh, key: string, index: number, group: PlanarProjectionShadowGroupConfig): PlanarProjectionShadowEntry | null {
    const geometrySource = this.getPlanarProjectionGeometrySource(source);
    const geometry = (geometrySource as any)?.geometry;
    if (!geometry || typeof geometry.applyToMesh !== 'function') return null;

    const shadow = new Mesh(`planar_shadow_${key}_${index}`, this.scene);
    geometry.applyToMesh(shadow);
    shadow.metadata = {
      ...(shadow.metadata ?? {}),
      isPlanarProjectionShadow: true,
      sourceUniqueId: source.uniqueId,
    };
    shadow.isPickable = false;
    shadow.receiveShadows = false;
    shadow.alwaysSelectAsActiveMesh = true;
    shadow.renderingGroupId = this.getPlanarProjectionGroupNumber(group, 'renderingGroupId', 1);
    shadow.alphaIndex = this.getPlanarProjectionGroupNumber(group, 'alphaIndex', 950);

    const material = this.createPlanarProjectionShadowMaterial(source, `planar_shadow_mat_${key}_${index}`, group);
    shadow.material = material;
    this.syncPlanarProjectionShadowEntry({ source, shadow, material }, this.getPlanarProjectionLightDirection(), group);
    return { source, shadow, material };
  }

  private createPlanarProjectionShadowMaterial(source: AbstractMesh, name: string, group: PlanarProjectionShadowGroupConfig): ShaderMaterial {
    const boneInfluencers = this.getPlanarProjectionBoneInfluencers(source);
    const skeleton = this.getPlanarProjectionSkeleton(source);
    const attributes = ['position'];
    const uniforms = ['world', 'viewProjection', 'lightDirection', 'shadowCenter', 'groundHeight', 'depthBias', 'footprintScale', 'shadowColor'];
    const defines: string[] = [];

    if (skeleton && boneInfluencers > 0) {
      attributes.push('matricesIndices', 'matricesWeights');
      uniforms.push('mBones');
      defines.push(`#define NUM_BONE_INFLUENCERS ${boneInfluencers}`);
      defines.push(`#define BonesPerMesh ${skeleton.bones.length + 1}`);
      if (boneInfluencers > 4) {
        attributes.push('matricesIndicesExtra', 'matricesWeightsExtra');
      }
    }

    const material = new ShaderMaterial(name, this.scene, {
      vertex: 'planarProjectionShadow',
      fragment: 'planarProjectionShadow',
    }, {
      attributes,
      uniforms,
      defines,
      needAlphaBlending: true,
    });
    material.backFaceCulling = false;
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.disableDepthWrite = true;
    material.stencil.enabled = true;
    material.stencil.func = Engine.NOTEQUAL;
    material.stencil.funcRef = 1;
    material.stencil.funcMask = 0xff;
    material.stencil.opStencilFail = Engine.KEEP;
    material.stencil.opDepthFail = Engine.KEEP;
    material.stencil.opStencilDepthPass = Engine.REPLACE;
    material.stencil.mask = 0xff;
    this.applyPlanarProjectionShadowMaterialUniforms(material, this.getPlanarProjectionLightDirection(), source, group);
    return material;
  }

  private updatePlanarProjectionShadowRuntime(runtime: PlanarProjectionShadowRuntime, lightDirection: Vector3): void {
    const group = this.getPlanarProjectionGroupById(runtime.groupId);
    const targetEnabled = runtime.target.isEnabled()
      && !runtime.target.isDisposed()
      && !this.isPlanarProjectionShadowDisabled(runtime.target);
    for (const entry of runtime.entries) {
      const sourceEnabled = entry.source.isEnabled()
        && !entry.source.isDisposed()
        && !this.isPlanarProjectionShadowDisabled(entry.source);
      entry.shadow.setEnabled(targetEnabled && sourceEnabled);
      if (!entry.shadow.isEnabled()) continue;
      this.syncPlanarProjectionShadowEntry(entry, lightDirection, group);
    }
  }

  private syncPlanarProjectionShadowEntry(entry: PlanarProjectionShadowEntry, lightDirection: Vector3, group: PlanarProjectionShadowGroupConfig): void {
    const { source, shadow, material } = entry;
    if (this.isPlanarProjectionShadowDisabled(source)) {
      shadow.setEnabled(false);
      return;
    }
    shadow.parent = source.parent;
    shadow.position.copyFrom(source.position);
    shadow.scaling.copyFrom(source.scaling);
    shadow.rotation.copyFrom(source.rotation);
    shadow.rotationQuaternion = source.rotationQuaternion?.clone() ?? null;
    shadow.setEnabled(source.isEnabled() && !source.isDisposed());

    const skeleton = this.getPlanarProjectionSkeleton(source);
    if (skeleton) {
      (shadow as any).skeleton = skeleton;
      const transformMatrices = skeleton.getTransformMatrices(source as any);
      if (transformMatrices) material.setMatrices('mBones', transformMatrices);
    }
    this.applyPlanarProjectionShadowMaterialUniforms(material, lightDirection, source, group);
  }

  private applyPlanarProjectionShadowMaterialUniforms(material: ShaderMaterial, lightDirection: Vector3, source: AbstractMesh | undefined, group: PlanarProjectionShadowGroupConfig): void {
    const color = group.color ?? this.planarProjectionShadowsConfig.color ?? { r: 0, g: 0, b: 0 };
    material.setVector3('lightDirection', lightDirection);
    material.setVector3('shadowCenter', this.getPlanarProjectionShadowCenter(source, group));
    material.setFloat('groundHeight', this.getPlanarProjectionGroupNumber(group, 'groundHeight', 0));
    material.setFloat('depthBias', this.getPlanarProjectionGroupNumber(group, 'depthBias', 0.02));
    material.setFloat('footprintScale', this.getPlanarProjectionGroupNumber(group, 'footprintScale', 1));
    material.setVector4('shadowColor', new Vector4(color.r, color.g, color.b, this.getPlanarProjectionGroupNumber(group, 'alpha', 0.32)));
  }

  private getPlanarProjectionShadowCenter(source: AbstractMesh | undefined, group: PlanarProjectionShadowGroupConfig): Vector3 {
    const groundHeight = this.getPlanarProjectionGroupNumber(group, 'groundHeight', 0);
    if (!source || source.isDisposed()) {
      return new Vector3(0, groundHeight, 0);
    }
    const center = source.getBoundingInfo().boundingBox.centerWorld.clone();
    center.y = groundHeight;
    return center;
  }

  private getPlanarProjectionGeometrySource(source: AbstractMesh): Mesh | null {
    const sourceAny = source as any;
    if (sourceAny?.geometry) return sourceAny as Mesh;
    if (sourceAny?.sourceMesh?.geometry) return sourceAny.sourceMesh as Mesh;
    return null;
  }

  private getPlanarProjectionSkeleton(source: AbstractMesh): any | null {
    const sourceAny = source as any;
    return sourceAny?.skeleton ?? sourceAny?.sourceMesh?.skeleton ?? null;
  }

  private getPlanarProjectionBoneInfluencers(source: AbstractMesh): number {
    const sourceAny = source as any;
    const value = sourceAny?.numBoneInfluencers ?? sourceAny?.sourceMesh?.numBoneInfluencers ?? 0;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private getPlanarProjectionLightDirection(): Vector3 {
    const direction = this.light.direction?.clone?.() ?? new Vector3(-0.3, -1, -0.2);
    if (Math.abs(direction.y) < 0.001) direction.y = -1;
    return direction.normalize();
  }

  private findPlanarProjectionShadowGroup(node: TransformNode): PlanarProjectionShadowGroupConfig | null {
    for (const group of this.getPlanarProjectionGroups()) {
      if (!this.isPlanarProjectionGroupEnabled(group)) continue;
      const targetPatterns = (group.targetPatterns ?? [])
        .filter((pattern): pattern is string => typeof pattern === 'string' && pattern.trim().length > 0);
      if (targetPatterns.length === 0) continue;
      if (this.isNodeMatchedByPatterns(node, targetPatterns)) return group;
    }
    return null;
  }

  private findRuntimeDropPlanarProjectionShadowGroup(node: TransformNode): PlanarProjectionShadowGroupConfig | null {
    if (!this.isRuntimeRawWoodShadowRoot(node)) return null;
    if (this.isRuntimeDropPlanarProjectionBlocked(node)) return null;
    const groups = this.getPlanarProjectionGroups().filter((group) => this.isPlanarProjectionGroupEnabled(group));
    return groups.find((group) => this.getPlanarProjectionGroupId(group) === 'forest') ?? groups[0] ?? null;
  }

  private readPlanarProjectionShadowsConfig(): PlanarProjectionShadowsConfig {
    const rawConfig = configService.getRenderConfig().planarProjectionShadows;
    if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return {};
    return rawConfig as PlanarProjectionShadowsConfig;
  }

  private isPlanarProjectionShadowEnabled(): boolean {
    if (!(this.planarProjectionShadowsConfig.enabled ?? false)) return false;
    return this.getPlanarProjectionGroups().some((group) => this.isPlanarProjectionGroupEnabled(group));
  }

  private getPlanarProjectionNumber(key: keyof Pick<PlanarProjectionShadowsConfig, 'groundHeight' | 'depthBias' | 'alpha' | 'footprintScale' | 'renderingGroupId' | 'alphaIndex'>, fallback: number): number {
    const value = this.planarProjectionShadowsConfig[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private getPlanarProjectionGroups(): PlanarProjectionShadowGroupConfig[] {
    const groups = this.planarProjectionShadowsConfig.groups;
    if (Array.isArray(groups) && groups.length > 0) return groups;
    return [{
      id: 'default',
      targetPatterns: this.planarProjectionShadowsConfig.targetPatterns ?? [],
      enabled: this.planarProjectionShadowsConfig.enabled,
      groundHeight: this.planarProjectionShadowsConfig.groundHeight,
      depthBias: this.planarProjectionShadowsConfig.depthBias,
      alpha: this.planarProjectionShadowsConfig.alpha,
      footprintScale: this.planarProjectionShadowsConfig.footprintScale,
      color: this.planarProjectionShadowsConfig.color,
      renderingGroupId: this.planarProjectionShadowsConfig.renderingGroupId,
      alphaIndex: this.planarProjectionShadowsConfig.alphaIndex,
    }];
  }

  private getPlanarProjectionGroupById(groupId: string): PlanarProjectionShadowGroupConfig {
    return this.getPlanarProjectionGroups().find((group) => this.getPlanarProjectionGroupId(group) === groupId)
      ?? this.getPlanarProjectionGroups()[0]
      ?? { id: groupId };
  }

  private updatePlanarProjectionGroupConfig(groupId: string, settings: Partial<Pick<PlanarProjectionShadowGroupConfig, 'enabled' | 'groundHeight' | 'depthBias' | 'alpha' | 'footprintScale'>>): void {
    const groups = this.planarProjectionShadowsConfig.groups;
    if (Array.isArray(groups) && groups.length > 0) {
      const group = groups.find((entry) => this.getPlanarProjectionGroupId(entry) === groupId);
      if (group) Object.assign(group, settings);
      return;
    }
    Object.assign(this.planarProjectionShadowsConfig, settings);
  }

  private getPlanarProjectionGroupId(group: PlanarProjectionShadowGroupConfig): string {
    return typeof group.id === 'string' && group.id.trim() ? group.id.trim() : 'default';
  }

  private isPlanarProjectionGroupEnabled(group: PlanarProjectionShadowGroupConfig): boolean {
    return group.enabled ?? true;
  }

  private getPlanarProjectionGroupNumber(group: PlanarProjectionShadowGroupConfig, key: keyof Pick<PlanarProjectionShadowGroupConfig, 'groundHeight' | 'depthBias' | 'alpha' | 'footprintScale' | 'renderingGroupId' | 'alphaIndex'>, fallback: number): number {
    const groupValue = group[key];
    if (typeof groupValue === 'number' && Number.isFinite(groupValue)) return groupValue;
    return this.getPlanarProjectionNumber(key, fallback);
  }

  private disposePlanarProjectionShadowRuntime(runtime: PlanarProjectionShadowRuntime): void {
    for (const entry of runtime.entries) {
      entry.shadow.dispose();
      entry.material.dispose();
    }
    runtime.entries = [];
  }

  private disposePlanarProjectionShadows(): void {
    for (const runtime of this.planarProjectionShadows.values()) {
      this.disposePlanarProjectionShadowRuntime(runtime);
    }
    this.planarProjectionShadows.clear();
  }

  private updateTreeBlobShadows(): void {
    if (!this.isTreeBlobShadowEnabled()) return;
    this.syncTreeBlobShadows();
    for (const runtime of this.treeBlobShadows.values()) {
      this.updateTreeBlobShadowRuntime(runtime);
    }
  }

  private syncTreeBlobShadows(): void {
    if (!this.isTreeBlobShadowEnabled()) {
      this.disposeTreeBlobShadows();
      return;
    }

    const nextKeys = new Set<string>();
    for (const node of this.scene.transformNodes) {
      if (!this.isTreeShadowTarget(node)) continue;
      const key = this.getTreeShadowKey(node);
      if (!key) continue;
      nextKeys.add(key);

      let runtime = this.treeBlobShadows.get(key) ?? null;
      if (!runtime) {
        runtime = {
          target: node,
          shadow: this.createTreeBlobShadowMesh(key),
        };
        this.treeBlobShadows.set(key, runtime);
      } else {
        runtime.target = node;
      }
      this.updateTreeBlobShadowRuntime(runtime);
    }

    for (const [key, runtime] of this.treeBlobShadows.entries()) {
      if (nextKeys.has(key)) continue;
      runtime.shadow.dispose();
      this.treeBlobShadows.delete(key);
    }
  }

  private isTreeShadowTarget(node: TransformNode): boolean {
    if (!node) return false;
    const targetPatterns = (this.sceneTreeBlobShadowsConfig.targetPatterns ?? [])
      .filter((pattern): pattern is string => typeof pattern === 'string' && pattern.trim().length > 0);

    if (targetPatterns.length > 0) {
      return this.isNodeMatchedByPatterns(node, targetPatterns);
    }

    const candidates = this.getNodeMatchCandidates(node);
    return candidates.some((value) => (
      /^forest_lv[12]_\d+$/.test(value)
      || /^grass_tree_\d+$/.test(value)
    ));
  }

  private isTreeBlobShadowPatternMatched(value: string, pattern: string): boolean {
    const trimmed = pattern.trim();
    if (!trimmed) return false;
    try {
      return new RegExp(trimmed).test(value);
    } catch {
      return value.includes(trimmed);
    }
  }

  private isNodeMatchedByPatterns(node: TransformNode, patterns: string[]): boolean {
    const candidates = this.getNodeMatchCandidates(node);
    return candidates.some((value) => patterns.some((pattern) => this.isTreeBlobShadowPatternMatched(value, pattern)));
  }

  private getNodeMatchCandidates(node: TransformNode): string[] {
    return [
      node.id,
      node.name,
      typeof node.metadata?.sceneNodeId === 'string' ? node.metadata.sceneNodeId : '',
      typeof node.metadata?.nodeId === 'string' ? node.metadata.nodeId : '',
    ]
      .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
      .filter(Boolean);
  }

  private getTreeShadowKey(node: TransformNode): string {
    if ((node.metadata as any)?.runtimeDropShadowRoot === true) {
      return `runtime_drop_${node.uniqueId}`;
    }
    const sceneNodeId = typeof node.metadata?.sceneNodeId === 'string' ? node.metadata.sceneNodeId.trim() : '';
    const nodeId = typeof node.metadata?.nodeId === 'string' ? node.metadata.nodeId.trim() : '';
    return sceneNodeId || nodeId || node.id || node.name;
  }

  private createTreeBlobShadowMesh(key: string): Mesh {
    const shadow = MeshBuilder.CreateGround(`tree_blob_shadow_${key}`, {
      width: 1,
      height: 1,
    }, this.scene);
    shadow.material = this.getBlobShadowMaterial();
    shadow.isPickable = false;
    shadow.receiveShadows = false;
    shadow.renderingGroupId = 1;
    shadow.alphaIndex = 1000;
    return shadow;
  }

  private getBlobShadowMaterial(): StandardMaterial {
    if (this.blobShadowMaterial) return this.blobShadowMaterial;

    const texture = this.createBlobShadowTexture();
    const material = new StandardMaterial('tree_blob_shadow_mat', this.scene);
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = true;
    material.disableDepthWrite = true;
    material.backFaceCulling = false;
    material.specularColor = Color3.Black();
    material.emissiveColor = new Color3(0, 0, 0);

    this.blobShadowTexture = texture;
    this.blobShadowMaterial = material;
    return material;
  }

  private createBlobShadowTexture(): DynamicTexture {
    const texture = new DynamicTexture('tree_blob_shadow_tex', { width: 256, height: 256 }, this.scene, false);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 256, 256);
    const gradient = ctx.createRadialGradient(128, 128, 18, 128, 128, 118);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    texture.update();
    return texture;
  }

  private updateTreeBlobShadowRuntime(runtime: TreeBlobShadowRuntime): void {
    const bounds = this.getTreeShadowBounds(runtime.target);
    if (!bounds || runtime.target.isDisposed()) {
      runtime.shadow.setEnabled(false);
      return;
    }

    const targetEnabled = runtime.target.isEnabled();
    runtime.shadow.setEnabled(targetEnabled);
    if (!targetEnabled) return;

    const sizeMultiplier = this.getTreeBlobShadowNumber('sizeMultiplier', this.config.blobSettings?.sizeMultiplier ?? 1);
    const minSize = this.getTreeBlobShadowNumber('minSize', this.config.blobSettings?.minSize ?? 0.25);
    const yOffset = this.getTreeBlobShadowNumber('yOffset', this.config.blobSettings?.yOffset ?? 0.02);
    const shadowWidth = Math.max(minSize, bounds.width * sizeMultiplier * 0.72);
    const shadowDepth = Math.max(minSize, bounds.depth * sizeMultiplier * 0.72);

    runtime.shadow.position.set(bounds.centerX, bounds.minY + yOffset, bounds.centerZ);
    runtime.shadow.scaling.set(shadowWidth, 1, shadowDepth);
    runtime.shadow.visibility = this.getTreeBlobShadowNumber('opacity', this.config.blobSettings?.opacity ?? 0.2);
  }

  private readSceneTreeBlobShadowsConfig(): TreeBlobShadowsConfig {
    const rawConfig = configService.getRenderConfig().treeBlobShadows;
    if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return {};
    return rawConfig as TreeBlobShadowsConfig;
  }

  private isTreeBlobShadowEnabled(): boolean {
    return this.sceneTreeBlobShadowsConfig.enabled ?? (this.config.useBlobShadow ?? false);
  }

  private getTreeBlobShadowNumber(key: keyof Pick<TreeBlobShadowsConfig, 'opacity' | 'yOffset' | 'sizeMultiplier' | 'minSize'>, fallback: number): number {
    const value = this.sceneTreeBlobShadowsConfig[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private getTreeShadowBounds(target: TransformNode): {
    minY: number;
    centerX: number;
    centerZ: number;
    width: number;
    depth: number;
  } | null {
    const meshes = target.getChildMeshes(false).filter((mesh) => !mesh.isDisposed() && mesh.getTotalVertices() > 0);
    if (meshes.length === 0) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const mesh of meshes) {
      const bounds = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bounds.minimumWorld.x);
      minY = Math.min(minY, bounds.minimumWorld.y);
      minZ = Math.min(minZ, bounds.minimumWorld.z);
      maxX = Math.max(maxX, bounds.maximumWorld.x);
      maxZ = Math.max(maxZ, bounds.maximumWorld.z);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(minZ) || !Number.isFinite(maxX) || !Number.isFinite(maxZ)) {
      return null;
    }

    return {
      minY,
      centerX: (minX + maxX) * 0.5,
      centerZ: (minZ + maxZ) * 0.5,
      width: Math.max(0.25, maxX - minX),
      depth: Math.max(0.25, maxZ - minZ),
    };
  }

  private disposeTreeBlobShadows(): void {
    for (const runtime of this.treeBlobShadows.values()) {
      runtime.shadow.dispose();
    }
    this.treeBlobShadows.clear();
  }

  /**
   * 应用阴影配置到所有网格
   */
  private applyShadowMeshes(): void {
    if (!this.shadowGenerator) return;

    let receiverCount = 0;
    let casterCount = 0;
    let excludedCount = 0;

    for (const mesh of this.scene.meshes) {
      if (this.isExcluded(mesh.name)) {
        mesh.receiveShadows = false;
        this.shadowGenerator.removeShadowCaster(mesh, true);
        excludedCount++;
        continue;
      }

      if (this.isShadowReceiver(mesh.name)) {
        mesh.receiveShadows = true;
        receiverCount++;
      }

      if (this.isRuntimeShadowCasterDisabled(mesh)) {
        this.shadowGenerator.removeShadowCaster(mesh, true);
        excludedCount++;
      } else if (this.isShadowCaster(mesh.name)) {
        this.shadowGenerator.addShadowCaster(mesh, true);
        casterCount++;
      }
    }
  }

  /**
   * 应用阴影配置到单个网格
   */
  private applyShadowToMesh(mesh: AbstractMesh): void {
    if (this.isExcluded(mesh.name)) {
      mesh.receiveShadows = false;
      this.shadowGenerator?.removeShadowCaster(mesh, true);
      return;
    }

    if (this.isShadowReceiver(mesh.name)) {
      mesh.receiveShadows = true;
    }

    if (this.isRuntimeShadowCasterDisabled(mesh)) {
      this.shadowGenerator?.removeShadowCaster(mesh, true);
      return;
    }

    if (this.isShadowCaster(mesh.name)) {
      this.shadowGenerator?.addShadowCaster(mesh, true);
    }
  }

  private isRuntimeShadowCasterDisabled(mesh: AbstractMesh): boolean {
    return (mesh.metadata as any)?.disableRuntimeShadowCaster === true;
  }

  /**
   * 检查网格是否为阴影接收者
   */
  private isShadowReceiver(name: string): boolean {
    if (this.shadowReceivers.length === 0) {
      return true;
    }
    return this.isNameMatched(name, this.shadowReceivers);
  }

  /**
   * 检查网格是否为阴影投射者
   */
  private isShadowCaster(name: string): boolean {
    if (this.shadowCasters.length === 0) {
      return true;
    }
    return this.isNameMatched(name, this.shadowCasters);
  }

  /**
   * 检查网格是否被排除
   */
  private isExcluded(name: string): boolean {
    return this.isNameMatched(name, this.excluded);
  }

  /**
   * 模糊匹配网格名称
   */
  private isNameMatched(name: string, candidates: string[]): boolean {
    for (const candidate of candidates) {
      if (name === candidate || name.includes(candidate)) {
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.newMeshObserver) {
      this.scene.onNewMeshAddedObservable.remove(this.newMeshObserver);
      this.newMeshObserver = null;
    }

    if (this.beforeRenderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
      this.beforeRenderObserver = null;
    }

    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;
    }

    this.disposeTreeBlobShadows();
    this.disposePlanarProjectionShadows();
    this.blobShadowMaterial?.dispose();
    this.blobShadowMaterial = null;
    this.blobShadowTexture?.dispose();
    this.blobShadowTexture = null;

  }
}
