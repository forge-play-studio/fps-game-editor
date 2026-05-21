import type {
  EditorSelectionState,
  EditorTransformPivot,
  EditorTransformSnapshot,
  EditorTransformVec3,
} from '@fps-games/editor-core';
import type {
  BabylonRuntimeGlobal,
  RuntimeScene,
} from './types';

export type BabylonEditorProjectionVec3 = EditorTransformVec3;

export interface BabylonEditorProjectionTransform {
  position: BabylonEditorProjectionVec3;
  rotation: BabylonEditorProjectionVec3;
  scale?: BabylonEditorProjectionVec3;
}

export interface BabylonEditorProjectionAssetTransform {
  position?: BabylonEditorProjectionVec3;
  rotation?: BabylonEditorProjectionVec3;
  rotationDeg?: BabylonEditorProjectionVec3;
  scale?: number | BabylonEditorProjectionVec3;
}

export interface BabylonEditorProjectionAsset {
  id?: string;
  sourceId?: string;
  transform?: BabylonEditorProjectionAssetTransform;
  metadata?: Record<string, unknown>;
}

export interface BabylonEditorProjectionNode {
  id: string;
  name?: string;
  parentId?: string | null;
  active?: boolean;
  transform?: BabylonEditorProjectionTransform;
  asset?: BabylonEditorProjectionAsset | null;
}

export interface BabylonEditorProjectionImportResult {
  meshes?: any[];
  transformNodes?: any[];
  animationGroups?: any[];
}

export interface BabylonEditorProjectionImportContext {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
  root: any;
  node: BabylonEditorProjectionNode;
  asset: BabylonEditorProjectionAsset;
}

export type BabylonEditorProjectionImporter = (
  context: BabylonEditorProjectionImportContext,
) => Promise<BabylonEditorProjectionImportResult | null | undefined>;

export interface BabylonEditorProjectionOptions {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
  importModel?: BabylonEditorProjectionImporter;
  logger?: Pick<Console, 'warn'>;
}

export interface ProjectedBabylonEditorNode {
  nodeId: string;
  root: any;
  outlineMeshes: any[];
  animationGroups: any[];
  loadPromise?: Promise<void>;
}

export interface BabylonEditorProjection {
  projectNodes(nodes: BabylonEditorProjectionNode[]): void;
  projectNode(node: BabylonEditorProjectionNode): ProjectedBabylonEditorNode | null;
  removeNode(nodeId: string): void;
  rebuild(nodes: BabylonEditorProjectionNode[]): void;
  readNodeTransform(nodeId: string): EditorTransformSnapshot | null;
  readNodeTransforms(nodeIds: string[]): Record<string, EditorTransformSnapshot>;
  setNodeTransformPreview(nodeId: string, transform: EditorTransformSnapshot): void;
  setNodeTransformsPreview(transforms: Record<string, EditorTransformSnapshot>): void;
  getAttachableRoot(nodeId: string): any | null;
  getSelectionBounds(nodeIds: string[]): BabylonEditorProjectionBounds | null;
  getSelectionPivot(nodeIds: string[]): EditorTransformPivot | null;
  syncNodeTransform(node: BabylonEditorProjectionNode): void;
  syncSelection(selection: EditorSelectionState): void;
  resolveProjectionNodeId(target: unknown): string | null;
  pickNodeIdAt(clientX: number, clientY: number): string | null;
  getNodeIdsInScreenRect(rect: BabylonEditorProjectionScreenRect): string[];
  getProjectedNode(nodeId: string): ProjectedBabylonEditorNode | null;
  dispose(): void;
}

export interface BabylonEditorProjectionScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BabylonEditorProjectionBounds {
  min: BabylonEditorProjectionVec3;
  max: BabylonEditorProjectionVec3;
  center: BabylonEditorProjectionVec3;
  size: BabylonEditorProjectionVec3;
}

function requireBabylonCtor<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`Babylon runtime missing ${name}`);
  return value;
}

export function createBabylonEditorProjection(
  options: BabylonEditorProjectionOptions,
): BabylonEditorProjection {
  const projections = new Map<string, ProjectedBabylonEditorNode>();

  const disposeProjectedNode = (projection: ProjectedBabylonEditorNode): void => {
    for (const animationGroup of projection.animationGroups) {
      animationGroup.dispose?.();
    }
    projection.root?.dispose?.();
  };

  const disposeAll = (): void => {
    for (const projection of projections.values()) {
      disposeProjectedNode(projection);
    }
    projections.clear();
  };

  const projectNode = (node: BabylonEditorProjectionNode): ProjectedBabylonEditorNode | null => {
    removeNode(node.id);
    const root = createProjectionRoot(options.babylon, options.scene, node);
    if (!root) return null;
    const projection: ProjectedBabylonEditorNode = {
      nodeId: node.id,
      root,
      outlineMeshes: [],
      animationGroups: [],
    };
    projections.set(node.id, projection);
    root.setEnabled?.(node.active !== false);
    if (node.transform) applyProjectionTransform(options.babylon, root, node.transform);

    if (node.asset && options.importModel) {
      projection.loadPromise = loadModelProjection(options, node, projection);
    } else {
      attachFallbackProjection(options.babylon, options.scene, node, projection, !!node.asset);
    }
    return projection;
  };

  const removeNode = (nodeId: string): void => {
    const existing = projections.get(nodeId);
    if (!existing) return;
    projections.delete(nodeId);
    disposeProjectedNode(existing);
  };

  return {
    projectNodes(nodes) {
      disposeAll();
      for (const node of nodes) projectNode(node);
    },
    projectNode,
    removeNode,
    rebuild(nodes) {
      this.projectNodes(nodes);
    },
    readNodeTransform(nodeId) {
      const projection = projections.get(nodeId);
      return projection?.root ? readProjectionTransform(projection.root) : null;
    },
    readNodeTransforms(nodeIds) {
      const transforms: Record<string, EditorTransformSnapshot> = {};
      for (const nodeId of nodeIds) {
        const transform = this.readNodeTransform(nodeId);
        if (transform) transforms[nodeId] = transform;
      }
      return transforms;
    },
    setNodeTransformPreview(nodeId, transform) {
      const projection = projections.get(nodeId);
      if (!projection?.root) return;
      applyProjectionTransform(options.babylon, projection.root, transform);
    },
    setNodeTransformsPreview(transforms) {
      for (const [nodeId, transform] of Object.entries(transforms)) {
        this.setNodeTransformPreview(nodeId, transform);
      }
    },
    getAttachableRoot(nodeId) {
      return projections.get(nodeId)?.root ?? null;
    },
    getSelectionBounds(nodeIds) {
      return getProjectionSelectionBounds(projections, nodeIds);
    },
    getSelectionPivot(nodeIds) {
      const bounds = getProjectionSelectionBounds(projections, nodeIds);
      if (bounds) {
        return {
          mode: 'selection-center',
          position: bounds.center,
        };
      }
      const transforms = nodeIds
        .map(nodeId => this.readNodeTransform(nodeId))
        .filter((transform): transform is EditorTransformSnapshot => !!transform);
      if (transforms.length === 0) return null;
      return {
        mode: 'selection-center',
        position: averagePositions(transforms),
      };
    },
    syncNodeTransform(node) {
      const projection = projections.get(node.id);
      if (!projection || !node.transform) return;
      applyProjectionTransform(options.babylon, projection.root, node.transform);
    },
    syncSelection(selection) {
      syncProjectionSelection(options.babylon, projections, selection);
    },
    resolveProjectionNodeId(target) {
      return resolveProjectionNodeId(target);
    },
    pickNodeIdAt(clientX, clientY) {
      return pickProjectionNodeIdAt(options.scene, clientX, clientY);
    },
    getNodeIdsInScreenRect(rect) {
      return getProjectionNodeIdsInScreenRect(options.babylon, options.scene, projections, rect);
    },
    getProjectedNode(nodeId) {
      return projections.get(nodeId) ?? null;
    },
    dispose() {
      disposeAll();
    },
  };
}

function readVector3(value: any, fallback: EditorTransformVec3): EditorTransformVec3 {
  return {
    x: Number.isFinite(value?.x) ? Number(value.x) : fallback.x,
    y: Number.isFinite(value?.y) ? Number(value.y) : fallback.y,
    z: Number.isFinite(value?.z) ? Number(value.z) : fallback.z,
  };
}

function addVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function scaleVec3(value: EditorTransformVec3, factor: number): EditorTransformVec3 {
  return {
    x: value.x * factor,
    y: value.y * factor,
    z: value.z * factor,
  };
}

function averagePositions(transforms: EditorTransformSnapshot[]): EditorTransformVec3 {
  const sum = transforms.reduce(
    (current, transform) => addVec3(current, transform.position),
    { x: 0, y: 0, z: 0 },
  );
  return scaleVec3(sum, 1 / transforms.length);
}

function getProjectionSelectionBounds(
  projections: Map<string, ProjectedBabylonEditorNode>,
  nodeIds: string[],
): BabylonEditorProjectionBounds | null {
  let min: EditorTransformVec3 | null = null;
  let max: EditorTransformVec3 | null = null;
  for (const nodeId of nodeIds) {
    const bounds = readProjectionBounds(projections.get(nodeId)?.root);
    if (!bounds) continue;
    min = min
      ? {
          x: Math.min(min.x, bounds.min.x),
          y: Math.min(min.y, bounds.min.y),
          z: Math.min(min.z, bounds.min.z),
        }
      : bounds.min;
    max = max
      ? {
          x: Math.max(max.x, bounds.max.x),
          y: Math.max(max.y, bounds.max.y),
          z: Math.max(max.z, bounds.max.z),
        }
      : bounds.max;
  }
  if (!min || !max) return null;
  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
  return {
    min,
    max,
    center,
    size: {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    },
  };
}

function readProjectionBounds(root: any): Pick<BabylonEditorProjectionBounds, 'min' | 'max'> | null {
  if (!root) return null;
  const bounds = root.getHierarchyBoundingVectors?.();
  if (bounds?.min && bounds?.max) {
    return {
      min: readVector3(bounds.min, { x: 0, y: 0, z: 0 }),
      max: readVector3(bounds.max, { x: 0, y: 0, z: 0 }),
    };
  }
  const transform = readProjectionTransform(root);
  return {
    min: transform.position,
    max: transform.position,
  };
}

export function readProjectionTransform(node: any): EditorTransformSnapshot {
  const rotation = node?.rotationQuaternion?.toEulerAngles?.() ?? node?.rotation;
  return {
    position: readVector3(node?.position, { x: 0, y: 0, z: 0 }),
    rotation: readVector3(rotation, { x: 0, y: 0, z: 0 }),
    scale: readVector3(node?.scaling, { x: 1, y: 1, z: 1 }),
  };
}

function createProjectionRoot(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
): any | null {
  const TransformNode = (babylon as any).TransformNode;
  if (!TransformNode) return null;
  const root = new TransformNode(`${node.id}.projection`, scene);
  root.id = node.id;
  root.name = node.name ?? node.id;
  root.metadata = {
    ...(root.metadata ?? {}),
    editorProjection: {
      nodeId: node.id,
    },
  };
  return root;
}

async function loadModelProjection(
  options: BabylonEditorProjectionOptions,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): Promise<void> {
  const asset = node.asset;
  if (!asset || !options.importModel) {
    attachFallbackProjection(options.babylon, options.scene, node, projection, !!asset);
    return;
  }

  try {
    const result = await options.importModel({
      babylon: options.babylon,
      scene: options.scene,
      root: projection.root,
      node,
      asset,
    });
    if (!result) {
      attachFallbackProjection(options.babylon, options.scene, node, projection, true);
      return;
    }
    if (projection.root.isDisposed?.()) {
      disposeImportedProjectionResult(result);
      return;
    }
    attachImportedProjectionResult(options.babylon, options.scene, node, asset, projection, result);
  } catch (error) {
    options.logger?.warn?.(`[BabylonEditorProjection] Failed to project model "${asset.sourceId ?? asset.id ?? node.id}"`, error);
    if (!projection.root.isDisposed?.()) {
      attachFallbackProjection(options.babylon, options.scene, node, projection, true);
    }
  }
}

function attachImportedProjectionResult(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  asset: BabylonEditorProjectionAsset,
  projection: ProjectedBabylonEditorNode,
  result: BabylonEditorProjectionImportResult,
): void {
  const TransformNode = (babylon as any).TransformNode;
  if (!TransformNode) return;
  try {
    const modelRoot = new TransformNode(`${node.id}.modelRoot`, scene);
    modelRoot.parent = projection.root;
    modelRoot.metadata = {
      ...(modelRoot.metadata ?? {}),
      editorProjection: {
        nodeId: node.id,
        sourceId: asset.sourceId,
      },
    };
    applyAssetDefaultsTransform(babylon, modelRoot, asset.transform);

    const importedNodes = [
      ...(result.transformNodes ?? []),
      ...(result.meshes ?? []),
    ];
    const importedNodeSet = new Set<any>(importedNodes);
    for (const importedNode of importedNodes) {
      if (importedNode === modelRoot) continue;
      if (!importedNode.parent || !importedNodeSet.has(importedNode.parent)) {
        importedNode.parent = modelRoot;
      }
      importedNode.metadata = {
        ...(importedNode.metadata ?? {}),
        editorProjection: {
          nodeId: node.id,
          sourceId: asset.sourceId,
        },
      };
    }
    for (const mesh of result.meshes ?? []) {
      mesh.isPickable = true;
    }
    for (const animationGroup of result.animationGroups ?? []) {
      animationGroup.stop?.();
    }
    projection.animationGroups = result.animationGroups ?? [];
    projection.outlineMeshes = (result.meshes ?? []).filter((mesh: any) => mesh.getTotalVertices?.() > 0);
  } catch (error) {
    disposeImportedProjectionResult(result);
    throw error;
  }
}

function disposeImportedProjectionResult(result: BabylonEditorProjectionImportResult): void {
  for (const animationGroup of result.animationGroups ?? []) {
    animationGroup.dispose?.();
  }
  for (const node of [...(result.meshes ?? []), ...(result.transformNodes ?? [])]) {
    node.dispose?.();
  }
}

function attachFallbackProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
  rendererFallback: boolean,
): void {
  const mesh = createFallbackProjectionMesh(babylon, scene, node, rendererFallback);
  if (!mesh) return;
  mesh.parent = projection.root;
  projection.outlineMeshes = [mesh];
}

function createFallbackProjectionMesh(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  rendererFallback: boolean,
): any | null {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder || !StandardMaterial) return null;
  const mesh = MeshBuilder.CreateBox(`${node.id}.fallbackProjection`, {
    size: rendererFallback ? 1 : 0.24,
  }, scene);
  const material = new StandardMaterial(`${node.id}.projection.material`, scene);
  if (rendererFallback) {
    material.diffuseColor = new Color3(0.22, 0.55, 0.28);
  } else {
    material.diffuseColor = new Color3(0.5, 0.58, 0.68);
    material.alpha = 0.45;
  }
  material.specularColor = new Color3(0.08, 0.1, 0.12);
  mesh.material = material;
  mesh.metadata = {
    ...(mesh.metadata ?? {}),
    editorProjection: {
      nodeId: node.id,
      fallback: true,
    },
  };
  return mesh;
}

export function applyProjectionTransform(
  babylon: BabylonRuntimeGlobal,
  node: any,
  transform: BabylonEditorProjectionTransform,
): void {
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  node.position = new Vector3(transform.position.x, transform.position.y, transform.position.z);
  node.rotation = new Vector3(transform.rotation.x, transform.rotation.y, transform.rotation.z);
  const scale = transform.scale ?? { x: 1, y: 1, z: 1 };
  node.scaling = new Vector3(scale.x, scale.y, scale.z);
}

function applyAssetDefaultsTransform(
  babylon: BabylonRuntimeGlobal,
  node: any,
  transform: BabylonEditorProjectionAssetTransform | undefined,
): void {
  if (!transform) return;
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  node.position = new Vector3(
    transform.position?.x ?? 0,
    transform.position?.y ?? 0,
    transform.position?.z ?? 0,
  );
  if (transform.rotationDeg) {
    node.rotation = new Vector3(
      (transform.rotationDeg.x * Math.PI) / 180,
      (transform.rotationDeg.y * Math.PI) / 180,
      (transform.rotationDeg.z * Math.PI) / 180,
    );
  } else {
    node.rotation = new Vector3(
      transform.rotation?.x ?? 0,
      transform.rotation?.y ?? 0,
      transform.rotation?.z ?? 0,
    );
  }
  if (typeof transform.scale === 'number') {
    node.scaling = new Vector3(transform.scale, transform.scale, transform.scale);
  } else {
    node.scaling = new Vector3(
      transform.scale?.x ?? 1,
      transform.scale?.y ?? 1,
      transform.scale?.z ?? 1,
    );
  }
}

function resolveProjectionNodeId(target: unknown): string | null {
  let current: any = target;
  while (current) {
    const nodeId = current.metadata?.editorProjection?.nodeId;
    if (typeof nodeId === 'string' && nodeId.length > 0) return nodeId;
    current = current.parent ?? null;
  }
  return null;
}

function pickProjectionNodeIdAt(
  scene: RuntimeScene,
  clientX: number,
  clientY: number,
): string | null {
  const canvas = scene.getEngine?.().getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  if (!canvas || typeof scene.pick !== 'function') return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const pick = scene.pick(x, y);
  const pickedNode = pick?.pickedMesh ?? pick?.pickedPoint?.mesh ?? null;
  return resolveProjectionNodeId(pickedNode);
}

function getProjectionNodeIdsInScreenRect(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  projections: Map<string, ProjectedBabylonEditorNode>,
  rect: BabylonEditorProjectionScreenRect,
): string[] {
  const canvas = scene.getEngine?.().getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  const camera = scene.activeCamera ?? (scene as any).cameraToUseForPointers ?? null;
  const Vector3 = babylon.Vector3 as any;
  const Matrix = (babylon as any).Matrix;
  if (!canvas || !camera || !Vector3?.Project || !Matrix?.Identity) return [];
  const canvasRect = canvas.getBoundingClientRect();
  const viewport = camera.viewport?.toGlobal?.(
    scene.getEngine?.().getRenderWidth?.() ?? canvas.width,
    scene.getEngine?.().getRenderHeight?.() ?? canvas.height,
  );
  const transformMatrix = scene.getTransformMatrix?.();
  const worldMatrix = Matrix.Identity();
  if (!viewport || !transformMatrix || !worldMatrix) return [];
  const selectedIds: string[] = [];
  for (const [nodeId, projection] of projections) {
    const bounds = projection.root?.getHierarchyBoundingVectors?.();
    if (!bounds?.min || !bounds?.max) continue;
    const corners = createBoundsCorners(Vector3, bounds.min, bounds.max);
    const projected = corners
      .map((corner: any) => Vector3.Project(corner, worldMatrix, transformMatrix, viewport))
      .map((point: any) => ({
        x: canvasRect.left + point.x,
        y: canvasRect.top + point.y,
      }));
    if (projected.length === 0) continue;
    const minX = Math.min(...projected.map(point => point.x));
    const maxX = Math.max(...projected.map(point => point.x));
    const minY = Math.min(...projected.map(point => point.y));
    const maxY = Math.max(...projected.map(point => point.y));
    if (rectsIntersect(rect, { left: minX, top: minY, right: maxX, bottom: maxY })) {
      selectedIds.push(nodeId);
    }
  }
  return selectedIds;
}

function createBoundsCorners(Vector3: any, min: any, max: any): any[] {
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(max.x, max.y, max.z),
  ];
}

function rectsIntersect(
  left: BabylonEditorProjectionScreenRect,
  right: BabylonEditorProjectionScreenRect,
): boolean {
  return left.left <= right.right
    && left.right >= right.left
    && left.top <= right.bottom
    && left.bottom >= right.top;
}

function syncProjectionSelection(
  babylon: BabylonRuntimeGlobal,
  projections: Map<string, ProjectedBabylonEditorNode>,
  selection: EditorSelectionState,
): void {
  const Color3 = babylon.Color3;
  const selectedIds = new Set(selection.selectedIds);
  for (const [nodeId, projection] of projections) {
    const selected = selectedIds.has(nodeId);
    const active = selection.activeId === nodeId;
    for (const mesh of projection.outlineMeshes) {
      mesh.renderOutline = selected;
      mesh.outlineWidth = active ? 0.09 : selected ? 0.055 : 0;
      if (selected && Color3) {
        mesh.outlineColor = active
          ? new Color3(1, 0.94, 0.45)
          : new Color3(0.35, 0.65, 1);
      }
    }
  }
}
