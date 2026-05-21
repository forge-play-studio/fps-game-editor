import type {
  LocalEditorHarnessDocumentAdapter,
  LocalEditorHarnessMultiPropertyInput,
  LocalEditorHarnessPropertyInput,
  LocalEditorHarnessSceneGraphCreateGroupPatch,
  LocalEditorHarnessSceneGraphDeletePatch,
  LocalEditorHarnessSceneGraphDropPatch,
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
  type ProjectAuthoringHost,
  type SceneGraphCreateGroupIntent,
  type SceneGraphDeleteIntent,
  type SceneGraphDropIntent,
  type SceneGraphValidationResult,
  type SerializedMultiObject,
  type SerializedObject,
  validateSceneGraphDrop,
} from '@fps-games/editor-core';
import type {
  BabylonEditorProjectionImportContext,
  BabylonEditorProjectionImportResult,
  BabylonEditorProjectionNode,
} from '@fps-games/editor-babylon';

export interface LabVec3 {
  x: number;
  y: number;
  z: number;
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
  | { kind: 'game-object.reparent'; id: string; parentId: string | null }
  | { kind: 'game-object.transform'; id: string; transform: Partial<LabTransform> }
  | { kind: 'game-object.transform-batch'; transforms: Record<string, Partial<LabTransform>> }
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

export function createLabSceneDocument(): LabSceneDocument {
  return {
    schemaVersion: 1,
    assets: [
      { id: 'asset_box', label: 'Box', meta: 'primitive', kind: 'box', color: '#2f73e6' },
      { id: 'asset_sphere', label: 'Sphere', meta: 'primitive', kind: 'sphere', color: '#33c875' },
      { id: 'asset_marker', label: 'Marker', meta: 'primitive', kind: 'cylinder', color: '#efb338' },
    ],
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
    findCreatedId(beforeDocument, afterDocument) {
      const beforeIds = new Set(beforeDocument.scene.gameObjects.map(gameObject => gameObject.id));
      return afterDocument.scene.gameObjects.find(gameObject => !beforeIds.has(gameObject.id))?.id ?? null;
    },
    createSerializedPropertyPatch: createLabSerializedPropertyPatch,
    createSerializedMultiPropertyPatch: createLabSerializedMultiPropertyPatch,
    createTransformPatch: createLabTransformPatch,
    createTransformBatchPatch: createLabTransformBatchPatch,
    validateSceneGraphDrop(document, intent) {
      return validateSceneGraphDrop(getLabHierarchyItems(document), intent);
    },
    createSceneGraphRenamePatch: createLabSceneGraphRenamePatch,
    createSceneGraphCreateGroupPatch: createLabSceneGraphCreateGroupPatch,
    createSceneGraphDeletePatch: createLabSceneGraphDeletePatch,
    createSceneGraphDropPatch: createLabSceneGraphDropPatch,
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

export function createLabGrid(babylon: any, scene: any): void {
  if (!babylon.MeshBuilder || !babylon.Vector3 || !babylon.Color3) return;
  const gridSize = 12;
  const gridColor = new babylon.Color3(0.18, 0.27, 0.42);
  const axisXColor = new babylon.Color3(0.8, 0.22, 0.22);
  const axisZColor = new babylon.Color3(0.22, 0.55, 0.85);
  for (let i = -gridSize; i <= gridSize; i += 1) {
    const xLine = babylon.MeshBuilder.CreateLines(`lab-grid-x-${i}`, {
      points: [new babylon.Vector3(-gridSize, 0, i), new babylon.Vector3(gridSize, 0, i)],
    }, scene);
    xLine.color = i === 0 ? axisXColor : gridColor;
    xLine.isPickable = false;
    const zLine = babylon.MeshBuilder.CreateLines(`lab-grid-z-${i}`, {
      points: [new babylon.Vector3(i, 0, -gridSize), new babylon.Vector3(i, 0, gridSize)],
    }, scene);
    zLine.color = i === 0 ? axisZColor : gridColor;
    zLine.isPickable = false;
  }
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
      gameObject.id === patch.id ? { ...gameObject, parentId: patch.parentId } : gameObject
    ));
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

export function getLabHierarchyItems(document: LabSceneDocument) {
  return document.scene.gameObjects.map(gameObject => ({
    id: gameObject.id,
    label: gameObject.name,
    parentId: gameObject.parentId,
    depth: getLabGameObjectDepth(document, gameObject),
    selectable: gameObject.id !== LAB_ROOT_ID,
    locked: gameObject.id === LAB_ROOT_ID,
    canHaveChildren: gameObject.kind === 'root' || gameObject.kind === 'group',
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
  const parentId = intent.parentId && canLabGameObjectHaveChildren(document, intent.parentId)
    ? intent.parentId
    : LAB_ROOT_ID;
  const id = createNextGroupId(document);
  return {
    patch: {
      kind: 'game-object.create-group',
      id,
      parentId,
      name: intent.name?.trim() || 'Group',
    },
    label: 'Create Group',
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
  const validation: SceneGraphValidationResult = validateSceneGraphDrop(getLabHierarchyItems(document), intent);
  if (!validation.ok || intent.placement !== 'inside') return null;
  return {
    patch: {
      kind: 'game-object.reparent',
      id: intent.draggedId,
      parentId: intent.targetId,
    },
    label: `Reparent ${intent.draggedId}`,
    changedIds: [intent.draggedId],
  };
}

function createLabSerializedPropertyPatch(
  input: LocalEditorHarnessPropertyInput<LabSceneDocument>,
): { patch: LabScenePatch; label: string; changedId: string; changedIds: string[] } | null {
  return createLabPropertyPatch(input.document, input.targetId, input.path, input.value);
}

function createLabSerializedMultiPropertyPatch(
  input: LocalEditorHarnessMultiPropertyInput<LabSceneDocument>,
): { patch: LabScenePatch; label: string; changedIds: string[] } | null {
  const patches = input.targetIds
    .map(targetId => createLabPropertyPatch(input.document, targetId, input.path, input.value))
    .filter((patch): patch is { patch: LabScenePatch; label: string; changedId: string; changedIds: string[] } => !!patch);
  if (patches.length === 0) return null;
  if (patches.length === 1) return patches[0]!;
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
): { patch: LabScenePatch; label: string; changedId: string; changedIds: string[] } | null {
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
): { patch: LabScenePatch; label: string; changedIds: string[] } | null {
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

function createLabPropertyPatch(
  document: LabSceneDocument,
  targetId: string,
  path: string,
  value: number | string | boolean,
): { patch: LabScenePatch; label: string; changedId: string; changedIds: string[] } | null {
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
  const match = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (!match) return undefined;
  return gameObject.transform[match[1] as keyof LabTransform][match[2] as keyof LabVec3];
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
  material.diffuseColor = babylon.Color3.FromHexString(asset?.color ?? '#5e6a78');
  material.specularColor = new babylon.Color3(0.08, 0.1, 0.12);
  mesh.material = material;
  return mesh;
}

function findAssetInMetadata(assetId: string): LabAsset | null {
  return createLabSceneDocument().assets.find(asset => asset.id === assetId) ?? null;
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
}): LabGameObject {
  return {
    id: input.id,
    name: input.name,
    parentId: input.parentId,
    kind: input.kind,
    active: true,
    assetId: input.assetId,
    transform: createLabTransform(input.position, input.rotation, input.scale),
  };
}

function createLabTransform(
  position: LabVec3 = { x: 0, y: 0, z: 0 },
  rotation: LabVec3 = { x: 0, y: 0, z: 0 },
  scale: LabVec3 = { x: 1, y: 1, z: 1 },
): LabTransform {
  return { position, rotation, scale };
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
  return gameObject?.kind === 'root' || gameObject?.kind === 'group';
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

function summarizeLabScene(document: LabSceneDocument): string {
  return `labScene assets=${document.assets.length}, gameObjects=${document.scene.gameObjects.length}`;
}
