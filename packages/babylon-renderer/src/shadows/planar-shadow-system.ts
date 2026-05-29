import { Constants } from '@babylonjs/core/Engines/constants';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
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

type PlanarShadowMeshPair =
  | { mode: 'projected-mesh'; source: Mesh | InstancedMesh; shadow: Mesh }
  | { mode: 'flat-hull'; source: Mesh | InstancedMesh; shadow: Mesh };

type PlanarShadowHullGeometry = {
  positions: number[];
  indices: number[];
  normals: number[];
};

type PlanarShadowHullPoint = {
  x: number;
  y: number;
  point: Vector3;
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
  private flatMaterial: StandardMaterial | null = null;
  private readonly materials = new Set<ShaderMaterial>();
  private readonly casters = new Map<AbstractMesh, PlanarShadowCasterInfo>();
  private readonly receivers = new Map<AbstractMesh, PlanarShadowReceiverInfo>();
  private readonly syncObservers = new Map<AbstractMesh, Observer<Scene>>();
  private renderObserver: Observer<Scene> | null = null;
  private meshAddedObserver: Observer<AbstractMesh> | null = null;
  private initialized = false;
  private casterPatterns: string[] = [];
  private resolvedPlaneNormal = Vector3.Up();
  private resolvedPlaneHeight = 0;

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
    this.disposeCaster(root);
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
    this.pruneDisposedCasters();
    this.refreshReceivers();
    for (const mesh of this.scene.meshes) this.tryAutoAddCaster(mesh);
    if (this.options.casters.autoDetectAll || this.casterPatterns.length > 0 || this.options.receivers.patterns.length > 0) {
      this.ensureMeshObserver();
    }
  }

  setOptions(options: Partial<PlanarShadowOptions>): void {
    const wasEnabled = this.options.enabled;
    const requiredUniqueMaterials = this.requiresPerShadowMaterial();
    this.options = resolvePlanarShadowOptions(options, this.options);
    this.casterPatterns = [...this.options.casters.includePatterns];
    const requiresUniqueMaterials = this.requiresPerShadowMaterial();
    if (!wasEnabled && this.options.enabled) this.initialize();
    else if (wasEnabled && !this.options.enabled) this.dispose();
    else {
      if (requiredUniqueMaterials !== requiresUniqueMaterials) this.rebuildCasters();
      this.refresh();
    }
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
    for (const mesh of [...this.casters.keys()]) this.disposeCaster(mesh);
    for (const mesh of [...this.receivers.keys()]) this.removeReceiver(mesh);
    for (const material of this.materials) material.dispose();
    this.materials.clear();
    this.baseMaterial = null;
    this.flatMaterial?.dispose();
    this.flatMaterial = null;
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
    material.onBindObservable.add((mesh) => {
      if (mesh instanceof AbstractMesh) this.bindShadowProjectionUniforms(material, mesh);
    });

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

  private getFlatShadowMaterial(): StandardMaterial {
    if (this.flatMaterial) return this.flatMaterial;
    const material = new StandardMaterial(`fps.planarShadow.flat`, this.scene);
    material.backFaceCulling = false;
    material.disableLighting = true;
    material.disableDepthWrite = true;
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.Black();
    material.alpha = clamp01(this.options.appearance.color.a);
    material.alphaMode = Constants.ALPHA_COMBINE;

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

    this.flatMaterial = material;
    return material;
  }

  private updateUniforms(): void {
    if (this.materials.size === 0) return;
    const planeNormal = new Vector3(
      this.options.plane.normal.x,
      this.options.plane.normal.y,
      this.options.plane.normal.z,
    ).normalize();
    const planeHeight = this.resolvePlaneHeight(planeNormal);
    this.resolvedPlaneNormal = planeNormal;
    this.resolvedPlaneHeight = planeHeight;
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
      material.setVector3('u_shadowCenter', new Vector3(0, planeHeight, 0));
      material.setFloat('u_planeHeight', planeHeight);
      material.setFloat('u_planeBias', this.options.plane.bias);
      material.setFloat('u_footprintScale', this.options.projection.footprintScale);
      material.setColor4('u_shadowColor', shadowColor);
    }

    if (this.flatMaterial) {
      const color = new Color3(shadowColor.r, shadowColor.g, shadowColor.b);
      this.flatMaterial.diffuseColor = color;
      this.flatMaterial.emissiveColor = color;
      this.flatMaterial.alpha = shadowColor.a;
    }
  }

  private bindShadowProjectionUniforms(material: ShaderMaterial, mesh: AbstractMesh): void {
    mesh.computeWorldMatrix(true);
    const center = mesh.getBoundingInfo()?.boundingBox.centerWorld.clone() ?? Vector3.Zero();
    const offset = Vector3.Dot(this.resolvedPlaneNormal, center) - this.resolvedPlaneHeight;
    const projectedCenter = center.subtract(this.resolvedPlaneNormal.scale(offset));
    material.setVector3('u_shadowCenter', projectedCenter);
  }

  private requiresPerShadowMaterial(): boolean {
    return Math.abs(this.options.projection.footprintScale - 1) > 1e-6;
  }

  private resolvePlaneHeight(planeNormal: Vector3): number {
    const fallbackHeight = this.options.plane.height;
    if (this.options.plane.heightMode !== 'receiver') return fallbackHeight;

    let totalHeight = 0;
    let receiverCount = 0;
    for (const mesh of this.receivers.keys()) {
      if (isDisposedNode(mesh)) continue;
      mesh.computeWorldMatrix(true);
      const vectorsWorld = mesh.getBoundingInfo()?.boundingBox?.vectorsWorld;
      if (!vectorsWorld || vectorsWorld.length === 0) continue;

      let receiverSurfaceHeight = -Infinity;
      for (const point of vectorsWorld) {
        const height = Vector3.Dot(planeNormal, point);
        if (Number.isFinite(height)) receiverSurfaceHeight = Math.max(receiverSurfaceHeight, height);
      }
      if (!Number.isFinite(receiverSurfaceHeight)) continue;
      totalHeight += receiverSurfaceHeight;
      receiverCount += 1;
    }

    return receiverCount > 0 ? totalHeight / receiverCount : fallbackHeight;
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

  private pruneDisposedCasters(): void {
    for (const [root, info] of [...this.casters]) {
      if (isDisposedNode(root) || isDisposedNode(info.shadow)) {
        this.disposeCaster(root);
      }
    }
  }

  private disposeCaster(root: AbstractMesh): void {
    const info = this.casters.get(root);
    if (!info) return;
    const observer = this.syncObservers.get(root);
    if (observer) {
      this.scene.onBeforeRenderObservable.remove(observer);
      this.syncObservers.delete(root);
    }
    for (const shadowMesh of info.shadow.getChildMeshes(false)) {
      if (
        shadowMesh instanceof Mesh
        && shadowMesh.material
        && shadowMesh.material !== this.baseMaterial
        && shadowMesh.material !== this.flatMaterial
      ) {
        this.materials.delete(shadowMesh.material as ShaderMaterial);
        shadowMesh.material.dispose();
      }
    }
    info.shadow.dispose();
    this.casters.delete(root);
  }

  private rebuildCasters(): void {
    const roots = [...this.casters.keys()].filter((root) => !isDisposedNode(root));
    for (const root of roots) this.disposeCaster(root);
    for (const root of roots) this.addCaster(root);
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
    const pairs: PlanarShadowMeshPair[] = [];
    let sharedSkeleton: unknown = null;
    let sharedMaterial: ShaderMaterial | null = null;

    for (const mesh of validMeshes) {
      if (!(mesh instanceof Mesh) && !(mesh instanceof InstancedMesh)) continue;
      const geometrySource = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;

      if (geometrySource.skeleton) {
        const material = this.resolveShadowMaterial(geometrySource, sharedSkeleton, sharedMaterial);
        hasSkeleton = true;
        sharedSkeleton = geometrySource.skeleton;
        sharedMaterial = material;
        if (!material) continue;
        const shadowMesh = this.createProjectedShadowMesh(mesh, material);
        if (shadowMesh) {
          shadowMesh.parent = shadowRoot;
          pairs.push({ mode: 'projected-mesh', source: mesh, shadow: shadowMesh });
        }
        continue;
      }

      const shadowMesh = this.createHullShadowMesh(mesh);
      if (shadowMesh) {
        shadowMesh.parent = shadowRoot;
        pairs.push({ mode: 'flat-hull', source: mesh, shadow: shadowMesh });
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
        if (pair.mode === 'flat-hull') {
          this.updateHullShadowMesh(pair.source, pair.shadow);
        } else {
          pair.source.computeWorldMatrix(true).decompose(
            pair.shadow.scaling,
            pair.shadow.rotationQuaternion!,
            pair.shadow.position,
          );
        }
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

  private resolveShadowMaterial(
    geometrySource: Mesh,
    sharedSkeleton: unknown,
    sharedMaterial: ShaderMaterial | null,
  ): ShaderMaterial | null {
    if (this.requiresPerShadowMaterial()) {
      const material = geometrySource.skeleton
        ? this.createShadowMaterial(getPlanarShadowSkeletonDefines(
          geometrySource.skeleton?.bones.length ?? 0,
          !!this.scene.getEngine().getCaps().textureFloat && (geometrySource.skeleton?.bones.length ?? 0) > 4,
          geometrySource.isVerticesDataPresent('matricesIndicesExtra'),
        ))
        : this.createShadowMaterial();
      this.materials.add(material);
      return material;
    }
    return geometrySource.skeleton
      ? this.resolveSkeletonShadowMaterial(geometrySource, sharedSkeleton, sharedMaterial)
      : this.baseMaterial;
  }

  private createProjectedShadowMesh(source: Mesh | InstancedMesh, material: ShaderMaterial): Mesh | null {
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

  private createHullShadowMesh(source: Mesh | InstancedMesh): Mesh | null {
    const shadowMesh = new Mesh(`${source.name}_planarShadow`, this.scene);
    shadowMesh.material = this.getFlatShadowMaterial();
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
    this.updateHullShadowMesh(source, shadowMesh);
    return shadowMesh;
  }

  private updateHullShadowMesh(source: Mesh | InstancedMesh, shadowMesh: Mesh): void {
    const geometry = buildPlanarShadowHullGeometry(source, {
      lightDir: this.resolveShadowDirection(),
      planeNormal: this.resolvedPlaneNormal,
      planeHeight: this.resolvedPlaneHeight,
      planeBias: this.options.plane.bias,
      footprintScale: this.options.projection.footprintScale,
    });
    if (!geometry) {
      shadowMesh.isVisible = false;
      return;
    }

    const vertexData = new VertexData();
    vertexData.positions = geometry.positions;
    vertexData.indices = geometry.indices;
    vertexData.normals = geometry.normals;
    vertexData.applyToMesh(shadowMesh, true);
    shadowMesh.isVisible = true;
  }

  private isValidShadowSource(mesh: AbstractMesh): boolean {
    if (!(mesh instanceof Mesh) && !(mesh instanceof InstancedMesh)) return false;
    if (mesh instanceof Mesh && !mesh.geometry) return false;
    if (mesh instanceof InstancedMesh && !mesh.sourceMesh.geometry) return false;
    if (!mesh.isVisible || !mesh.isEnabled()) return false;
    if (hasDisablePlanarShadowMetadata(mesh)) return false;
    if (this.matchesExcludePattern(mesh) || this.hasExcludedAncestor(mesh)) return false;
    if (this.matchesReceiverPattern(mesh)) return false;
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
      && this.matchesReceiverPattern(mesh);
  }

  private matchesReceiverPattern(mesh: AbstractMesh): boolean {
    return this.options.receivers.patterns.some((pattern) => nodeOrAncestorNameIncludes(mesh, pattern));
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

function buildPlanarShadowHullGeometry(
  source: Mesh | InstancedMesh,
  options: {
    lightDir: Vector3;
    planeNormal: Vector3;
    planeHeight: number;
    planeBias: number;
    footprintScale: number;
  },
): PlanarShadowHullGeometry | null {
  const geometrySource = source instanceof InstancedMesh ? source.sourceMesh : source;
  const positions = geometrySource.getVerticesData(VertexBuffer.PositionKind);
  if (!positions || positions.length < 9) return null;

  const planeNormal = options.planeNormal.clone().normalize();
  const lightDir = options.lightDir.clone().normalize();
  const denom = Vector3.Dot(planeNormal, lightDir);
  if (Math.abs(denom) < 1e-5) return null;

  source.computeWorldMatrix(true);
  const worldMatrix = source.getWorldMatrix();
  const projectedPoints: Vector3[] = [];
  for (let index = 0; index < positions.length; index += 3) {
    const localPoint = new Vector3(
      Number(positions[index]),
      Number(positions[index + 1]),
      Number(positions[index + 2]),
    );
    const worldPoint = Vector3.TransformCoordinates(localPoint, worldMatrix);
    const t = (options.planeHeight - Vector3.Dot(planeNormal, worldPoint)) / denom;
    if (t < -1e-4) continue;
    const projectedPoint = worldPoint.add(lightDir.scale(Math.max(0, t)));
    projectedPoints.push(projectedPoint);
  }
  if (projectedPoints.length < 3) return null;

  const scaleCenter = averageVector3(projectedPoints);
  const footprintScale = Number.isFinite(options.footprintScale) ? Math.max(0, options.footprintScale) : 1;
  const biasedPoints = projectedPoints.map((point) => {
    const scaled = footprintScale === 1
      ? point
      : scaleCenter.add(point.subtract(scaleCenter).scale(footprintScale));
    return scaled.add(planeNormal.scale(options.planeBias * 0.002));
  });

  const basis = buildPlaneBasis(planeNormal);
  const points2d = dedupeHullPoints(biasedPoints.map((point) => ({
    x: Vector3.Dot(point, basis.tangent),
    y: Vector3.Dot(point, basis.bitangent),
    point,
  })));
  if (points2d.length < 3) return null;

  const hull = buildConvexHull(points2d);
  if (hull.length < 3) return null;

  const center = averageVector3(hull.map((point) => point.point));
  const positionsOut = [center.x, center.y, center.z];
  const normalsOut = [planeNormal.x, planeNormal.y, planeNormal.z];
  for (const hullPoint of hull) {
    positionsOut.push(hullPoint.point.x, hullPoint.point.y, hullPoint.point.z);
    normalsOut.push(planeNormal.x, planeNormal.y, planeNormal.z);
  }

  const indicesOut: number[] = [];
  for (let index = 1; index <= hull.length; index += 1) {
    indicesOut.push(0, index, index === hull.length ? 1 : index + 1);
  }

  return {
    positions: positionsOut,
    indices: indicesOut,
    normals: normalsOut,
  };
}

function buildPlaneBasis(normal: Vector3): { tangent: Vector3; bitangent: Vector3 } {
  const seed = Math.abs(Vector3.Dot(normal, Vector3.Up())) > 0.95
    ? Vector3.Right()
    : Vector3.Up();
  const tangent = Vector3.Cross(seed, normal).normalize();
  const bitangent = Vector3.Cross(normal, tangent).normalize();
  return { tangent, bitangent };
}

function dedupeHullPoints(points: PlanarShadowHullPoint[]): PlanarShadowHullPoint[] {
  const seen = new Map<string, PlanarShadowHullPoint>();
  for (const point of points) {
    const key = `${Math.round(point.x * 100000)}:${Math.round(point.y * 100000)}`;
    if (!seen.has(key)) seen.set(key, point);
  }
  return [...seen.values()];
}

function buildConvexHull(points: PlanarShadowHullPoint[]): PlanarShadowHullPoint[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: PlanarShadowHullPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && hullCross(lower[lower.length - 2], lower[lower.length - 1], point) <= 1e-7) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: PlanarShadowHullPoint[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && hullCross(upper[upper.length - 2], upper[upper.length - 1], point) <= 1e-7) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function hullCross(origin: PlanarShadowHullPoint, a: PlanarShadowHullPoint, b: PlanarShadowHullPoint): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function averageVector3(points: Vector3[]): Vector3 {
  const total = points.reduce((sum, point) => sum.addInPlace(point), Vector3.Zero());
  return total.scale(1 / points.length);
}

function resolvePlanarShadowOptions(
  override: Partial<PlanarShadowOptions>,
  base: ResolvedPlanarShadowOptions = DEFAULT_PLANAR_SHADOW_OPTIONS,
): ResolvedPlanarShadowOptions {
  return {
    enabled: override.enabled ?? base.enabled,
    plane: {
      ...base.plane,
      ...override.plane,
      heightMode: readPlaneHeightMode(override.plane?.heightMode, base.plane.heightMode),
    },
    appearance: {
      color: { ...base.appearance.color, ...override.appearance?.color },
    },
    direction: { mode: 'follow-light' },
    projection: {
      footprintScale: readNonNegativeFiniteNumber(
        override.projection?.footprintScale,
        base.projection.footprintScale,
      ),
    },
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

function readPlaneHeightMode(
  value: PlanarShadowOptions['plane']['heightMode'] | undefined,
  fallback: PlanarShadowOptions['plane']['heightMode'] | undefined,
): NonNullable<PlanarShadowOptions['plane']['heightMode']> {
  return value === 'fixed' || value === 'receiver'
    ? value
    : fallback === 'fixed' || fallback === 'receiver'
      ? fallback
      : 'receiver';
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

function isDisposedNode(node: { isDisposed?: () => boolean }): boolean {
  return typeof node.isDisposed === 'function' && node.isDisposed();
}

function readNonNegativeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
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
