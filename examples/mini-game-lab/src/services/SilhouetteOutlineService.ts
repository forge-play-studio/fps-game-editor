import { Camera } from '@babylonjs/core/Cameras/camera';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { SelectionOutlineLayer } from '@babylonjs/core/Layers/selectionOutlineLayer';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Scene } from '@babylonjs/core/scene';

const OUTLINE_LAYER_NAME = 'runtime_silhouette_outline';
const OUTLINE_COLOR = new Color3(0, 0, 0);
const OUTLINE_THICKNESS = 1.0;
const OCCLUSION_STRENGTH = 1.0;
const OCCLUSION_THRESHOLD = 0.00001;
const STATIC_OUTLINE_LAYER_NAME = `${OUTLINE_LAYER_NAME}_static`;
const DYNAMIC_OUTLINE_LAYER_NAME = `${OUTLINE_LAYER_NAME}_dynamic`;
const MAX_STATIC_OUTLINE_TARGETS = 4096;
const MAX_DYNAMIC_OUTLINE_TARGETS = 512;

export class SilhouetteOutlineService {
  private readonly scene: Scene;
  private staticOutlineLayer: SelectionOutlineLayer | null = null;
  private dynamicOutlineLayer: SelectionOutlineLayer | null = null;
  private staticTargetKey = '';
  private dynamicTargetKey = '';
  private warnedSelectionFailure = false;
  private warnedStaticTargetCap = false;
  private warnedDynamicTargetCap = false;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  initialize(camera: Camera): void {
    this.dispose();

    this.staticOutlineLayer = new SelectionOutlineLayer(STATIC_OUTLINE_LAYER_NAME, this.scene, {
      camera,
      mainTextureRatio: 1.0,
      outlineMethod: 0,
    });
    this.dynamicOutlineLayer = new SelectionOutlineLayer(DYNAMIC_OUTLINE_LAYER_NAME, this.scene, {
      camera,
      mainTextureRatio: 1.0,
      outlineMethod: 0,
    });
    this.configureLayer(this.staticOutlineLayer);
    this.configureLayer(this.dynamicOutlineLayer);
  }

  setStaticTargets(meshes: AbstractMesh[]): void {
    this.staticTargetKey = this.applyTargetsToLayer(
      this.staticOutlineLayer,
      meshes,
      this.staticTargetKey,
      MAX_STATIC_OUTLINE_TARGETS,
      'static',
    );
  }

  setTargets(meshes: AbstractMesh[]): void {
    this.dynamicTargetKey = this.applyTargetsToLayer(
      this.dynamicOutlineLayer,
      meshes,
      this.dynamicTargetKey,
      MAX_DYNAMIC_OUTLINE_TARGETS,
      'dynamic',
    );
  }

  dispose(): void {
    this.staticOutlineLayer?.dispose();
    this.staticOutlineLayer = null;
    this.dynamicOutlineLayer?.dispose();
    this.dynamicOutlineLayer = null;
    this.staticTargetKey = '';
    this.dynamicTargetKey = '';
    this.warnedSelectionFailure = false;
    this.warnedStaticTargetCap = false;
    this.warnedDynamicTargetCap = false;
  }

  private isOutlineRenderable(mesh: AbstractMesh | null | undefined): mesh is AbstractMesh {
    if (!mesh || mesh.isDisposed()) return false;
    if (!mesh.isEnabled()) return false;
    if ((mesh.metadata as any)?.disablePlanarProjectionShadow === true) return false;
    if (typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0) return true;

    const boundingInfo = mesh.getBoundingInfo();
    const min = boundingInfo.boundingBox.minimumWorld;
    const max = boundingInfo.boundingBox.maximumWorld;
    const sizeX = max.x - min.x;
    const sizeY = max.y - min.y;
    const sizeZ = max.z - min.z;
    return sizeX > 0.0001 || sizeY > 0.0001 || sizeZ > 0.0001;
  }

  private configureLayer(layer: SelectionOutlineLayer | null): void {
    if (!layer) return;
    layer.outlineColor = OUTLINE_COLOR;
    layer.outlineThickness = OUTLINE_THICKNESS;
    layer.occlusionStrength = OCCLUSION_STRENGTH;
    layer.occlusionThreshold = OCCLUSION_THRESHOLD;
  }

  private applyTargetsToLayer(
    layer: SelectionOutlineLayer | null,
    meshes: AbstractMesh[],
    currentKey: string,
    maxTargets: number,
    scope: 'static' | 'dynamic',
  ): string {
    if (!layer) return currentKey;

    const deduped = new Map<number, AbstractMesh>();
    for (const mesh of meshes) {
      if (!this.isOutlineRenderable(mesh)) continue;
      deduped.set(mesh.uniqueId, mesh);
    }
    const sortedMeshes = [...deduped.values()].sort((a, b) => a.uniqueId - b.uniqueId);
    const nextMeshes = sortedMeshes.slice(0, maxTargets);
    if (sortedMeshes.length > maxTargets) {
      if (scope === 'static' && !this.warnedStaticTargetCap) {
        this.warnedStaticTargetCap = true;
        console.warn(
          `[SilhouetteOutlineService] Static outline targets capped to ${maxTargets} (from ${sortedMeshes.length}).`,
        );
      }
      if (scope === 'dynamic' && !this.warnedDynamicTargetCap) {
        this.warnedDynamicTargetCap = true;
        console.warn(
          `[SilhouetteOutlineService] Dynamic outline targets capped to ${maxTargets} (from ${sortedMeshes.length}).`,
        );
      }
    }

    const nextKey = nextMeshes.map((mesh) => mesh.uniqueId).join(',');
    if (nextKey === currentKey) return currentKey;

    layer.clearSelection();
    for (const mesh of nextMeshes) {
      try {
        layer.addSelection(mesh);
      } catch (error) {
        if (!this.warnedSelectionFailure) {
          this.warnedSelectionFailure = true;
          console.warn('[SilhouetteOutlineService] addSelection failed for mesh, skipping outline target.', error);
        }
      }
    }
    return nextKey;
  }
}
