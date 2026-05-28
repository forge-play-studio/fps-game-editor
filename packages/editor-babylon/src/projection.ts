import type {
  EditorSelectionState,
  EditorTransformPivot,
  EditorTransformSnapshot,
  EditorTransformVec3,
} from '@fps-games/editor-core';
import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
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

export type BabylonEditorProjectionPrimitiveShape = 'cube' | 'sphere' | 'plane' | 'capsule';

export interface BabylonEditorProjectionPrimitive {
  shape: BabylonEditorProjectionPrimitiveShape;
}

export type BabylonEditorProjectionCameraMode = 'orthographic' | 'perspective';

export interface BabylonEditorProjectionCameraSettings {
  projection?: BabylonEditorProjectionCameraMode;
  alpha: number;
  beta: number;
  radius: number;
  orthoSize: number;
  fov?: number;
}

export interface BabylonEditorProjectionCameraRigApplyOptions {
  target?: BabylonEditorProjectionVec3 | null;
  lockOrbit?: boolean;
}

export interface BabylonEditorProjectionColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface BabylonEditorProjectionDirectionalLightSettings {
  type: 'directional';
  intensity: number;
  direction: BabylonEditorProjectionVec3;
  diffuseColor?: BabylonEditorProjectionColorRGB;
}

export interface BabylonEditorProjectionHemisphericLightSettings {
  type: 'hemispheric';
  intensity: number;
  diffuseColor?: BabylonEditorProjectionColorRGB;
  groundColor?: BabylonEditorProjectionColorRGB;
}

export type BabylonEditorProjectionLightSettings =
  | BabylonEditorProjectionDirectionalLightSettings
  | BabylonEditorProjectionHemisphericLightSettings;

export interface BabylonEditorProjectionNode {
  id: string;
  name?: string;
  parentId?: string | null;
  active?: boolean;
  transform?: BabylonEditorProjectionTransform;
  asset?: BabylonEditorProjectionAsset | null;
  primitive?: BabylonEditorProjectionPrimitive | null;
  helperKind?: 'root';
  runtimeKind?: 'camera' | 'light';
  camera?: BabylonEditorProjectionCameraSettings;
  light?: BabylonEditorProjectionLightSettings;
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
  runtimeObjects: any[];
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
    for (const runtimeObject of projection.runtimeObjects) {
      runtimeObject.dispose?.();
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
      runtimeObjects: [],
    };
    projections.set(node.id, projection);
    root.setEnabled?.(node.active !== false);
    if (node.transform) applyProjectionTransform(options.babylon, root, node.transform);

    if (node.helperKind === 'root') {
      attachRootProjection(options.babylon, options.scene, node, projection);
    } else if (!attachRuntimeProjection(options.babylon, options.scene, node, projection)) {
      if (node.asset && options.importModel) {
        projection.loadPromise = loadModelProjection(options, node, projection);
      } else if (node.primitive) {
        attachPrimitiveProjection(options.babylon, options.scene, node, projection);
      } else {
        attachFallbackProjection(options.babylon, options.scene, node, projection, !!node.asset);
      }
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
      if (!projection) return;
      projection.root?.setEnabled?.(node.active !== false);
      for (const runtimeObject of projection.runtimeObjects) {
        runtimeObject.setEnabled?.(node.active !== false);
      }
      if (node.transform) applyProjectionTransform(options.babylon, projection.root, node.transform);
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

function attachRuntimeProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): boolean {
  if (node.runtimeKind === 'camera') {
    attachCameraProjection(babylon, scene, node, projection);
    return true;
  }
  if (node.runtimeKind === 'light') {
    if (node.light?.type === 'hemispheric') {
      attachHemisphericLightProjection(babylon, scene, node, projection);
    } else {
      attachDirectionalLightProjection(babylon, scene, node, projection);
    }
    return true;
  }
  return false;
}

function attachCameraProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): void {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder || !StandardMaterial) return;

  const settings = normalizeBabylonEditorProjectionCameraSettings(node.camera);
  const body = MeshBuilder.CreateBox(`${node.id}.cameraHelper`, {
    width: 0.38,
    height: 0.28,
    depth: 0.24,
  }, scene);
  body.parent = projection.root;
  body.metadata = createProjectionMetadata(node.id, { runtimeKind: 'camera', helper: 'body' });
  const material = new StandardMaterial(`${node.id}.cameraHelper.material`, scene);
  material.diffuseColor = new Color3(0.45, 0.68, 1);
  material.specularColor = new Color3(0.08, 0.1, 0.12);
  body.material = material;
  projection.runtimeObjects.push(material);
  projection.outlineMeshes = [body];

  const frustum = createCameraFrustumLines(babylon, scene, node, settings);
  if (frustum) {
    frustum.parent = projection.root;
    frustum.isPickable = false;
  }
}

function attachDirectionalLightProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): void {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const DirectionalLight = (babylon as any).DirectionalLight;
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder || !StandardMaterial) return;
  const settings = readProjectionDirectionalLightSettings(
    node.light?.type === 'directional' ? node.light : undefined,
  );
  const direction = new Vector3(settings.direction.x, settings.direction.y, settings.direction.z);

  if (DirectionalLight) {
    const light = new DirectionalLight(`${node.id}.directionalLight`, direction, scene);
    light.intensity = settings.intensity;
    light.diffuse = new Color3(
      settings.diffuseColor?.r ?? 1,
      settings.diffuseColor?.g ?? 1,
      settings.diffuseColor?.b ?? 1,
    );
    light.metadata = createProjectionMetadata(node.id, { runtimeKind: 'light' });
    light.setEnabled?.(node.active !== false);
    projection.runtimeObjects.push(light);
  }

  const helper = MeshBuilder.CreateBox(`${node.id}.lightHelper`, {
    size: 0.28,
  }, scene);
  helper.parent = projection.root;
  helper.metadata = createProjectionMetadata(node.id, { runtimeKind: 'light', helper: 'body' });
  const material = new StandardMaterial(`${node.id}.lightHelper.material`, scene);
  material.diffuseColor = new Color3(1, 0.92, 0.42);
  material.emissiveColor = new Color3(0.5, 0.42, 0.12);
  material.specularColor = new Color3(0.08, 0.1, 0.12);
  helper.material = material;
  projection.runtimeObjects.push(material);
  projection.outlineMeshes = [helper];

  const arrow = createLightDirectionLines(babylon, scene, node, settings.direction);
  if (arrow) {
    arrow.parent = projection.root;
    arrow.isPickable = false;
  }
}

function attachRootProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): void {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder?.CreateSphere || !StandardMaterial) return;

  const sphere = MeshBuilder.CreateSphere(`${node.id}.rootMarker`, {
    diameter: 0.28,
    segments: 24,
  }, scene);
  sphere.parent = projection.root;
  sphere.isPickable = false;
  sphere.metadata = createProjectionMetadata(node.id, {
    helperKind: 'root',
    helper: 'anchor',
  });
  const sphereMaterial = new StandardMaterial(`${node.id}.rootMarker.material`, scene);
  sphereMaterial.diffuseColor = new Color3(0.25, 0.64, 1);
  sphereMaterial.emissiveColor = new Color3(0.08, 0.28, 0.45);
  sphereMaterial.specularColor = new Color3(0.1, 0.16, 0.2);
  sphere.material = sphereMaterial;
  projection.runtimeObjects.push(sphereMaterial);
  projection.outlineMeshes = [sphere];

  const label = createRootLabelProjection(babylon, scene, node);
  if (label) {
    label.parent = projection.root;
    label.isPickable = false;
    label.position.y = 0.42;
    projection.runtimeObjects.push(...(label.metadata?.editorProjectionRuntimeObjects ?? []));
  }
}

function createRootLabelProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
): any | null {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const DynamicTexture = (babylon as any).DynamicTexture;
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder?.CreatePlane || !StandardMaterial || !DynamicTexture) return null;

  let texture: any;
  try {
    texture = new DynamicTexture(`${node.id}.rootLabel.texture`, {
      width: 256,
      height: 96,
    }, scene, false);
  } catch {
    return null;
  }
  texture.hasAlpha = true;
  drawRootLabelTexture(texture);

  const material = new StandardMaterial(`${node.id}.rootLabel.material`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.diffuseColor = new Color3(1, 1, 1);
  material.emissiveColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0, 0, 0);
  material.backFaceCulling = false;

  const label = MeshBuilder.CreatePlane(`${node.id}.rootLabel`, {
    width: 0.9,
    height: 0.34,
  }, scene);
  label.material = material;
  label.billboardMode = (babylon as any).Mesh?.BILLBOARDMODE_ALL ?? 7;
  label.metadata = {
    ...createProjectionMetadata(node.id, {
      helperKind: 'root',
      helper: 'label',
      text: 'Root',
    }),
    editorProjectionRuntimeObjects: [texture, material],
  };
  label.position = new Vector3(0, 0.42, 0);
  return label;
}

function drawRootLabelTexture(texture: any): void {
  const context = texture.getContext?.();
  if (!context) {
    texture.drawText?.('Root', null, 58, 'bold 44px sans-serif', '#f8fbff', 'transparent', true, true);
    return;
  }
  context.clearRect?.(0, 0, 256, 96);
  context.fillStyle = 'rgba(10, 18, 28, 0.76)';
  roundRectPath(context, 14, 18, 228, 56, 18);
  context.fill?.();
  context.strokeStyle = 'rgba(100, 190, 255, 0.9)';
  context.lineWidth = 3;
  roundRectPath(context, 14, 18, 228, 56, 18);
  context.stroke?.();
  context.fillStyle = '#f8fbff';
  context.font = 'bold 42px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText?.('Root', 128, 47);
  texture.update?.();
}

function roundRectPath(context: any, x: number, y: number, width: number, height: number, radius: number): void {
  if (context.roundRect) {
    context.beginPath?.();
    context.roundRect(x, y, width, height, radius);
    return;
  }
  const right = x + width;
  const bottom = y + height;
  context.beginPath?.();
  context.moveTo?.(x + radius, y);
  context.lineTo?.(right - radius, y);
  context.quadraticCurveTo?.(right, y, right, y + radius);
  context.lineTo?.(right, bottom - radius);
  context.quadraticCurveTo?.(right, bottom, right - radius, bottom);
  context.lineTo?.(x + radius, bottom);
  context.quadraticCurveTo?.(x, bottom, x, bottom - radius);
  context.lineTo?.(x, y + radius);
  context.quadraticCurveTo?.(x, y, x + radius, y);
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

function attachPrimitiveProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): void {
  const mesh = createPrimitiveProjectionMesh(babylon, scene, node);
  if (!mesh) {
    attachFallbackProjection(babylon, scene, node, projection, true);
    return;
  }
  mesh.parent = projection.root;
  mesh.isPickable = true;
  if (mesh.material) projection.runtimeObjects.push(mesh.material);
  projection.outlineMeshes = [mesh];
}

function createPrimitiveProjectionMesh(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
): any | null {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder || !StandardMaterial) return null;
  const shape = node.primitive?.shape;
  const name = `${node.id}.${shape ?? 'primitive'}Projection`;
  const mesh = shape === 'sphere'
    ? MeshBuilder.CreateSphere?.(name, { diameter: 1, segments: 32 }, scene)
    : shape === 'plane'
      ? MeshBuilder.CreateGround?.(name, { width: 1, height: 1, subdivisions: 1 }, scene)
      : shape === 'capsule'
        ? MeshBuilder.CreateCapsule?.(name, { height: 2, radius: 0.5, tessellation: 24, subdivisions: 8 }, scene)
        : MeshBuilder.CreateBox?.(name, { size: 1 }, scene);
  if (!mesh) return null;
  const material = new StandardMaterial(`${node.id}.primitive.material`, scene);
  material.diffuseColor = new Color3(0.72, 0.74, 0.76);
  material.specularColor = new Color3(0.12, 0.14, 0.16);
  if (shape === 'plane') material.backFaceCulling = false;
  mesh.material = material;
  mesh.metadata = createProjectionMetadata(node.id, {
    runtimeKind: 'primitive',
    primitiveShape: shape,
  });
  return mesh;
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

function createCameraFrustumLines(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  settings: BabylonEditorProjectionCameraSettings,
): any | null {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder?.CreateLineSystem) return null;
  const distance = Math.max(0.4, settings.radius * 0.12);
  const aspect = 16 / 9;
  const nearDistance = 0.18;
  let lines: any[];

  if (settings.projection === 'perspective') {
    const halfHeight = Math.max(0.12, Math.tan((settings.fov ?? 0.85) / 2) * distance);
    const halfWidth = halfHeight * aspect;
    const origin = new Vector3(0, 0, nearDistance);
    const topLeft = new Vector3(-halfWidth, halfHeight, -distance);
    const topRight = new Vector3(halfWidth, halfHeight, -distance);
    const bottomRight = new Vector3(halfWidth, -halfHeight, -distance);
    const bottomLeft = new Vector3(-halfWidth, -halfHeight, -distance);
    lines = [
      [topLeft, topRight, bottomRight, bottomLeft, topLeft],
      [origin, topLeft],
      [origin, topRight],
      [origin, bottomRight],
      [origin, bottomLeft],
    ];
  } else {
    const halfHeight = Math.max(0.12, settings.orthoSize * 0.08);
    const halfWidth = halfHeight * aspect;
    const nearTopLeft = new Vector3(-halfWidth, halfHeight, -nearDistance);
    const nearTopRight = new Vector3(halfWidth, halfHeight, -nearDistance);
    const nearBottomRight = new Vector3(halfWidth, -halfHeight, -nearDistance);
    const nearBottomLeft = new Vector3(-halfWidth, -halfHeight, -nearDistance);
    const farTopLeft = new Vector3(-halfWidth, halfHeight, -distance);
    const farTopRight = new Vector3(halfWidth, halfHeight, -distance);
    const farBottomRight = new Vector3(halfWidth, -halfHeight, -distance);
    const farBottomLeft = new Vector3(-halfWidth, -halfHeight, -distance);
    lines = [
      [nearTopLeft, nearTopRight, nearBottomRight, nearBottomLeft, nearTopLeft],
      [farTopLeft, farTopRight, farBottomRight, farBottomLeft, farTopLeft],
      [nearTopLeft, farTopLeft],
      [nearTopRight, farTopRight],
      [nearBottomRight, farBottomRight],
      [nearBottomLeft, farBottomLeft],
    ];
  }

  const frustum = MeshBuilder.CreateLineSystem(`${node.id}.cameraFrustum`, {
    lines,
  }, scene);
  frustum.color = new Color3(0.45, 0.68, 1);
  frustum.metadata = createProjectionMetadata(node.id, {
    runtimeKind: 'camera',
    helper: 'frustum',
    projection: settings.projection,
    orthoSize: settings.orthoSize,
    fov: settings.fov,
  });
  return frustum;
}

function createLightDirectionLines(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  direction: BabylonEditorProjectionVec3,
): any | null {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder?.CreateLineSystem) return null;
  const normalized = normalizeProjectionVec3(direction, { x: -0.3, y: -1, z: -0.2 });
  const shaftEnd = new Vector3(normalized.x, normalized.y, normalized.z);
  const arrowLeft = new Vector3(
    shaftEnd.x - normalized.x * 0.22 + normalized.z * 0.12,
    shaftEnd.y - normalized.y * 0.22,
    shaftEnd.z - normalized.z * 0.22 - normalized.x * 0.12,
  );
  const arrowRight = new Vector3(
    shaftEnd.x - normalized.x * 0.22 - normalized.z * 0.12,
    shaftEnd.y - normalized.y * 0.22,
    shaftEnd.z - normalized.z * 0.22 + normalized.x * 0.12,
  );
  const arrow = MeshBuilder.CreateLineSystem(`${node.id}.lightDirection`, {
    lines: [
      [new Vector3(0, 0, 0), shaftEnd],
      [shaftEnd, arrowLeft],
      [shaftEnd, arrowRight],
    ],
  }, scene);
  arrow.color = new Color3(1, 0.92, 0.42);
  arrow.metadata = createProjectionMetadata(node.id, {
    runtimeKind: 'light',
    helper: 'direction',
  });
  return arrow;
}

function attachHemisphericLightProjection(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  node: BabylonEditorProjectionNode,
  projection: ProjectedBabylonEditorNode,
): void {
  const MeshBuilder = (babylon as any).MeshBuilder;
  const StandardMaterial = (babylon as any).StandardMaterial;
  const HemisphericLight = (babylon as any).HemisphericLight;
  const Vector3 = requireBabylonCtor(babylon.Vector3, 'Vector3');
  const Color3 = requireBabylonCtor(babylon.Color3, 'Color3');
  if (!MeshBuilder || !StandardMaterial) return;
  const settings = readProjectionHemisphericLightSettings(
    node.light?.type === 'hemispheric' ? node.light : undefined,
  );

  if (HemisphericLight) {
    const light = new HemisphericLight(`${node.id}.hemisphericLight`, new Vector3(0, 1, 0), scene);
    light.intensity = settings.intensity;
    light.diffuse = new Color3(
      settings.diffuseColor?.r ?? 1,
      settings.diffuseColor?.g ?? 1,
      settings.diffuseColor?.b ?? 1,
    );
    light.groundColor = new Color3(
      settings.groundColor?.r ?? 0.48,
      settings.groundColor?.g ?? 0.52,
      settings.groundColor?.b ?? 0.62,
    );
    light.metadata = createProjectionMetadata(node.id, { runtimeKind: 'light', lightType: 'hemispheric' });
    light.setEnabled?.(node.active !== false);
    projection.runtimeObjects.push(light);
  }

  const helper = MeshBuilder.CreateSphere?.(`${node.id}.hemisphericLightHelper`, {
    diameter: 0.32,
    segments: 18,
  }, scene) ?? MeshBuilder.CreateBox?.(`${node.id}.hemisphericLightHelper`, {
    size: 0.28,
  }, scene);
  if (!helper) return;
  helper.parent = projection.root;
  helper.metadata = createProjectionMetadata(node.id, {
    runtimeKind: 'light',
    lightType: 'hemispheric',
    helper: 'body',
  });
  const material = new StandardMaterial(`${node.id}.hemisphericLightHelper.material`, scene);
  material.diffuseColor = new Color3(0.72, 0.82, 1);
  material.emissiveColor = new Color3(0.16, 0.28, 0.48);
  material.specularColor = new Color3(0.08, 0.1, 0.12);
  helper.material = material;
  projection.runtimeObjects.push(material);
  projection.outlineMeshes = [helper];
}

export function normalizeBabylonEditorProjectionCameraSettings(
  settings: BabylonEditorProjectionCameraSettings | undefined,
): BabylonEditorProjectionCameraSettings {
  return {
    projection: readProjectionCameraMode(settings?.projection),
    alpha: readFiniteNumber(settings?.alpha, 3.9269908169872414),
    beta: readFiniteNumber(settings?.beta, 0.8),
    radius: Math.max(0.001, readFiniteNumber(settings?.radius, 14)),
    orthoSize: Math.max(0.001, readFiniteNumber(settings?.orthoSize, 6)),
    fov: Math.max(0.001, readFiniteNumber(settings?.fov, 0.85)),
  };
}

export function applyBabylonEditorProjectionCameraRig(
  babylon: BabylonRuntimeGlobal,
  scene: RuntimeScene,
  camera: RuntimeCamera,
  settings: BabylonEditorProjectionCameraSettings | undefined,
  options: BabylonEditorProjectionCameraRigApplyOptions = {},
): BabylonEditorProjectionCameraSettings {
  const normalized = normalizeBabylonEditorProjectionCameraSettings(settings);
  const Vector3 = babylon.Vector3;
  const target = options.target && Vector3
    ? new Vector3(options.target.x, options.target.y, options.target.z)
    : null;

  if (typeof camera.alpha === 'number') {
    clearBabylonArcRotateCameraOrbitLimits(camera);
    if (target) camera.target = target;
    camera.alpha = normalized.alpha;
    camera.beta = normalized.beta;
    camera.radius = normalized.radius;
    if (options.lockOrbit !== false) {
      camera.lowerAlphaLimit = normalized.alpha;
      camera.upperAlphaLimit = normalized.alpha;
      camera.lowerBetaLimit = normalized.beta;
      camera.upperBetaLimit = normalized.beta;
      camera.lowerRadiusLimit = normalized.radius;
      camera.upperRadiusLimit = normalized.radius;
    }
  } else if (target) {
    camera.setTarget?.(target);
  }

  if (normalized.projection === 'perspective') {
    camera.mode = babylon.Camera?.PERSPECTIVE_CAMERA ?? camera.mode ?? 0;
    camera.fov = normalized.fov ?? 0.85;
    return normalized;
  }

  camera.mode = babylon.Camera?.ORTHOGRAPHIC_CAMERA ?? camera.mode ?? 1;
  const aspect = readProjectionSceneAspect(scene);
  const halfHeight = normalized.orthoSize;
  const halfWidth = halfHeight * aspect;
  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  return normalized;
}

function clearBabylonArcRotateCameraOrbitLimits(camera: RuntimeCamera): void {
  camera.lowerAlphaLimit = null;
  camera.upperAlphaLimit = null;
  camera.lowerBetaLimit = null;
  camera.upperBetaLimit = null;
  camera.lowerRadiusLimit = null;
  camera.upperRadiusLimit = null;
}

function readProjectionCameraMode(value: unknown): BabylonEditorProjectionCameraMode {
  return value === 'perspective' ? 'perspective' : 'orthographic';
}

function readProjectionSceneAspect(scene: RuntimeScene): number {
  const engine = scene.getEngine?.();
  const width = Number(engine?.getRenderWidth?.() ?? engine?.getRenderingCanvas?.()?.width ?? 1);
  const height = Number(engine?.getRenderHeight?.() ?? engine?.getRenderingCanvas?.()?.height ?? 1);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 16 / 9;
  return Math.max(0.01, width / height);
}

function readProjectionDirectionalLightSettings(
  settings: BabylonEditorProjectionDirectionalLightSettings | undefined,
): BabylonEditorProjectionDirectionalLightSettings {
  return {
    type: 'directional',
    intensity: Math.max(0, readFiniteNumber(settings?.intensity, 2)),
    direction: readVector3(settings?.direction, { x: -0.3, y: -1, z: -0.2 }),
    diffuseColor: readProjectionColor(settings?.diffuseColor, { r: 1, g: 1, b: 1 }),
  };
}

function readProjectionHemisphericLightSettings(
  settings: BabylonEditorProjectionHemisphericLightSettings | undefined,
): BabylonEditorProjectionHemisphericLightSettings {
  return {
    type: 'hemispheric',
    intensity: Math.max(0, readFiniteNumber(settings?.intensity, 0.8)),
    diffuseColor: readProjectionColor(settings?.diffuseColor, { r: 1, g: 1, b: 1 }),
    groundColor: readProjectionColor(settings?.groundColor, { r: 0.48, g: 0.52, b: 0.62 }),
  };
}

function readProjectionColor(
  value: BabylonEditorProjectionColorRGB | undefined,
  fallback: BabylonEditorProjectionColorRGB,
): BabylonEditorProjectionColorRGB {
  return {
    r: readFiniteNumber(value?.r, fallback.r),
    g: readFiniteNumber(value?.g, fallback.g),
    b: readFiniteNumber(value?.b, fallback.b),
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeProjectionVec3(
  value: BabylonEditorProjectionVec3,
  fallback: BabylonEditorProjectionVec3,
): BabylonEditorProjectionVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 0.000001) return normalizeProjectionVec3(fallback, { x: 0, y: -1, z: 0 });
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
}

function createProjectionMetadata(
  nodeId: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    editorProjection: {
      nodeId,
      ...extra,
    },
  };
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
  const Color4 = babylon.Color4;
  const selectedIds = new Set(selection.selectedIds);
  for (const [nodeId, projection] of projections) {
    const selected = selectedIds.has(nodeId);
    const active = selection.activeId === nodeId;
    for (const mesh of projection.outlineMeshes) {
      syncProjectionMeshSelection(mesh, selected, active, Color4);
    }
  }
}

function syncProjectionMeshSelection(
  mesh: any,
  selected: boolean,
  active: boolean,
  Color4?: new (r: number, g: number, b: number, a: number) => any,
): void {
  mesh.renderOutline = false;
  mesh.outlineWidth = 0;
  if (!selected) {
    mesh.disableEdgesRendering?.();
    return;
  }
  mesh.enableEdgesRendering?.(0.997);
  mesh.edgesWidth = active ? 5 : 3.5;
  if (Color4) {
    mesh.edgesColor = active
      ? new Color4(1, 0.9, 0.22, 1)
      : new Color4(0.35, 0.65, 1, 1);
  }
}
