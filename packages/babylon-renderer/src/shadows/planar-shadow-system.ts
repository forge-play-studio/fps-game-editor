import { Constants } from '@babylonjs/core/Engines/constants';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import {
  getPlanarShadowShaderAttributes,
  getPlanarShadowShaderSamplers,
  getPlanarShadowShaderUniforms,
  getPlanarShadowSkeletonDefines,
  PLANAR_SHADOW_SHADER_NAME,
  registerPlanarShadowShaders,
} from './planar-shadow-shaders';
import {
  DEFAULT_PLANAR_SHADOW_OPTIONS,
  type PlanarShadowCasterInfo,
  type PlanarShadowOptions,
  type PlanarShadowReceiverInfo,
  type PlanarShadowSystem,
  type ResolvedPlanarShadowOptions,
} from './types';

const PLANAR_SHADOW_ALPHA_INDEX = 4;
const DEFAULT_SHADOW_DIRECTION = new Vector3(-0.3, -1, -0.2).normalize();

type StencilStateLike = {
  enabled: boolean;
  func?: number;
  funcRef?: number;
  funcMask?: number;
  mask?: number;
  opStencilDepthPass?: number;
  opStencilFail?: number;
  opDepthFail?: number;
};

type MaterialLike = {
  stencil?: StencilStateLike;
};

export function createPlanarShadowSystem(
  scene: Scene,
  directionalLight: DirectionalLight,
  options: Partial<PlanarShadowOptions> = {},
): PlanarShadowSystem {
  return new BabylonPlanarShadowSystem(scene, directionalLight, options);
}

class BabylonPlanarShadowSystem implements PlanarShadowSystem {
  private options: ResolvedPlanarShadowOptions;
  private baseMaterial: ShaderMaterial | null = null;
  private readonly materials = new Set<ShaderMaterial>();
  private readonly casters = new Map<AbstractMesh, PlanarShadowCasterInfo>();
  private readonly receivers = new Map<AbstractMesh, PlanarShadowReceiverInfo>();
  private readonly syncObservers = new Map<AbstractMesh, Observer<Scene>>();
  private renderObserver: Observer<Scene> | null = null;
  private meshAddedObserver: Observer<AbstractMesh> | null = null;
  private initialized = false;
  private casterPatterns: string[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly directionalLight: DirectionalLight,
    options: Partial<PlanarShadowOptions>,
  ) {
    this.options = resolvePlanarShadowOptions(options);
    this.casterPatterns = [...this.options.casters.includePatterns];
  }

  initialize(): void {
    if (this.initialized || !this.options.enabled) return;
    registerPlanarShadowShaders();
    if (this.options.stencil.enabled) this.setupStencil();
    this.baseMaterial = this.createShadowMaterial();
    this.materials.add(this.baseMaterial);
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => this.updateUniforms());
    this.initialized = true;
    this.refresh();
  }

  addCaster(mesh: AbstractMesh): void {
    const root = this.findCasterRoot(mesh);
    if (!this.initialized || this.casters.has(root)) return;
    if (!this.isValidShadowSource(mesh)) return;
    const shadow = this.createShadowForNode(root);
    if (shadow) this.casters.set(shadow.source, shadow);
  }

  removeCaster(mesh: AbstractMesh): void {
    const root = this.findCasterRoot(mesh);
    const info = this.casters.get(root);
    if (!info) return;
    const observer = this.syncObservers.get(root);
    if (observer) {
      this.scene.onBeforeRenderObservable.remove(observer);
      this.syncObservers.delete(root);
    }
    for (const shadowMesh of info.shadow.getChildMeshes(false)) {
      if (shadowMesh instanceof Mesh && shadowMesh.material && shadowMesh.material !== this.baseMaterial) {
        this.materials.delete(shadowMesh.material as ShaderMaterial);
        shadowMesh.material.dispose();
      }
    }
    info.shadow.dispose();
    this.casters.delete(root);
  }

  addReceiver(mesh: AbstractMesh): void {
    if (!this.options.stencil.enabled || this.receivers.has(mesh)) return;
    const originalRenderingGroup = mesh instanceof Mesh ? mesh.renderingGroupId : 0;
    if (mesh instanceof Mesh) mesh.renderingGroupId = this.options.stencil.receiverRenderingGroup;
    const material = readMeshMaterial(mesh);
    if (material?.stencil) {
      const stencil = material.stencil;
      stencil.enabled = true;
      stencil.func = Constants.ALWAYS;
      stencil.funcRef = 1;
      stencil.funcMask = 0xff;
      stencil.mask = 0xff;
      stencil.opStencilDepthPass = Constants.REPLACE;
      stencil.opStencilFail = Constants.KEEP;
      stencil.opDepthFail = Constants.KEEP;
    }
    this.receivers.set(mesh, { mesh, originalRenderingGroup, material });
  }

  removeReceiver(mesh: AbstractMesh): void {
    const info = this.receivers.get(mesh);
    if (!info) return;
    if (mesh instanceof Mesh) mesh.renderingGroupId = info.originalRenderingGroup;
    if (info.material?.stencil) info.material.stencil.enabled = false;
    this.receivers.delete(mesh);
  }

  enableCasterAutoDetection(patterns: string[]): void {
    this.options = {
      ...this.options,
      casters: {
        ...this.options.casters,
        autoDetectAll: false,
        includePatterns: [...patterns],
      },
    };
    this.casterPatterns = [...patterns];
    this.refresh();
    this.ensureMeshObserver();
  }

  enableAutoDetectionForAll(): void {
    this.options = {
      ...this.options,
      casters: {
        ...this.options.casters,
        autoDetectAll: true,
      },
    };
    this.casterPatterns = [];
    this.refresh();
    this.ensureMeshObserver();
  }

  refresh(): void {
    if (!this.initialized) return;
    this.refreshReceivers();
    for (const mesh of this.scene.meshes) this.tryAutoAddCaster(mesh);
    if (this.options.casters.autoDetectAll || this.casterPatterns.length > 0 || this.options.receivers.patterns.length > 0) {
      this.ensureMeshObserver();
    }
  }

  setOptions(options: Partial<PlanarShadowOptions>): void {
    const wasEnabled = this.options.enabled;
    this.options = resolvePlanarShadowOptions(options, this.options);
    this.casterPatterns = [...this.options.casters.includePatterns];
    if (!wasEnabled && this.options.enabled) this.initialize();
    else if (wasEnabled && !this.options.enabled) this.dispose();
    else this.refresh();
  }

  getOptions(): ResolvedPlanarShadowOptions {
    return cloneResolvedOptions(this.options);
  }

  getCasterCount(): number {
    return this.casters.size;
  }

  getReceiverCount(): number {
    return this.receivers.size;
  }

  dispose(): void {
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
    if (this.meshAddedObserver) {
      this.scene.onNewMeshAddedObservable.remove(this.meshAddedObserver);
      this.meshAddedObserver = null;
    }
    for (const [mesh, observer] of [...this.syncObservers]) {
      this.scene.onBeforeRenderObservable.remove(observer);
      this.syncObservers.delete(mesh);
    }
    for (const mesh of [...this.casters.keys()]) this.removeCaster(mesh);
    for (const mesh of [...this.receivers.keys()]) this.removeReceiver(mesh);
    for (const material of this.materials) material.dispose();
    this.materials.clear();
    this.baseMaterial = null;
    this.initialized = false;
  }

  private setupStencil(): void {
    this.scene.getEngine().setStencilBuffer(true);
    this.scene.setRenderingAutoClearDepthStencil(this.options.stencil.receiverRenderingGroup, true, false, true);
    this.scene.setRenderingAutoClearDepthStencil(this.options.stencil.shadowRenderingGroup, false, false, false);
  }

  private createShadowMaterial(defines: string[] = []): ShaderMaterial {
    const usesBoneTexture = defines.includes('BONETEXTURE');
    const usesBones = defines.includes('BONE');
    const material = new ShaderMaterial(
      `fps.planarShadow.${this.materials.size}`,
      this.scene,
      { vertex: PLANAR_SHADOW_SHADER_NAME, fragment: PLANAR_SHADOW_SHADER_NAME },
      {
        attributes: getPlanarShadowShaderAttributes(),
        uniforms: getPlanarShadowShaderUniforms(),
        samplers: getPlanarShadowShaderSamplers(),
        defines,
      },
    );
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    material.depthFunction = Constants.LEQUAL;
    material.needAlphaBlending = () => true;
    material.alphaMode = Constants.ALPHA_COMBINE;

    if (usesBones) {
      let lastBoundTexture: unknown = null;
      let lastTextureWidth = 0;
      material.onBindObservable.add((mesh) => {
        if (!mesh?.skeleton) return;
        const skeleton = mesh.skeleton;
        skeleton.prepare();
        if (usesBoneTexture) {
          const boneTexture = skeleton.getTransformMatrixTexture(mesh);
          if (!boneTexture) return;
          const textureWidth = boneTexture.getSize().width;
          if (boneTexture !== lastBoundTexture || textureWidth !== lastTextureWidth) {
            material.setTexture('boneSampler', boneTexture);
            material.setFloat('boneTextureWidth', textureWidth);
            lastBoundTexture = boneTexture;
            lastTextureWidth = textureWidth;
          }
        } else {
          const matrices = skeleton.getTransformMatrices(mesh);
          const effect = material.getEffect();
          if (matrices && effect) effect.setMatrices('mBones', matrices);
        }
      });
    }

    if (this.options.stencil.enabled && material.stencil) {
      const stencil = material.stencil;
      stencil.enabled = true;
      stencil.func = Constants.EQUAL;
      stencil.funcRef = 1;
      stencil.funcMask = 0xff;
      stencil.mask = 0xff;
      stencil.opStencilDepthPass = Constants.INCR;
      stencil.opStencilFail = Constants.KEEP;
      stencil.opDepthFail = Constants.KEEP;
      stencil.backFunc = stencil.func;
      stencil.backOpStencilDepthPass = stencil.opStencilDepthPass;
      stencil.backOpStencilFail = stencil.opStencilFail;
      stencil.backOpDepthFail = stencil.opDepthFail;
    }

    return material;
  }

  private updateUniforms(): void {
    if (this.materials.size === 0) return;
    const planeNormal = new Vector3(
      this.options.plane.normal.x,
      this.options.plane.normal.y,
      this.options.plane.normal.z,
    ).normalize();
    const lightDir = this.resolveShadowDirection();
    const shadowColor = new Color4(
      clamp01(this.options.appearance.color.r),
      clamp01(this.options.appearance.color.g),
      clamp01(this.options.appearance.color.b),
      clamp01(this.options.appearance.color.a),
    );

    for (const material of this.materials) {
      material.setVector3('u_lightDir', lightDir);
      material.setVector3('u_planeNormal', planeNormal);
      material.setFloat('u_planeHeight', this.options.plane.height);
      material.setFloat('u_planeBias', this.options.plane.bias);
      material.setColor4('u_shadowColor', shadowColor);
    }
  }

  private resolveShadowDirection(): Vector3 {
    const direction = this.directionalLight.direction;
    if (direction?.lengthSquared?.() > 1e-6) return direction.clone().normalize();
    return DEFAULT_SHADOW_DIRECTION.clone();
  }

  private refreshReceivers(): void {
    if (!this.options.stencil.enabled) return;
    for (const mesh of [...this.receivers.keys()]) {
      if (!this.matchesReceiver(mesh)) this.removeReceiver(mesh);
    }
    for (const mesh of this.scene.meshes) {
      if (this.matchesReceiver(mesh)) this.addReceiver(mesh);
    }
  }

  private tryAutoAddCaster(mesh: AbstractMesh): void {
    if (!this.initialized || this.casters.has(mesh)) return;
    if (!this.isValidShadowSource(mesh)) return;
    if (!this.options.casters.autoDetectAll && !this.matchesCasterPattern(mesh)) return;
    const root = this.findCasterRoot(mesh);
    if (this.isAlreadyCoveredByCaster(root)) return;
    const shadow = this.createShadowForNode(root);
    if (shadow) this.casters.set(shadow.source, shadow);
  }

  private ensureMeshObserver(): void {
    if (this.meshAddedObserver) return;
    this.meshAddedObserver = this.scene.onNewMeshAddedObservable.add((mesh) => {
      queueMicrotask(() => {
        if (!this.initialized || mesh.isDisposed()) return;
        if (this.matchesReceiver(mesh)) this.addReceiver(mesh);
        this.tryAutoAddCaster(mesh);
      });
    });
  }

  private createShadowForNode(root: AbstractMesh): PlanarShadowCasterInfo | null {
    const validMeshes = collectNodeMeshes(root).filter((mesh) => this.isValidShadowSource(mesh));
    if (validMeshes.length === 0) return null;
    const shadowRoot = new TransformNode(`${root.name}_planarShadowRoot`, this.scene) as unknown as AbstractMesh;
    let hasSkeleton = false;
    const pairs: Array<{ source: Mesh | InstancedMesh; shadow: Mesh }> = [];
    let sharedSkeleton: unknown = null;
    let sharedMaterial: ShaderMaterial | null = null;

    for (const mesh of validMeshes) {
      if (!(mesh instanceof Mesh) && !(mesh instanceof InstancedMesh)) continue;
      const geometrySource = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
      const material: ShaderMaterial | null = geometrySource.skeleton
        ? this.resolveSkeletonShadowMaterial(geometrySource, sharedSkeleton, sharedMaterial)
        : this.baseMaterial;
      if (geometrySource.skeleton) {
        hasSkeleton = true;
        sharedSkeleton = geometrySource.skeleton;
        sharedMaterial = material;
      }
      if (!material) continue;
      const shadowMesh = this.createShadowMesh(mesh, material);
      if (shadowMesh) {
        shadowMesh.parent = shadowRoot;
        pairs.push({ source: mesh, shadow: shadowMesh });
      }
    }

    if (pairs.length === 0) {
      shadowRoot.dispose();
      return null;
    }

    const sync = () => {
      if (shadowRoot.isDisposed()) return;
      for (const pair of pairs) {
        if (pair.source.isDisposed() || pair.shadow.isDisposed()) continue;
        pair.source.computeWorldMatrix(true).decompose(
          pair.shadow.scaling,
          pair.shadow.rotationQuaternion!,
          pair.shadow.position,
        );
      }
    };
    sync();
    const observer = this.scene.onBeforeRenderObservable.add(sync);
    this.syncObservers.set(root, observer);

    return {
      source: root,
      shadow: shadowRoot,
      hasSkeleton,
    };
  }

  private resolveSkeletonShadowMaterial(
    geometrySource: Mesh,
    sharedSkeleton: unknown,
    sharedMaterial: ShaderMaterial | null,
  ): ShaderMaterial | null {
    if (geometrySource.skeleton === sharedSkeleton && sharedMaterial) return sharedMaterial;
    const numBones = geometrySource.skeleton?.bones.length ?? 0;
    const useTexture = !!this.scene.getEngine().getCaps().textureFloat && numBones > 4;
    const hasExtra = geometrySource.isVerticesDataPresent('matricesIndicesExtra');
    const material = this.createShadowMaterial(getPlanarShadowSkeletonDefines(numBones, useTexture, hasExtra));
    this.materials.add(material);
    return material;
  }

  private createShadowMesh(source: Mesh | InstancedMesh, material: ShaderMaterial): Mesh | null {
    const geometrySource = source instanceof InstancedMesh ? source.sourceMesh : source;
    const shadowMesh = geometrySource.clone(`${source.name}_planarShadow`, null, true, false) as Mesh | null;
    if (!shadowMesh) return null;
    if (geometrySource.skeleton) {
      shadowMesh.skeleton = geometrySource.skeleton;
      geometrySource.skeleton.prepare();
    }
    shadowMesh.material = material;
    shadowMesh.isPickable = false;
    shadowMesh.receiveShadows = false;
    shadowMesh.renderingGroupId = this.options.stencil.shadowRenderingGroup;
    shadowMesh.alphaIndex = PLANAR_SHADOW_ALPHA_INDEX;
    shadowMesh.renderOutline = false;
    shadowMesh.renderOverlay = false;
    shadowMesh.metadata = {
      ...(shadowMesh.metadata && typeof shadowMesh.metadata === 'object' ? shadowMesh.metadata : {}),
      disablePlanarShadow: true,
      planarShadowInternal: true,
    };
    if (!shadowMesh.rotationQuaternion) shadowMesh.rotationQuaternion = shadowMesh.rotation.toQuaternion();
    return shadowMesh;
  }

  private isValidShadowSource(mesh: AbstractMesh): boolean {
    if (!(mesh instanceof Mesh) && !(mesh instanceof InstancedMesh)) return false;
    if (mesh instanceof Mesh && !mesh.geometry) return false;
    if (mesh instanceof InstancedMesh && !mesh.sourceMesh.geometry) return false;
    if (!mesh.isVisible || !mesh.isEnabled()) return false;
    if (hasDisablePlanarShadowMetadata(mesh)) return false;
    if (this.matchesExcludePattern(mesh) || this.hasExcludedAncestor(mesh)) return false;
    mesh.computeWorldMatrix(true);
    const size = mesh.getBoundingInfo()?.boundingBox.extendSizeWorld;
    if (!size) return true;
    return size.x * size.y * size.z >= this.options.casters.minVolume;
  }

  private findCasterRoot(mesh: AbstractMesh): AbstractMesh {
    let topmost: AbstractMesh = mesh;
    let current = mesh.parent;
    while (current) {
      if (this.matchesRootBoundaryPattern(current) || hasDisablePlanarShadowMetadata(current)) break;
      if (!(current instanceof AbstractMesh)) {
        current = current.parent;
        continue;
      }
      if (this.matchesExcludePattern(current)) break;
      topmost = current;
      current = current.parent;
    }
    return topmost;
  }

  private matchesCasterPattern(mesh: AbstractMesh): boolean {
    return this.casterPatterns.some((pattern) => nodeOrAncestorNameIncludes(mesh, pattern));
  }

  private matchesReceiver(mesh: AbstractMesh): boolean {
    return this.options.stencil.enabled
      && !hasDisablePlanarShadowMetadata(mesh)
      && !this.matchesExcludePattern(mesh)
      && !this.hasExcludedAncestor(mesh)
      && this.options.receivers.patterns.some((pattern) => nodeOrAncestorNameIncludes(mesh, pattern));
  }

  private matchesExcludePattern(node: { name?: string }): boolean {
    const name = node.name?.toLowerCase() ?? '';
    return this.options.casters.excludePatterns.some((pattern) => pattern && name.includes(pattern.toLowerCase()));
  }

  private matchesRootBoundaryPattern(node: { name?: string }): boolean {
    const name = node.name?.toLowerCase() ?? '';
    return this.options.casters.rootBoundaryPatterns.some((pattern) => pattern && name.includes(pattern.toLowerCase()));
  }

  private hasExcludedAncestor(mesh: AbstractMesh): boolean {
    let current = mesh.parent;
    while (current) {
      if (hasDisablePlanarShadowMetadata(current) || this.matchesExcludePattern(current)) return true;
      current = current.parent;
    }
    return false;
  }

  private isAlreadyCoveredByCaster(node: AbstractMesh): boolean {
    for (const caster of this.casters.keys()) {
      if (caster === node || isDescendantOf(node, caster) || isDescendantOf(caster, node)) return true;
    }
    return false;
  }
}

function resolvePlanarShadowOptions(
  override: Partial<PlanarShadowOptions>,
  base: ResolvedPlanarShadowOptions = DEFAULT_PLANAR_SHADOW_OPTIONS,
): ResolvedPlanarShadowOptions {
  return {
    enabled: override.enabled ?? base.enabled,
    plane: { ...base.plane, ...override.plane },
    appearance: {
      color: { ...base.appearance.color, ...override.appearance?.color },
    },
    direction: { mode: 'follow-light' },
    stencil: {
      enabled: override.stencil?.enabled ?? base.stencil.enabled,
      receiverRenderingGroup: override.stencil?.receiverRenderingGroup ?? base.stencil.receiverRenderingGroup,
      shadowRenderingGroup: override.stencil?.shadowRenderingGroup ?? base.stencil.shadowRenderingGroup,
    },
    casters: {
      autoDetectAll: override.casters?.autoDetectAll ?? base.casters.autoDetectAll,
      includePatterns: override.casters?.includePatterns ? [...override.casters.includePatterns] : [...base.casters.includePatterns],
      excludePatterns: override.casters?.excludePatterns ? [...override.casters.excludePatterns] : [...base.casters.excludePatterns],
      rootBoundaryPatterns: override.casters?.rootBoundaryPatterns
        ? [...override.casters.rootBoundaryPatterns]
        : [...base.casters.rootBoundaryPatterns],
      minVolume: override.casters?.minVolume ?? base.casters.minVolume,
    },
    receivers: {
      patterns: override.receivers?.patterns ? [...override.receivers.patterns] : [...base.receivers.patterns],
    },
    debug: override.debug ?? base.debug,
  };
}

function cloneResolvedOptions(options: ResolvedPlanarShadowOptions): ResolvedPlanarShadowOptions {
  return resolvePlanarShadowOptions(options);
}

function collectNodeMeshes(root: AbstractMesh): AbstractMesh[] {
  const meshes = root.getChildMeshes(false);
  if (root instanceof Mesh || root instanceof InstancedMesh) meshes.unshift(root);
  return meshes;
}

function nodeOrAncestorNameIncludes(mesh: AbstractMesh, pattern: string): boolean {
  const normalized = pattern.toLowerCase();
  if (mesh.name.toLowerCase().includes(normalized)) return true;
  let current = mesh.parent;
  while (current) {
    if (current.name?.toLowerCase().includes(normalized)) return true;
    current = current.parent;
  }
  return false;
}

function isDescendantOf(node: AbstractMesh, ancestor: AbstractMesh): boolean {
  let current = node.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function hasDisablePlanarShadowMetadata(node: { metadata?: unknown }): boolean {
  const metadata = node.metadata;
  return !!metadata
    && typeof metadata === 'object'
    && ((metadata as { disablePlanarShadow?: unknown }).disablePlanarShadow === true
      || (metadata as { planarShadowInternal?: unknown }).planarShadowInternal === true);
}

function readMeshMaterial(mesh: AbstractMesh): MaterialLike | null {
  const material = (mesh as { material?: unknown }).material;
  return material && typeof material === 'object'
    ? material as MaterialLike
    : null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
