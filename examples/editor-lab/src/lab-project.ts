import type {
  LocalEditorHarnessDocumentAdapter,
  LocalEditorHarnessDuplicateSelectionInput,
  LocalEditorHarnessDuplicateSelectionPatch,
  LocalEditorHarnessMultiPropertyInput,
  LocalEditorHarnessPatchResult,
  LocalEditorHarnessPropertyInput,
  LocalEditorHarnessSceneGraphCreateGroupPatch,
  LocalEditorHarnessSceneGraphDeletePatch,
  LocalEditorHarnessSceneGraphDropPatch,
  LocalEditorHarnessSceneGraphGroupSelectionPatch,
  LocalEditorHarnessSceneGraphMovePatch,
  LocalEditorHarnessSceneGraphRenamePatch,
  LocalEditorHarnessTransformBatchInput,
  LocalEditorHarnessTransformInput,
  LocalEditorHarnessWorldAdapter,
  LocalEditorHarnessAssetItem,
} from '@fps-games/editor';
import {
  createProjectAuthoringHost,
  type AuthoringDiagnostic,
  type AuthoringSourceDescriptor,
  type AuthoringSourceDriver,
  type AuthoringSourceSaveResult,
  type CompiledArtifact,
  type DocumentCommand,
  type EditorTransformSnapshot,
  type InspectorEnumOption,
  type InspectorObject,
  type InspectorProperty,
  type InspectorSection,
  type ProjectAuthoringHost,
  type SceneGraphCreateGroupIntent,
  type SceneGraphDeleteIntent,
  type SceneGraphDropIntent,
  type SceneGraphGroupSelectionIntent,
  type SceneGraphMoveIntent,
  type SceneGraphTreeItem,
  type SceneGraphValidationResult,
  type SerializedMultiObject,
  type SerializedObject,
  composeEditorTransformChain,
  createIdentityEditorTransform,
  getTopLevelSceneGraphNodeIds,
  toEditorLocalTransformFromWorld,
  validateSceneGraphDrop,
  validateSceneGraphGroupSelection,
  validateSceneGraphMove,
} from '@fps-games/editor-core';
import type {
  BabylonEditorProjectionImportContext,
  BabylonEditorProjectionImportResult,
  BabylonEditorProjectionNode,
} from '@fps-games/editor-babylon';
import { createBabylonEditorInfiniteGrid } from '@fps-games/editor-babylon';

export interface LabVec3 {
  x: number;
  y: number;
  z: number;
}

export interface LabColor {
  r: number;
  g: number;
  b: number;
}

export interface LabTransform {
  position: LabVec3;
  rotation: LabVec3;
  scale: LabVec3;
}

export type LabAssetKind = 'box' | 'sphere' | 'cylinder';

export interface LabAsset extends LocalEditorHarnessAssetItem {
  kind: LabAssetKind;
  color: string;
}

export interface LabGameObject {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
  kind: 'root' | 'group' | 'mesh';
  transform: LabTransform;
  assetId?: string;
  tint?: LabColor;
}

export interface LabSceneDocument {
  schemaVersion: 1;
  scene: {
    gameObjects: LabGameObject[];
  };
  assets: LabAsset[];
}

export type LabScenePatch =
  | { kind: 'game-object.rename'; id: string; name: string }
  | { kind: 'game-object.create-group'; id: string; parentId: string | null; name: string }
  | { kind: 'game-object.delete-subtree'; ids: string[] }
  | { kind: 'game-object.reparent'; id: string; parentId: string | null; transform?: LabTransform }
  | { kind: 'game-object.active'; id: string; active: boolean }
  | { kind: 'game-object.asset'; id: string; assetId: string }
  | { kind: 'game-object.tint'; id: string; tint: LabColor }
  | {
    kind: 'game-object.hierarchy-move';
    moves: Array<{ id: string; parentId: string | null; transform: LabTransform }>;
    order: string[];
  }
  | {
    kind: 'game-object.group-selection';
    gameObject: LabGameObject;
    childIds: string[];
    childTransforms: Record<string, LabTransform>;
    order: string[];
  }
  | { kind: 'game-object.transform'; id: string; transform: Partial<LabTransform> }
  | { kind: 'game-object.transform-batch'; transforms: Record<string, Partial<LabTransform>> }
  | { kind: 'game-object.duplicate-selection'; gameObjects: LabGameObject[] }
  | { kind: 'game-object.create-from-asset'; id: string; assetId: string; parentId: string | null; name: string; transform: LabTransform };

export interface LabProjectStore {
  load(): { source: AuthoringSourceDescriptor; document: LabSceneDocument };
  save(document: LabSceneDocument): AuthoringSourceSaveResult<LabSceneDocument>;
  getRevision(): number;
  getSavedDocument(): LabSceneDocument;
  failNextSave(message?: string): void;
}

const LAB_SOURCE_ID = 'lab.scene';
const LAB_SOURCE_TYPE = 'scene';
const LAB_ROOT_ID = 'lab_root';
const LAB_DEFAULT_ASSETS: readonly LabAsset[] = [
  { id: 'asset_box', label: 'Box', meta: 'primitive', kind: 'box', color: '#2f73e6' },
  { id: 'asset_sphere', label: 'Sphere', meta: 'primitive', kind: 'sphere', color: '#33c875' },
  { id: 'asset_marker', label: 'Marker', meta: 'primitive', kind: 'cylinder', color: '#efb338' },
];

export function createLabSceneDocument(): LabSceneDocument {
  return {
    schemaVersion: 1,
    assets: LAB_DEFAULT_ASSETS.map(asset => ({ ...asset })),
    scene: {
      gameObjects: [
        createLabGameObject({
          id: LAB_ROOT_ID,
          name: 'Lab Root',
          parentId: null,
          kind: 'root',
        }),
        createLabGameObject({
          id: 'lab_group_01',
          name: 'Starter Group',
          parentId: LAB_ROOT_ID,
          kind: 'group',
          position: { x: 0, y: 0, z: 0 },
        }),
        createLabGameObject({
          id: 'lab_box_01',
          name: 'Blue Box',
          parentId: 'lab_group_01',
          kind: 'mesh',
          assetId: 'asset_box',
          position: { x: -1.4, y: 0.5, z: 0 },
        }),
        createLabGameObject({
          id: 'lab_sphere_01',
          name: 'Green Sphere',
          parentId: LAB_ROOT_ID,
          kind: 'mesh',
          assetId: 'asset_sphere',
          position: { x: 1.3, y: 0.55, z: 0.3 },
        }),
      ],
    },
  };
}

export function createLabProjectStore(initialDocument: LabSceneDocument = createLabSceneDocument()): LabProjectStore {
  let document = cloneLabDocument(initialDocument);
  let revision = 1;
  let nextSaveError: string | null = null;

  return {
    load() {
      return {
        source: createLabSourceDescriptor(revision),
        document: cloneLabDocument(document),
      };
    },
    save(nextDocument) {
      if (nextSaveError) {
        const message = nextSaveError;
        nextSaveError = null;
        throw new Error(message);
      }
      revision += 1;
      document = cloneLabDocument(nextDocument);
      return {
        source: createLabSourceDescriptor(revision),
        document: cloneLabDocument(document),
        summary: summarizeLabScene(document),
      };
    },
    getRevision() {
      return revision;
    },
    getSavedDocument() {
      return cloneLabDocument(document);
    },
    failNextSave(message = 'lab save failed') {
      nextSaveError = message;
    },
  };
}

export function createLabSourceDriver(store: LabProjectStore): AuthoringSourceDriver<LabSceneDocument> {
  return {
    sourceType: LAB_SOURCE_TYPE,
    load() {
      const loaded = store.load();
      return {
        source: loaded.source,
        document: loaded.document,
        summary: summarizeLabScene(loaded.document),
      };
    },
    validate({ source, document }) {
      return validateLabSceneDocument(document, source);
    },
    save({ document }) {
      return store.save(document);
    },
    compile({ source, document }) {
      return [compileLabRuntimeArtifact(source, document)];
    },
  };
}

export function createLabAuthoringHost(store: LabProjectStore): ProjectAuthoringHost {
  return createProjectAuthoringHost({
    drivers: [createLabSourceDriver(store)],
  });
}

export function createLabDocumentAdapter(): LocalEditorHarnessDocumentAdapter<LabSceneDocument, LabScenePatch, LabAsset> {
  return {
    cloneDocument: cloneLabDocument,
    compareDocuments: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    prepareDocument: document => cloneLabDocument(document),
    reduceDocument: reduceLabSceneDocument,
    getSerializedObject: getLabSerializedObject,
    getSerializedMultiObject: getLabSerializedMultiObject,
    getInspectorObject: getLabInspectorObject,
    getInspectorMultiObject: getLabInspectorMultiObject,
    getHierarchyItems: getLabHierarchyItems,
    getProjectionNodes: getLabProjectionNodes,
    getProjectionNode(document, id) {
      const gameObject = findLabGameObject(document, id);
      return gameObject ? toLabProjectionNode(gameObject) : null;
    },
    isSelectable: (_document, id) => id !== LAB_ROOT_ID,
    isLocked: (_document, id) => id === LAB_ROOT_ID,
    createPatchFromAsset(asset) {
      const id = createNextObjectId(asset.id);
      return {
        label: `Add ${asset.label}`,
        patch: {
          kind: 'game-object.create-from-asset',
          id,
          assetId: asset.id,
          parentId: LAB_ROOT_ID,
          name: asset.label,
          transform: createLabTransform({ x: 0, y: 0.5, z: 0 }),
        },
      };
    },
    createPlacedAssetPatch({ asset, hit }) {
      const id = createNextObjectId(asset.id);
      return {
        label: `Place ${asset.label}`,
        patch: {
          kind: 'game-object.create-from-asset',
          id,
          assetId: asset.id,
          parentId: LAB_ROOT_ID,
          name: asset.label,
          transform: createLabTransform({ ...hit.position }),
        },
        createdId: id,
        changedIds: [id],
      };
    },
    findCreatedId(beforeDocument, afterDocument) {
      const beforeIds = new Set(beforeDocument.scene.gameObjects.map(gameObject => gameObject.id));
      return afterDocument.scene.gameObjects.find(gameObject => !beforeIds.has(gameObject.id))?.id ?? null;
    },
    createSerializedPropertyPatch: createLabSerializedPropertyPatch,
    createSerializedMultiPropertyPatch: createLabSerializedMultiPropertyPatch,
    createTransformPatch: createLabTransformPatch,
    createTransformBatchPatch: createLabTransformBatchPatch,
    createDuplicateSelectionPatch: createLabDuplicateSelectionPatch,
    validateSceneGraphDrop: validateLabSceneGraphDrop,
    validateSceneGraphMove: validateLabSceneGraphMove,
    validateSceneGraphGroupSelection: validateLabSceneGraphGroupSelection,
    createSceneGraphRenamePatch: createLabSceneGraphRenamePatch,
    createSceneGraphCreateGroupPatch: createLabSceneGraphCreateGroupPatch,
    createSceneGraphDeletePatch: createLabSceneGraphDeletePatch,
    createSceneGraphDropPatch: createLabSceneGraphDropPatch,
    createSceneGraphMovePatch: createLabSceneGraphMovePatch,
    createSceneGraphGroupSelectionPatch: createLabSceneGraphGroupSelectionPatch,
    summarize: summarizeLabScene,
  };
}

export function createLabWorldAdapter(canvasId = 'editor-lab-canvas'): LocalEditorHarnessWorldAdapter<LabAsset> {
  return {
    disposeGameWorld() {
      document.body.dataset.editorLabGameDisposed = 'true';
    },
    getCanvas() {
      return document.getElementById(canvasId) instanceof HTMLCanvasElement
        ? document.getElementById(canvasId) as HTMLCanvasElement
        : null;
    },
    loadBabylon: () => import('@babylonjs/core') as Promise<any>,
    createEngine(babylon, canvas) {
      return new babylon.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
      });
    },
    async importProjectionModel(context: BabylonEditorProjectionImportContext): Promise<BabylonEditorProjectionImportResult | null> {
      const mesh = attachLabPrimitiveProjection(context);
      return mesh ? { meshes: [mesh], transformNodes: [] } : null;
    },
    resolveAssetId: asset => asset.id,
    toBrowserAssetItem(asset) {
      return {
        id: asset.id,
        label: asset.label,
        meta: `${asset.kind} ${asset.meta ?? ''}`.trim(),
        disabled: asset.placeable === false,
      };
    },
  };
}

export function createLabGrid(babylon: any, scene: any) {
  return createBabylonEditorInfiniteGrid({
    babylon,
    scene,
    name: 'lab-editor-grid',
    halfLineCount: 64,
  });
}

export function reduceLabSceneDocument(
  document: LabSceneDocument,
  command: DocumentCommand<LabSceneDocument, LabScenePatch>,
): LabSceneDocument {
  if (command.type === 'document.replace') return cloneLabDocument(command.document);
  if (command.type !== 'document.patch') return document;
  const patch = command.patch;

  if (patch.kind === 'game-object.rename') {
    return mapLabGameObjects(document, gameObject => (
      gameObject.id === patch.id ? { ...gameObject, name: patch.name } : gameObject
    ));
  }

  if (patch.kind === 'game-object.create-group') {
    return {
      ...document,
      scene: {
        gameObjects: [
          ...document.scene.gameObjects,
          createLabGameObject({
            id: patch.id,
            name: patch.name,
            parentId: patch.parentId,
            kind: 'group',
          }),
        ],
      },
    };
  }

  if (patch.kind === 'game-object.delete-subtree') {
    const deleteIds = collectLabSubtreeIds(document, patch.ids);
    return {
      ...document,
      scene: {
        gameObjects: document.scene.gameObjects.filter(gameObject => !deleteIds.has(gameObject.id)),
      },
    };
  }

  if (patch.kind === 'game-object.reparent') {
    return mapLabGameObjects(document, gameObject => (
      gameObject.id === patch.id
        ? {
            ...gameObject,
            parentId: patch.parentId,
            transform: patch.transform ? cloneLabTransform(patch.transform) : gameObject.transform,
          }
        : gameObject
    ));
  }

  if (patch.kind === 'game-object.active') {
    return mapLabGameObjects(document, gameObject => (
      gameObject.id === patch.id ? { ...gameObject, active: patch.active } : gameObject
    ));
  }

  if (patch.kind === 'game-object.asset') {
    return mapLabGameObjects(document, gameObject => (
      gameObject.id === patch.id && gameObject.kind === 'mesh'
        ? { ...gameObject, assetId: patch.assetId }
        : gameObject
    ));
  }

  if (patch.kind === 'game-object.tint') {
    return mapLabGameObjects(document, gameObject => (
      gameObject.id === patch.id && gameObject.kind === 'mesh'
        ? { ...gameObject, tint: patch.tint }
        : gameObject
    ));
  }

  if (patch.kind === 'game-object.hierarchy-move') {
    const moves = new Map(patch.moves.map(move => [move.id, move]));
    const updated = document.scene.gameObjects.map((gameObject) => {
      const move = moves.get(gameObject.id);
      return move
        ? {
            ...gameObject,
            parentId: move.parentId,
            transform: cloneLabTransform(move.transform),
          }
        : gameObject;
    });
    return {
      ...document,
      scene: {
        gameObjects: orderLabGameObjects(updated, patch.order),
      },
    };
  }

  if (patch.kind === 'game-object.group-selection') {
    if (findLabGameObject(document, patch.gameObject.id)) return document;
    const childIds = new Set(patch.childIds);
    const updated = document.scene.gameObjects.map((gameObject) => (
      childIds.has(gameObject.id)
        ? {
            ...gameObject,
            parentId: patch.gameObject.id,
            transform: cloneLabTransform(patch.childTransforms[gameObject.id] ?? gameObject.transform),
          }
        : gameObject
    ));
    return {
      ...document,
      scene: {
        gameObjects: orderLabGameObjects([...updated, patch.gameObject], patch.order),
      },
    };
  }

  if (patch.kind === 'game-object.transform') {
    return mapLabGameObjects(document, gameObject => (
      gameObject.id === patch.id
        ? {
            ...gameObject,
            transform: {
              position: patch.transform.position ?? gameObject.transform.position,
              rotation: patch.transform.rotation ?? gameObject.transform.rotation,
              scale: patch.transform.scale ?? gameObject.transform.scale,
            },
          }
        : gameObject
    ));
  }

  if (patch.kind === 'game-object.transform-batch') {
    return mapLabGameObjects(document, gameObject => {
      const transform = patch.transforms[gameObject.id];
      return transform
        ? {
            ...gameObject,
            transform: {
              position: transform.position ?? gameObject.transform.position,
              rotation: transform.rotation ?? gameObject.transform.rotation,
              scale: transform.scale ?? gameObject.transform.scale,
            },
          }
        : gameObject;
    });
  }

  if (patch.kind === 'game-object.duplicate-selection') {
    const existingIds = new Set(document.scene.gameObjects.map(gameObject => gameObject.id));
    const gameObjects = patch.gameObjects.filter(gameObject => !existingIds.has(gameObject.id));
    if (gameObjects.length === 0) return document;
    return {
      ...document,
      scene: {
        gameObjects: [
          ...document.scene.gameObjects,
          ...gameObjects,
        ],
      },
    };
  }

  if (patch.kind === 'game-object.create-from-asset') {
    return {
      ...document,
      scene: {
        gameObjects: [
          ...document.scene.gameObjects,
          createLabGameObject({
            id: patch.id,
            name: patch.name,
            parentId: patch.parentId,
            kind: 'mesh',
            assetId: patch.assetId,
            position: patch.transform.position,
            rotation: patch.transform.rotation,
            scale: patch.transform.scale,
          }),
        ],
      },
    };
  }

  return document;
}

export function getLabHierarchyItems(document: LabSceneDocument): SceneGraphTreeItem[] {
  return document.scene.gameObjects.map(gameObject => ({
    id: gameObject.id,
    label: gameObject.name,
    parentId: gameObject.parentId,
    depth: getLabGameObjectDepth(document, gameObject),
    role: gameObject.id === LAB_ROOT_ID ? 'root' : 'object',
    selectable: gameObject.id !== LAB_ROOT_ID,
    locked: gameObject.id === LAB_ROOT_ID,
    protected: gameObject.id === LAB_ROOT_ID,
    canHaveChildren: canLabGameObjectHaveChildren(document, gameObject.id),
    renamable: gameObject.id !== LAB_ROOT_ID,
    deletable: gameObject.id !== LAB_ROOT_ID,
    draggable: gameObject.id !== LAB_ROOT_ID,
  }));
}

export function getLabProjectionNodes(document: LabSceneDocument): BabylonEditorProjectionNode[] {
  return document.scene.gameObjects.map(toLabProjectionNode);
}

export function findLabGameObject(document: LabSceneDocument, id: string): LabGameObject | null {
  return document.scene.gameObjects.find(gameObject => gameObject.id === id) ?? null;
}

export function collectLabSubtreeIds(document: LabSceneDocument, ids: string[]): Set<string> {
  const result = new Set(ids.filter(id => id !== LAB_ROOT_ID));
  let changed = true;
  while (changed) {
    changed = false;
    for (const gameObject of document.scene.gameObjects) {
      if (gameObject.parentId && result.has(gameObject.parentId) && !result.has(gameObject.id)) {
        result.add(gameObject.id);
        changed = true;
      }
    }
  }
  return result;
}

export function cloneLabDocument(document: LabSceneDocument): LabSceneDocument {
  return typeof structuredClone === 'function'
    ? structuredClone(document)
    : JSON.parse(JSON.stringify(document)) as LabSceneDocument;
}

function createLabSourceDescriptor(revision: number): AuthoringSourceDescriptor {
  return {
    ref: {
      sourceId: LAB_SOURCE_ID,
      sourceType: LAB_SOURCE_TYPE,
      revision,
    },
    filePath: 'examples/editor-lab/in-memory-scene.json',
    schemaVersion: 1,
    capabilities: {
      editable: true,
      compilable: true,
      runtimeApply: false,
    },
  };
}

function validateLabSceneDocument(
  document: LabSceneDocument,
  source: AuthoringSourceDescriptor,
): AuthoringDiagnostic[] {
  const diagnostics: AuthoringDiagnostic[] = [];
  if (document.schemaVersion !== 1) {
    diagnostics.push({
      severity: 'error',
      message: 'lab scene schemaVersion must be 1',
      path: 'schemaVersion',
      source: source.ref,
    });
  }
  const ids = new Set<string>();
  for (const gameObject of document.scene.gameObjects ?? []) {
    if (ids.has(gameObject.id)) {
      diagnostics.push({
        severity: 'error',
        message: `duplicate gameObject id "${gameObject.id}"`,
        path: 'scene.gameObjects',
        source: source.ref,
      });
    }
    ids.add(gameObject.id);
  }
  if (!ids.has(LAB_ROOT_ID)) {
    diagnostics.push({
      severity: 'error',
      message: 'lab scene must contain lab_root',
      path: 'scene.gameObjects',
      source: source.ref,
    });
  }
  return diagnostics;
}

function compileLabRuntimeArtifact(source: AuthoringSourceDescriptor, document: LabSceneDocument): CompiledArtifact {
  return {
    artifactType: 'lab-runtime-scene',
    artifactId: 'lab-runtime-scene.json',
    provenance: {
      sourceId: source.ref.sourceId,
      sourceType: source.ref.sourceType,
      revision: source.ref.revision,
      compilerId: 'editor-lab',
      compilerVersion: 1,
      compiledAt: new Date(0).toISOString(),
    },
    summary: summarizeLabScene(document),
    data: {
      objects: document.scene.gameObjects.map(gameObject => ({
        id: gameObject.id,
        name: gameObject.name,
        parentId: gameObject.parentId,
        assetId: gameObject.assetId ?? null,
        transform: gameObject.transform,
      })),
    },
  };
}

function createLabSceneGraphRenamePatch(
  _document: LabSceneDocument,
  intent: { id: string; name: string },
): LocalEditorHarnessSceneGraphRenamePatch<LabScenePatch> | null {
  if (!intent.name.trim() || intent.id === LAB_ROOT_ID) return null;
  return {
    patch: { kind: 'game-object.rename', id: intent.id, name: intent.name.trim() },
    label: `Rename ${intent.id}`,
    changedId: intent.id,
  };
}

function createLabSceneGraphCreateGroupPatch(
  document: LabSceneDocument,
  intent: SceneGraphCreateGroupIntent,
): LocalEditorHarnessSceneGraphCreateGroupPatch<LabScenePatch> | null {
  const parentId = resolveLabCreateGroupParentId(document, intent);
  if (parentId === undefined) return null;
  const id = createNextGroupId(document);
  return {
    patch: {
      kind: 'game-object.create-group',
      id,
      parentId,
      name: intent.name?.trim() || 'Empty',
    },
    label: 'Create Empty',
    createdId: id,
  };
}

function createLabSceneGraphDeletePatch(
  document: LabSceneDocument,
  intent: SceneGraphDeleteIntent,
): LocalEditorHarnessSceneGraphDeletePatch<LabScenePatch> | null {
  const ids = [...collectLabSubtreeIds(document, intent.ids)];
  if (ids.length === 0) return null;
  return {
    patch: { kind: 'game-object.delete-subtree', ids },
    label: `Delete ${ids.length} object${ids.length === 1 ? '' : 's'}`,
    deletedIds: ids,
    fallbackSelectionId: LAB_ROOT_ID,
  };
}

function createLabSceneGraphDropPatch(
  document: LabSceneDocument,
  intent: SceneGraphDropIntent,
): LocalEditorHarnessSceneGraphDropPatch<LabScenePatch> | null {
  const validation = validateLabSceneGraphDrop(document, intent);
  if (!validation.ok || intent.placement !== 'inside') return null;
  const dragged = findLabGameObject(document, intent.draggedId);
  if (!dragged) return null;
  const transform = intent.preserveWorldTransform === false
    ? cloneLabTransform(dragged.transform)
    : computeLabLocalTransformForParent(document, intent.draggedId, intent.targetId);
  if (!transform) return null;
  return {
    patch: {
      kind: 'game-object.reparent',
      id: intent.draggedId,
      parentId: intent.targetId,
      transform,
    },
    label: `Reparent ${intent.draggedId}`,
    changedIds: [intent.draggedId],
  };
}

function validateLabSceneGraphDrop(
  document: LabSceneDocument,
  intent: SceneGraphDropIntent,
): SceneGraphValidationResult {
  const validation = validateSceneGraphDrop(getLabHierarchyItems(document), intent);
  if (!validation.ok) return validation;
  if (intent.placement !== 'inside') return { ok: false, reason: 'Only inside reparent is supported.' };
  const dragged = findLabGameObject(document, intent.draggedId);
  if (!dragged) return { ok: false, reason: `GameObject not found: ${intent.draggedId}` };
  if (intent.preserveWorldTransform !== false && !computeLabLocalTransformForParent(document, intent.draggedId, intent.targetId)) {
    return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
  }
  return { ok: true };
}

function validateLabSceneGraphMove(
  document: LabSceneDocument,
  intent: SceneGraphMoveIntent,
): SceneGraphValidationResult {
  const hierarchy = getLabHierarchyItems(document);
  const validation = validateSceneGraphMove(hierarchy, intent);
  if (!validation.ok) return validation;
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  const parentId = resolveLabMoveParentId(document, intent);
  if (parentId !== null && !canLabGameObjectHaveChildren(document, parentId)) {
    return { ok: false, reason: `${parentId} cannot have children.` };
  }
  if (intent.preserveWorldTransform !== false) {
    for (const id of ids) {
      const gameObject = findLabGameObject(document, id);
      if (!gameObject) return { ok: false, reason: `GameObject not found: ${id}` };
      if (!computeLabLocalTransformForParent(document, id, parentId)) {
        return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
      }
    }
  }
  return { ok: true };
}

function createLabSceneGraphMovePatch(
  document: LabSceneDocument,
  intent: SceneGraphMoveIntent,
): LocalEditorHarnessSceneGraphMovePatch<LabScenePatch> | null {
  const validation = validateLabSceneGraphMove(document, intent);
  if (!validation.ok) return null;
  const hierarchy = getLabHierarchyItems(document);
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  const parentId = resolveLabMoveParentId(document, intent);
  const moves = ids
    .map((id) => {
      const gameObject = findLabGameObject(document, id);
      if (!gameObject) return null;
      const transform = intent.preserveWorldTransform === false
        ? cloneLabTransform(gameObject.transform)
        : computeLabLocalTransformForParent(document, id, parentId);
      return transform ? { id, parentId, transform } : null;
    })
    .filter((move): move is { id: string; parentId: string | null; transform: LabTransform } => !!move);
  if (moves.length !== ids.length) return null;
  const order = createLabMoveOrder(document, ids, intent);
  const currentOrder = document.scene.gameObjects.map(gameObject => gameObject.id);
  const moved = moves.some((move) => {
    const gameObject = findLabGameObject(document, move.id);
    return !gameObject || gameObject.parentId !== move.parentId || !labTransformsEqual(gameObject.transform, move.transform);
  });
  if (!moved && arraysEqual(currentOrder, order)) return null;
  return {
    patch: {
      kind: 'game-object.hierarchy-move',
      moves,
      order,
    },
    label: `Move ${ids.length} object${ids.length === 1 ? '' : 's'}`,
    changedIds: ids,
  };
}

function validateLabSceneGraphGroupSelection(
  document: LabSceneDocument,
  intent: SceneGraphGroupSelectionIntent,
): SceneGraphValidationResult {
  const hierarchy = getLabHierarchyItems(document);
  const validation = validateSceneGraphGroupSelection(hierarchy, intent);
  if (!validation.ok) return validation;
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  const parentId = resolveLabGroupSelectionParentId(document, intent.parentId ?? null);
  if (parentId !== null && !canLabGameObjectHaveChildren(document, parentId)) {
    return { ok: false, reason: `${parentId} cannot have children.` };
  }
  if (intent.preserveWorldTransform !== false) {
    const center = computeLabSelectionWorldCenter(document, ids);
    const groupWorld = center ? createLabTransform(center) : null;
    if (!groupWorld || !toLabLocalTransformForParent(document, parentId, groupWorld)) {
      return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
    }
    for (const id of ids) {
      const gameObject = findLabGameObject(document, id);
      if (!gameObject) return { ok: false, reason: `GameObject not found: ${id}` };
      if (!getLabGameObjectWorldTransform(document, id)) {
        return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
      }
    }
  }
  return { ok: true };
}

function createLabSceneGraphGroupSelectionPatch(
  document: LabSceneDocument,
  intent: SceneGraphGroupSelectionIntent,
): LocalEditorHarnessSceneGraphGroupSelectionPatch<LabScenePatch> | null {
  const validation = validateLabSceneGraphGroupSelection(document, intent);
  if (!validation.ok) return null;
  const hierarchy = getLabHierarchyItems(document);
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  if (ids.length === 0) return null;
  const parentId = resolveLabGroupSelectionParentId(document, intent.parentId ?? null);
  const center = computeLabSelectionWorldCenter(document, ids);
  if (!center) return null;
  const groupWorld = createLabTransform(center);
  const groupLocal = toLabLocalTransformForParent(document, parentId, groupWorld);
  if (!groupLocal) return null;
  const id = createNextGroupId(document);
  const gameObject = createLabGameObject({
    id,
    name: intent.name?.trim() || 'Parent',
    parentId,
    kind: 'group',
    position: groupLocal.position,
    rotation: groupLocal.rotation,
    scale: groupLocal.scale,
  });
  const childTransforms: Record<string, LabTransform> = {};
  for (const childId of ids) {
    const child = findLabGameObject(document, childId);
    if (!child) return null;
    if (intent.preserveWorldTransform === false) {
      childTransforms[childId] = cloneLabTransform(child.transform);
      continue;
    }
    const childWorld = getLabGameObjectWorldTransform(document, childId);
    if (!childWorld) return null;
    const childLocal = toLabLocalTransformFromParentWorld(groupWorld, childWorld);
    if (!childLocal) return null;
    childTransforms[childId] = childLocal;
  }
  const order = createLabGroupSelectionOrder(document, id, ids, intent.insertBeforeId ?? null);
  return {
    patch: {
      kind: 'game-object.group-selection',
      gameObject,
      childIds: ids,
      childTransforms,
      order,
    },
    label: `Parent ${ids.length} object${ids.length === 1 ? '' : 's'}`,
    createdId: id,
    changedIds: [id, ...ids],
  };
}

function createLabSerializedPropertyPatch(
  input: LocalEditorHarnessPropertyInput<LabSceneDocument>,
): LocalEditorHarnessPatchResult<LabScenePatch> | null {
  return createLabPropertyPatch(input.document, input.targetId, input.path, input.value);
}

function createLabSerializedMultiPropertyPatch(
  input: LocalEditorHarnessMultiPropertyInput<LabSceneDocument>,
): LocalEditorHarnessPatchResult<LabScenePatch> | null {
  const patches = input.targetIds
    .map(targetId => createLabPropertyPatch(input.document, targetId, input.path, input.value))
    .filter((patch): patch is LocalEditorHarnessPatchResult<LabScenePatch> & { changedId: string } => !!patch?.changedId);
  if (patches.length === 0) return null;
  if (patches.length === 1) return patches[0]!;
  if (!patches.every(patch => patch.patch.kind === 'game-object.transform')) return null;
  return {
    patch: {
      kind: 'game-object.transform-batch',
      transforms: Object.fromEntries(patches.map((patch) => [
        patch.changedId,
        (patch.patch as Extract<LabScenePatch, { kind: 'game-object.transform' }>).transform,
      ])),
    },
    label: `Edit ${input.path}`,
    changedIds: patches.map(patch => patch.changedId),
  };
}

function createLabTransformPatch(
  input: LocalEditorHarnessTransformInput<LabSceneDocument>,
): LocalEditorHarnessPatchResult<LabScenePatch> | null {
  return {
    patch: {
      kind: 'game-object.transform',
      id: input.targetId,
      transform: transformSnapshotToLabTransform(input.after),
    },
    label: `Transform ${input.targetId}`,
    changedId: input.targetId,
    changedIds: [input.targetId],
  };
}

function createLabTransformBatchPatch(
  input: LocalEditorHarnessTransformBatchInput<LabSceneDocument>,
): LocalEditorHarnessPatchResult<LabScenePatch> | null {
  const first = input.targets[0];
  if (!first) return null;
  return {
    patch: {
      kind: 'game-object.transform-batch',
      transforms: Object.fromEntries(
        input.targets.map(target => [target.id, transformSnapshotToLabTransform(target.after)]),
      ),
    },
    label: `Transform ${input.targetIds.length} objects`,
    changedIds: input.targetIds,
  };
}

function createLabDuplicateSelectionPatch(
  input: LocalEditorHarnessDuplicateSelectionInput<LabSceneDocument>,
): LocalEditorHarnessDuplicateSelectionPatch<LabScenePatch> | null {
  const idMap = new Map<string, string>();
  const usedIds = new Set(input.document.scene.gameObjects.map(gameObject => gameObject.id));
  for (const targetId of input.targetIds) {
    const source = findLabGameObject(input.document, targetId);
    if (!source || source.id === LAB_ROOT_ID) continue;
    const duplicateId = createDuplicateLabObjectId(usedIds, source.id);
    usedIds.add(duplicateId);
    idMap.set(source.id, duplicateId);
  }
  const gameObjects = input.targetIds
    .map(targetId => findLabGameObject(input.document, targetId))
    .filter((source): source is LabGameObject => !!source && idMap.has(source.id))
    .map((source) => {
      const duplicate = cloneLabGameObject(source);
      duplicate.id = idMap.get(source.id)!;
      duplicate.name = `${source.name} Copy`;
      if (duplicate.parentId && idMap.has(duplicate.parentId)) {
        duplicate.parentId = idMap.get(duplicate.parentId)!;
      }
      return duplicate;
    });
  if (gameObjects.length === 0) return null;
  const createdIds = gameObjects.map(gameObject => gameObject.id);
  const activeId = input.activeId && idMap.has(input.activeId)
    ? idMap.get(input.activeId)!
    : createdIds[createdIds.length - 1] ?? null;
  return {
    patch: {
      kind: 'game-object.duplicate-selection',
      gameObjects,
    },
    label: `Duplicate ${createdIds.length} object${createdIds.length === 1 ? '' : 's'}`,
    createdIds,
    activeId,
    changedIds: createdIds,
  };
}

function createLabPropertyPatch(
  document: LabSceneDocument,
  targetId: string,
  path: string,
  value: unknown,
): LocalEditorHarnessPatchResult<LabScenePatch> | null {
  const gameObject = findLabGameObject(document, targetId);
  if (!gameObject || gameObject.id === LAB_ROOT_ID) return null;
  if (path === 'gameObject.name' && typeof value === 'string') {
    return {
      patch: { kind: 'game-object.rename', id: targetId, name: value },
      label: `Rename ${targetId}`,
      changedId: targetId,
      changedIds: [targetId],
    };
  }
  if (path === 'gameObject.active' && typeof value === 'boolean') {
    return {
      patch: { kind: 'game-object.active', id: targetId, active: value },
      label: `Toggle ${targetId}`,
      changedId: targetId,
      changedIds: [targetId],
      reprojectIds: [targetId],
    };
  }
  if (path === 'renderer.assetId' && typeof value === 'string' && document.assets.some(asset => asset.id === value)) {
    return {
      patch: { kind: 'game-object.asset', id: targetId, assetId: value },
      label: `Change asset ${targetId}`,
      changedId: targetId,
      changedIds: [targetId],
      reprojectIds: [targetId],
    };
  }
  const tint = path === 'appearance.tint' ? normalizeLabColor(value) : null;
  if (tint) {
    return {
      patch: { kind: 'game-object.tint', id: targetId, tint },
      label: `Tint ${targetId}`,
      changedId: targetId,
      changedIds: [targetId],
      reprojectIds: [targetId],
    };
  }
  const match = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (!match || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const group = match[1] as keyof LabTransform;
  const axis = match[2] as keyof LabVec3;
  return {
    patch: {
      kind: 'game-object.transform',
      id: targetId,
      transform: {
        [group]: {
          ...gameObject.transform[group],
          [axis]: value,
        },
      },
    },
    label: `Edit ${path}`,
    changedId: targetId,
    changedIds: [targetId],
  };
}

function getLabSerializedObject(document: LabSceneDocument, targetId: string): SerializedObject<LabSceneDocument> | null {
  const gameObject = findLabGameObject(document, targetId);
  if (!gameObject) return null;
  return {
    targetId,
    label: gameObject.name,
    properties: createLabSerializedProperties(gameObject, false),
  };
}

function getLabSerializedMultiObject(
  document: LabSceneDocument,
  targetIds: string[],
  activeId: string | null,
): SerializedMultiObject<LabSceneDocument> | null {
  const gameObjects = targetIds
    .map(id => findLabGameObject(document, id))
    .filter((gameObject): gameObject is LabGameObject => !!gameObject && gameObject.id !== LAB_ROOT_ID);
  if (gameObjects.length === 0) return null;
  return {
    targetIds: gameObjects.map(gameObject => gameObject.id),
    activeId,
    label: `${gameObjects.length} objects`,
    properties: createLabSerializedProperties(gameObjects[0]!, true, gameObjects),
  };
}

function getLabInspectorObject(document: LabSceneDocument, targetId: string): InspectorObject<LabSceneDocument> | null {
  const gameObject = findLabGameObject(document, targetId);
  if (!gameObject) return null;
  return {
    targetIds: [targetId],
    activeId: targetId,
    label: gameObject.name,
    document,
    selection: {
      targetIds: [targetId],
      activeId: targetId,
      targetKind: gameObject.kind,
      document,
    },
    sections: createLabInspectorSections(document, gameObject, false),
  };
}

function getLabInspectorMultiObject(
  document: LabSceneDocument,
  targetIds: string[],
  activeId: string | null,
): InspectorObject<LabSceneDocument> | null {
  const gameObjects = targetIds
    .map(id => findLabGameObject(document, id))
    .filter((gameObject): gameObject is LabGameObject => !!gameObject && gameObject.id !== LAB_ROOT_ID);
  if (gameObjects.length === 0) return null;
  const activeGameObject = activeId
    ? gameObjects.find(gameObject => gameObject.id === activeId) ?? gameObjects[0]!
    : gameObjects[0]!;
  return {
    targetIds: gameObjects.map(gameObject => gameObject.id),
    activeId: activeGameObject.id,
    label: `${gameObjects.length} objects`,
    document,
    selection: {
      targetIds: gameObjects.map(gameObject => gameObject.id),
      activeId: activeGameObject.id,
      targetKind: gameObjects.every(gameObject => gameObject.kind === activeGameObject.kind) ? activeGameObject.kind : 'mixed',
      document,
    },
    sections: createLabInspectorSections(document, activeGameObject, true, gameObjects),
  };
}

function createLabInspectorSections(
  document: LabSceneDocument,
  gameObject: LabGameObject,
  multi: boolean,
  gameObjects: LabGameObject[] = [gameObject],
): InspectorSection<LabSceneDocument>[] {
  const readonly = gameObject.id === LAB_ROOT_ID;
  const sections: InspectorSection<LabSceneDocument>[] = [
    {
      id: 'common',
      title: 'Common',
      order: 0,
      placement: 'body',
      persistence: readonly ? 'readonly' : 'document',
      properties: [
        createLabInspectorProperty(gameObjects, 'gameObject.name', 'Name', gameObject.name, 'string', 'string', {
          readOnly: readonly || multi,
          commitMode: 'blur',
        }),
        createLabInspectorProperty(gameObjects, 'gameObject.id', 'ID', gameObject.id, 'string', 'readonly', {
          readOnly: true,
          persistence: 'readonly',
        }),
        createLabInspectorProperty(gameObjects, 'gameObject.active', 'Active', gameObject.active, 'boolean', 'boolean', {
          readOnly: readonly,
          commitMode: 'immediate',
        }),
      ],
    },
    {
      id: 'transform',
      title: 'Transform',
      order: 10,
      placement: 'body',
      persistence: readonly ? 'readonly' : 'document',
      properties: createLabTransformInspectorProperties(gameObject, gameObjects, readonly),
    },
  ];
  if (gameObjects.every(candidate => candidate.kind === 'mesh')) {
    sections.push({
      id: 'renderer',
      title: 'Renderer / Asset',
      order: 20,
      placement: 'body',
      persistence: 'document',
      properties: [
        createLabInspectorProperty(gameObjects, 'renderer.assetId', 'Asset', gameObject.assetId ?? '', 'enum', 'enum', {
          options: document.assets.map(asset => ({ label: asset.label, value: asset.id })),
          commitMode: 'immediate',
          validate: value => typeof value === 'string' && document.assets.some(asset => asset.id === value)
            ? { ok: true, value }
            : { ok: false, message: 'Unknown asset.' },
        }),
      ],
    }, {
      id: 'appearance',
      title: 'Appearance',
      order: 30,
      placement: 'body',
      persistence: 'document',
      properties: [
        createLabInspectorProperty(gameObjects, 'appearance.tint', 'Tint', readLabTint(gameObject), 'color', 'color', {
          coerce: normalizeLabColor,
          validate: value => normalizeLabColor(value)
            ? { ok: true, value: normalizeLabColor(value)! }
            : { ok: false, message: 'Expected an RGB color.' },
        }),
      ],
    });
  }
  return sections;
}

function createLabTransformInspectorProperties(
  gameObject: LabGameObject,
  gameObjects: LabGameObject[],
  readOnly: boolean,
): InspectorProperty<LabSceneDocument>[] {
  const properties: InspectorProperty<LabSceneDocument>[] = [];
  for (const group of ['position', 'rotation', 'scale'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      properties.push(createLabInspectorProperty(
        gameObjects,
        `transform.${group}.${axis}`,
        axis.toUpperCase(),
        gameObject.transform[group][axis],
        'number',
        'number',
        {
          readOnly,
          order: properties.length,
          step: group === 'rotation' ? 1 : 0.1,
          commitMode: 'live',
        },
      ));
    }
  }
  return properties;
}

function createLabInspectorProperty(
  gameObjects: LabGameObject[],
  path: string,
  label: string,
  value: unknown,
  valueType: InspectorProperty<LabSceneDocument>['valueType'],
  control: InspectorProperty<LabSceneDocument>['control'],
  options: Partial<InspectorProperty<LabSceneDocument>> = {},
): InspectorProperty<LabSceneDocument> {
  const readOnly = options.readOnly === true;
  return {
    path,
    label,
    valueType,
    control,
    value,
    mixed: gameObjects.length > 1 && gameObjects.some(candidate => !areLabInspectorValuesEqual(readLabProperty(candidate, path), value)),
    readOnly,
    persistence: options.persistence ?? (readOnly ? 'readonly' : 'document'),
    commitMode: options.commitMode ?? (control === 'boolean' || control === 'enum' || control === 'asset' ? 'immediate' : 'blur'),
    order: options.order,
    min: options.min,
    max: options.max,
    step: options.step,
    options: options.options as readonly InspectorEnumOption[] | undefined,
    coerce: options.coerce,
    validate: options.validate,
    tooltip: options.tooltip,
    tags: options.tags,
  };
}

function createLabSerializedProperties(
  gameObject: LabGameObject,
  multi: boolean,
  gameObjects: LabGameObject[] = [gameObject],
) {
  const readonly = gameObject.id === LAB_ROOT_ID;
  const property = (path: string, label: string, value: unknown, valueType: 'string' | 'number', readOnly = readonly) => ({
    path,
    label,
    valueType,
    value,
    mixed: multi && gameObjects.some(candidate => readLabProperty(candidate, path) !== value),
    readOnly,
    descriptor: {
      path,
      label,
      valueType,
      getValue: () => value,
      setValue: readOnly ? undefined : (nextDocument: LabSceneDocument) => nextDocument,
    },
  });
  return [
    property('gameObject.name', 'Name', gameObject.name, 'string', readonly),
    property('gameObject.id', 'ID', gameObject.id, 'string', true),
    property('transform.position.x', 'X', gameObject.transform.position.x, 'number'),
    property('transform.position.y', 'Y', gameObject.transform.position.y, 'number'),
    property('transform.position.z', 'Z', gameObject.transform.position.z, 'number'),
    property('transform.rotation.x', 'X', gameObject.transform.rotation.x, 'number'),
    property('transform.rotation.y', 'Y', gameObject.transform.rotation.y, 'number'),
    property('transform.rotation.z', 'Z', gameObject.transform.rotation.z, 'number'),
    property('transform.scale.x', 'X', gameObject.transform.scale.x, 'number'),
    property('transform.scale.y', 'Y', gameObject.transform.scale.y, 'number'),
    property('transform.scale.z', 'Z', gameObject.transform.scale.z, 'number'),
  ];
}

function readLabProperty(gameObject: LabGameObject, path: string): unknown {
  if (path === 'gameObject.name') return gameObject.name;
  if (path === 'gameObject.id') return gameObject.id;
  if (path === 'gameObject.active') return gameObject.active;
  if (path === 'renderer.assetId') return gameObject.assetId ?? '';
  if (path === 'appearance.tint') return readLabTint(gameObject);
  const match = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (!match) return undefined;
  return gameObject.transform[match[1] as keyof LabTransform][match[2] as keyof LabVec3];
}

function areLabInspectorValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toLabProjectionNode(gameObject: LabGameObject): BabylonEditorProjectionNode {
  return {
    id: gameObject.id,
    name: gameObject.name,
    parentId: gameObject.parentId,
    active: gameObject.active,
    transform: {
      position: gameObject.transform.position,
      rotation: gameObject.transform.rotation,
      scale: gameObject.transform.scale,
    },
    asset: gameObject.assetId
      ? {
          id: gameObject.assetId,
          sourceId: gameObject.assetId,
          metadata: {
            tint: readLabTint(gameObject),
          },
        }
      : null,
  };
}

function attachLabPrimitiveProjection(context: BabylonEditorProjectionImportContext): any | null {
  const asset = context.node.asset?.sourceId
    ? findAssetInMetadata(context.node.asset.sourceId)
    : null;
  const babylon = context.babylon as any;
  const kind = asset?.kind ?? 'box';
  const mesh = kind === 'sphere'
    ? babylon.MeshBuilder.CreateSphere(`${context.node.id}.labPrimitive`, { diameter: 1 }, context.scene)
    : kind === 'cylinder'
      ? babylon.MeshBuilder.CreateCylinder(`${context.node.id}.labPrimitive`, { diameter: 0.65, height: 1.4, tessellation: 12 }, context.scene)
      : babylon.MeshBuilder.CreateBox(`${context.node.id}.labPrimitive`, { size: 1 }, context.scene);
  mesh.parent = context.root;
  mesh.isPickable = true;
  mesh.metadata = {
    ...(mesh.metadata ?? {}),
    editorProjection: {
      nodeId: context.node.id,
      sourceId: context.node.asset?.sourceId,
    },
  };
  const material = new babylon.StandardMaterial(`${context.node.id}.labMaterial`, context.scene);
  const tint = normalizeLabColor(context.node.asset?.metadata?.tint) ?? hexToLabColor(asset?.color ?? '#5e6a78');
  material.diffuseColor = new babylon.Color3(tint.r, tint.g, tint.b);
  material.specularColor = new babylon.Color3(0.08, 0.1, 0.12);
  mesh.material = material;
  return mesh;
}

function findAssetInMetadata(assetId: string): LabAsset | null {
  return LAB_DEFAULT_ASSETS.find(asset => asset.id === assetId) ?? null;
}

function createLabGameObject(input: {
  id: string;
  name: string;
  parentId: string | null;
  kind: LabGameObject['kind'];
  assetId?: string;
  position?: LabVec3;
  rotation?: LabVec3;
  scale?: LabVec3;
  tint?: LabColor;
}): LabGameObject {
  return {
    id: input.id,
    name: input.name,
    parentId: input.parentId,
    kind: input.kind,
    active: true,
    assetId: input.assetId,
    tint: input.tint ?? (input.kind === 'mesh' ? hexToLabColor(findAssetInMetadata(input.assetId ?? '')?.color ?? '#5e6a78') : undefined),
    transform: createLabTransform(input.position, input.rotation, input.scale),
  };
}

function readLabTint(gameObject: LabGameObject): LabColor {
  return gameObject.tint ?? hexToLabColor(findAssetInMetadata(gameObject.assetId ?? '')?.color ?? '#5e6a78');
}

function normalizeLabColor(value: unknown): LabColor | null {
  if (!value || typeof value !== 'object') return null;
  const color = value as { r?: unknown; g?: unknown; b?: unknown };
  if (typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') return null;
  if (![color.r, color.g, color.b].every(channel => Number.isFinite(channel))) return null;
  return {
    r: clamp01(color.r),
    g: clamp01(color.g),
    b: clamp01(color.b),
  };
}

function hexToLabColor(hex: string): LabColor {
  const clean = hex.replace('#', '').trim();
  const numeric = Number.parseInt(clean.length === 6 ? clean : '5e6a78', 16);
  return {
    r: ((numeric >> 16) & 255) / 255,
    g: ((numeric >> 8) & 255) / 255,
    b: (numeric & 255) / 255,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createLabTransform(
  position: LabVec3 = { x: 0, y: 0, z: 0 },
  rotation: LabVec3 = { x: 0, y: 0, z: 0 },
  scale: LabVec3 = { x: 1, y: 1, z: 1 },
): LabTransform {
  return { position, rotation, scale };
}

function cloneLabGameObject(gameObject: LabGameObject): LabGameObject {
  return typeof structuredClone === 'function'
    ? structuredClone(gameObject)
    : JSON.parse(JSON.stringify(gameObject)) as LabGameObject;
}

function transformSnapshotToLabTransform(snapshot: EditorTransformSnapshot): LabTransform {
  return {
    position: snapshot.position,
    rotation: snapshot.rotation,
    scale: snapshot.scale,
  };
}

function mapLabGameObjects(
  document: LabSceneDocument,
  mapper: (gameObject: LabGameObject) => LabGameObject,
): LabSceneDocument {
  return {
    ...document,
    scene: {
      gameObjects: document.scene.gameObjects.map(mapper),
    },
  };
}

function orderLabGameObjects(gameObjects: LabGameObject[], order: readonly string[]): LabGameObject[] {
  const byId = new Map(gameObjects.map(gameObject => [gameObject.id, gameObject]));
  const ordered = order
    .map(id => byId.get(id))
    .filter((gameObject): gameObject is LabGameObject => !!gameObject);
  const orderedIds = new Set(ordered.map(gameObject => gameObject.id));
  return [
    ...ordered,
    ...gameObjects.filter(gameObject => !orderedIds.has(gameObject.id)),
  ];
}

function resolveLabMoveParentId(document: LabSceneDocument, intent: SceneGraphMoveIntent): string | null {
  if (intent.placement === 'root') return LAB_ROOT_ID;
  if (intent.placement === 'inside' && intent.targetId) return intent.targetId;
  const target = intent.targetId ? findLabGameObject(document, intent.targetId) : null;
  return intent.parentId ?? target?.parentId ?? LAB_ROOT_ID;
}

function resolveLabCreateGroupParentId(document: LabSceneDocument, intent: SceneGraphCreateGroupIntent): string | null | undefined {
  if (intent.parentId) {
    return canLabGameObjectHaveChildren(document, intent.parentId) ? intent.parentId : undefined;
  }
  if (intent.activeId && canLabGameObjectHaveChildren(document, intent.activeId)) return intent.activeId;
  const active = intent.activeId ? findLabGameObject(document, intent.activeId) : null;
  if (active?.parentId && canLabGameObjectHaveChildren(document, active.parentId)) return active.parentId;
  return LAB_ROOT_ID;
}

function resolveLabGroupSelectionParentId(document: LabSceneDocument, parentId: string | null): string | null {
  return parentId && canLabGameObjectHaveChildren(document, parentId) ? parentId : LAB_ROOT_ID;
}

function createLabMoveOrder(
  document: LabSceneDocument,
  ids: readonly string[],
  intent: SceneGraphMoveIntent,
): string[] {
  const blockIds = collectOrderedLabSubtreeBlockIds(document, ids);
  const blockSet = new Set(blockIds);
  const remaining = document.scene.gameObjects
    .map(gameObject => gameObject.id)
    .filter(id => !blockSet.has(id));
  const index = resolveLabInsertIndex(document, remaining, {
    placement: intent.placement,
    targetId: intent.targetId ?? null,
    beforeId: intent.beforeId ?? null,
    afterId: intent.afterId ?? null,
    parentId: resolveLabMoveParentId(document, intent),
  });
  return insertIdsAt(remaining, blockIds, index);
}

function createLabGroupSelectionOrder(
  document: LabSceneDocument,
  groupId: string,
  ids: readonly string[],
  insertBeforeId: string | null,
): string[] {
  const blockIds = collectOrderedLabSubtreeBlockIds(document, ids);
  const blockSet = new Set(blockIds);
  const currentOrder = document.scene.gameObjects.map(gameObject => gameObject.id);
  const remaining = currentOrder.filter(id => !blockSet.has(id));
  const firstSelectedIndex = Math.min(...ids.map(id => currentOrder.indexOf(id)).filter(index => index >= 0));
  const fallbackIndex = Number.isFinite(firstSelectedIndex)
    ? remaining.filter(id => currentOrder.indexOf(id) < firstSelectedIndex).length
    : remaining.length;
  const index = insertBeforeId
    ? Math.max(0, remaining.indexOf(insertBeforeId))
    : fallbackIndex;
  return insertIdsAt(remaining, [groupId, ...blockIds], index);
}

function collectOrderedLabSubtreeBlockIds(document: LabSceneDocument, rootIds: readonly string[]): string[] {
  const subtreeIds = collectLabSubtreeIds(document, [...rootIds]);
  return document.scene.gameObjects
    .map(gameObject => gameObject.id)
    .filter(id => subtreeIds.has(id));
}

function resolveLabInsertIndex(
  document: LabSceneDocument,
  remaining: readonly string[],
  input: {
    placement: SceneGraphMoveIntent['placement'];
    targetId: string | null;
    beforeId: string | null;
    afterId: string | null;
    parentId: string | null;
  },
): number {
  if (input.beforeId) return boundedInsertIndex(remaining.indexOf(input.beforeId), remaining.length);
  if (input.afterId) return indexAfterLabSubtree(document, remaining, input.afterId);
  if (input.placement === 'before' && input.targetId) return boundedInsertIndex(remaining.indexOf(input.targetId), remaining.length);
  if (input.placement === 'after' && input.targetId) return indexAfterLabSubtree(document, remaining, input.targetId);
  if (input.placement === 'inside' && input.targetId) return indexAfterLabSubtree(document, remaining, input.targetId);
  if (input.placement === 'root') return remaining.length;
  if (input.parentId) return indexAfterLabSubtree(document, remaining, input.parentId);
  return remaining.length;
}

function indexAfterLabSubtree(document: LabSceneDocument, remaining: readonly string[], anchorId: string): number {
  const subtreeIds = collectLabSubtreeIds(document, [anchorId]);
  let index = remaining.indexOf(anchorId);
  if (index < 0) return remaining.length;
  for (let cursor = index + 1; cursor < remaining.length; cursor += 1) {
    if (!subtreeIds.has(remaining[cursor]!)) break;
    index = cursor;
  }
  return index + 1;
}

function insertIdsAt(base: readonly string[], ids: readonly string[], index: number): string[] {
  const safeIndex = Math.max(0, Math.min(index, base.length));
  return [
    ...base.slice(0, safeIndex),
    ...ids,
    ...base.slice(safeIndex),
  ];
}

function boundedInsertIndex(index: number, fallback: number): number {
  return index >= 0 ? index : fallback;
}

function getLabGameObjectWorldTransform(document: LabSceneDocument, id: string): LabTransform | null {
  const byId = new Map(document.scene.gameObjects.map(gameObject => [gameObject.id, gameObject]));
  const chain: LabGameObject[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(id);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  if (chain.length === 0) return null;
  const world = composeEditorTransformChain(chain.map(gameObject => gameObject.transform));
  return world ? transformSnapshotToLabTransform(world) : null;
}

function computeLabLocalTransformForParent(
  document: LabSceneDocument,
  id: string,
  parentId: string | null,
): LabTransform | null {
  const world = getLabGameObjectWorldTransform(document, id);
  return world ? toLabLocalTransformForParent(document, parentId, world) : null;
}

function toLabLocalTransformForParent(
  document: LabSceneDocument,
  parentId: string | null,
  world: LabTransform,
): LabTransform | null {
  const parentWorld = parentId ? getLabGameObjectWorldTransform(document, parentId) : transformSnapshotToLabTransform(createIdentityEditorTransform());
  const local = parentWorld ? toEditorLocalTransformFromWorld(parentWorld, world) : null;
  return local ? transformSnapshotToLabTransform(local) : null;
}

function toLabLocalTransformFromParentWorld(parentWorld: LabTransform, world: LabTransform): LabTransform | null {
  const local = toEditorLocalTransformFromWorld(parentWorld, world);
  return local ? transformSnapshotToLabTransform(local) : null;
}

function computeLabSelectionWorldCenter(document: LabSceneDocument, ids: readonly string[]): LabVec3 | null {
  const worlds = ids
    .map(id => getLabGameObjectWorldTransform(document, id))
    .filter((transform): transform is LabTransform => !!transform);
  if (worlds.length === 0) return null;
  return {
    x: worlds.reduce((sum, transform) => sum + transform.position.x, 0) / worlds.length,
    y: worlds.reduce((sum, transform) => sum + transform.position.y, 0) / worlds.length,
    z: worlds.reduce((sum, transform) => sum + transform.position.z, 0) / worlds.length,
  };
}

function cloneLabTransform(transform: LabTransform): LabTransform {
  return createLabTransform(
    { ...transform.position },
    { ...transform.rotation },
    { ...transform.scale },
  );
}

function labTransformsEqual(left: LabTransform, right: LabTransform): boolean {
  return labVec3Equal(left.position, right.position)
    && labVec3Equal(left.rotation, right.rotation)
    && labVec3Equal(left.scale, right.scale);
}

function labVec3Equal(left: LabVec3, right: LabVec3): boolean {
  return Math.abs(left.x - right.x) < 0.000001
    && Math.abs(left.y - right.y) < 0.000001
    && Math.abs(left.z - right.z) < 0.000001;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getLabGameObjectDepth(document: LabSceneDocument, gameObject: LabGameObject): number {
  let depth = 0;
  let cursor = gameObject;
  const visited = new Set<string>();
  while (cursor.parentId && !visited.has(cursor.parentId)) {
    visited.add(cursor.parentId);
    const parent = findLabGameObject(document, cursor.parentId);
    if (!parent) break;
    depth += 1;
    cursor = parent;
  }
  return depth;
}

function canLabGameObjectHaveChildren(document: LabSceneDocument, id: string): boolean {
  const gameObject = findLabGameObject(document, id);
  return !!gameObject?.transform;
}

function createNextGroupId(document: LabSceneDocument): string {
  let index = 1;
  const ids = new Set(document.scene.gameObjects.map(gameObject => gameObject.id));
  while (ids.has(`lab_group_${String(index).padStart(2, '0')}`)) index += 1;
  return `lab_group_${String(index).padStart(2, '0')}`;
}

let nextObjectIndex = 1;
function createNextObjectId(assetId: string): string {
  const cleanAsset = assetId.replace(/^asset_/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  nextObjectIndex += 1;
  return `lab_${cleanAsset}_${String(nextObjectIndex).padStart(2, '0')}`;
}

function createDuplicateLabObjectId(usedIds: Set<string>, sourceId: string): string {
  const base = `${sourceId}_copy`;
  if (!usedIds.has(base)) return base;
  let index = 2;
  while (usedIds.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function summarizeLabScene(document: LabSceneDocument): string {
  return `labScene assets=${document.assets.length}, gameObjects=${document.scene.gameObjects.length}`;
}
