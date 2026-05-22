import {
  applySerializedPropertyPatch,
  createSerializedObject,
  type DocumentCommand,
  type EditorTransformSnapshot,
  type InspectorObject,
  type InspectorProperty,
  type InspectorSection,
  type InspectorValidationResult,
  type RuntimePatch,
  type SceneGraphCreateGroupIntent,
  type SceneGraphDeleteIntent,
  type SceneGraphDropIntent,
  type SceneGraphRenameIntent,
  type SceneGraphValidationResult,
  type SerializedMultiObject,
  type SerializedObject,
  type SerializedPropertyDescriptor,
  type SerializedPropertyPatch,
} from '@fps-games/editor-core';
import type {
  EditorSceneAsset,
  EditorSceneAssetLibraryItem,
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneVec3,
} from './editor-scene-document';
import type {
  MaterialOverrideConfig,
  OutlineOverrideConfig,
  SceneNodeConfig,
} from '../config';
import {
  getEditorSceneAuthoringSourceRef,
  EDITOR_SCENE_SOURCE_ID,
  EDITOR_SCENE_SOURCE_TYPE,
} from './editor-authoring-source';
import {
  findEditorSceneModelRenderer,
  findEditorSceneTransform,
  patchEditorSceneGameObjectTransform,
  readEditorSceneNodeKind,
} from './editor-scene-document';
import { mergeEditorSceneAssetWithLibraryItem } from './editor-asset-library';
import { resolveSceneNodeFieldSchema } from './scene-node-field-schema';

export type EditorSceneDocumentPatch =
  | ({ kind: 'serialized-property' } & SerializedPropertyPatch)
  | {
    kind: 'game-object.field';
    targetId: string;
    path: string;
    value: unknown;
  }
  | {
    kind: 'game-object.create-from-asset';
    assetItem: EditorSceneAssetLibraryItem;
  }
  | {
    kind: 'game-object.transform';
    targetId: string;
    transform: EditorTransformSnapshot;
  }
  | {
    kind: 'game-object.transform-batch';
    targets: Array<{
      targetId: string;
      transform: Partial<EditorTransformSnapshot>;
    }>;
  }
  | {
    kind: 'game-object.rename';
    targetId: string;
    name: string;
  }
  | {
    kind: 'game-object.create-group';
    gameObject: EditorSceneGameObject;
  }
  | {
    kind: 'game-object.delete-subtree';
    targetIds: string[];
  }
  | {
    kind: 'game-object.reparent';
    targetId: string;
    parentId?: string;
    transform?: EditorTransformSnapshot;
  };

export function reduceEditorSceneDocument(
  document: EditorSceneDocument,
  command: DocumentCommand<EditorSceneDocument, EditorSceneDocumentPatch>,
): EditorSceneDocument {
  if (command.type === 'document.replace') return command.document;
  const patch = command.patch;
  if (patch.kind === 'serialized-property') {
    return applyEditorSceneSerializedPropertyPatch(document, patch);
  }
  if (patch.kind === 'game-object.field') {
    return patchEditorSceneGameObjectField(document, patch.targetId, patch.path, patch.value);
  }
  if (patch.kind === 'game-object.create-from-asset') {
    return addAssetLibraryItemToEditorSceneDocument(document, patch.assetItem).document;
  }
  if (patch.kind === 'game-object.transform') {
    return patchEditorSceneGameObjectTransform(document, patch.targetId, {
      position: patch.transform.position,
      rotation: patch.transform.rotation,
      scale: patch.transform.scale,
    });
  }
  if (patch.kind === 'game-object.transform-batch') {
    return patch.targets.reduce(
      (nextDocument, target) => {
        const gameObject = nextDocument.scene.gameObjects.find((entry) => entry.id === target.targetId);
        const transform = gameObject ? findEditorSceneTransform(gameObject) : null;
        return patchEditorSceneGameObjectTransform(nextDocument, target.targetId, {
          position: target.transform.position
            ? { ...transform?.position, ...target.transform.position } as EditorSceneVec3
            : undefined,
          rotation: target.transform.rotation
            ? { ...transform?.rotation, ...target.transform.rotation } as EditorSceneVec3
            : undefined,
          scale: target.transform.scale
            ? { ...readTransformVector(transform ?? { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, 'scale'), ...target.transform.scale } as EditorSceneVec3
            : undefined,
        });
      },
      document,
    );
  }
  if (patch.kind === 'game-object.rename') {
    const name = patch.name.trim();
    if (!name) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.map((gameObject) => (
          gameObject.id === patch.targetId
            ? { ...gameObject, name }
            : gameObject
        )),
      },
    };
  }
  if (patch.kind === 'game-object.create-group') {
    if (document.scene.gameObjects.some((gameObject) => gameObject.id === patch.gameObject.id)) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: [...document.scene.gameObjects, patch.gameObject],
      },
    };
  }
  if (patch.kind === 'game-object.delete-subtree') {
    const deleteIds = collectEditorSceneSubtreeIds(document, patch.targetIds);
    if (deleteIds.size === 0) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.filter((gameObject) => !deleteIds.has(gameObject.id)),
      },
    };
  }
  if (patch.kind === 'game-object.reparent') {
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.map((gameObject) => {
          if (gameObject.id !== patch.targetId) return gameObject;
          return {
            ...gameObject,
            parentId: patch.parentId,
            components: patch.transform
              ? gameObject.components.map((component) => {
                  if (component.type !== 'Transform') return component;
                  return {
                    ...component,
                    position: patch.transform?.position ?? component.position,
                    rotation: patch.transform?.rotation ?? component.rotation,
                    scale: patch.transform?.scale ?? component.scale,
                  };
                })
              : gameObject.components,
          };
        }),
      },
    };
  }
  return document;
}

export function isEditorSceneGroupLikeGameObject(gameObject: EditorSceneGameObject): boolean {
  return readEditorSceneNodeKind(gameObject) === 'group';
}

export function createEditorSceneRenamePatch(
  document: EditorSceneDocument,
  intent: SceneGraphRenameIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string } | null {
  const name = intent.name.trim();
  if (!name) return null;
  const gameObject = findEditorSceneGameObject(document, intent.id);
  if (!gameObject || gameObject.name === name) return null;
  return {
    label: `Rename ${gameObject.name ?? gameObject.id} to ${name}`,
    patch: {
      kind: 'game-object.rename',
      targetId: intent.id,
      name,
    },
    changedId: intent.id,
  };
}

export function createEditorSceneCreateGroupPatch(
  document: EditorSceneDocument,
  intent: SceneGraphCreateGroupIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string } | null {
  const parentId = resolveCreateGroupParentId(document, intent.activeId ?? intent.parentId ?? null);
  const parent = parentId ? findEditorSceneGameObject(document, parentId) : null;
  if (parentId && (!parent || !isEditorSceneGroupLikeGameObject(parent))) return null;
  const id = createUniqueEditorSceneId(document.scene.gameObjects.map((gameObject) => gameObject.id), 'group');
  const name = intent.name?.trim() || 'Group';
  const gameObject: EditorSceneGameObject = {
    id,
    name,
    ...(parentId ? { parentId } : {}),
    active: true,
    components: [
      {
        type: 'Transform',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
  };
  return {
    label: `Create group ${name}`,
    patch: {
      kind: 'game-object.create-group',
      gameObject,
    },
    createdId: id,
  };
}

export function createEditorSceneDeleteSubtreePatch(
  document: EditorSceneDocument,
  intent: SceneGraphDeleteIntent,
): { patch: EditorSceneDocumentPatch; label: string; deletedIds: string[]; fallbackSelectionId: string | null } | null {
  const deletedIds = [...collectEditorSceneSubtreeIds(document, intent.ids)];
  if (deletedIds.length === 0) return null;
  const fallbackSelectionId = resolveDeleteFallbackSelectionId(document, deletedIds, intent.activeId ?? null);
  return {
    label: `Delete ${deletedIds.length} GameObject${deletedIds.length === 1 ? '' : 's'}`,
    patch: {
      kind: 'game-object.delete-subtree',
      targetIds: intent.ids,
    },
    deletedIds,
    fallbackSelectionId,
  };
}

export function collectEditorSceneSubtreeIdList(document: EditorSceneDocument, rootIds: string[]): string[] {
  return [...collectEditorSceneSubtreeIds(document, rootIds)];
}

export function validateEditorSceneReparent(
  document: EditorSceneDocument,
  intent: SceneGraphDropIntent,
): SceneGraphValidationResult {
  if (intent.placement !== 'inside') return { ok: false, reason: 'Only inside reparent is supported.' };
  const dragged = findEditorSceneGameObject(document, intent.draggedId);
  const target = findEditorSceneGameObject(document, intent.targetId);
  if (!dragged) return { ok: false, reason: `GameObject not found: ${intent.draggedId}` };
  if (!target) return { ok: false, reason: `Parent GameObject not found: ${intent.targetId}` };
  if (!findEditorSceneTransform(dragged)) return { ok: false, reason: `${intent.draggedId} has no Transform to preserve.` };
  if (!isEditorSceneGroupLikeGameObject(target)) return { ok: false, reason: `${intent.targetId} cannot have children.` };
  if (dragged.id === target.id) return { ok: false, reason: 'GameObject cannot be parented to itself.' };
  if (isEditorSceneAncestor(document, dragged.id, target.id)) {
    return { ok: false, reason: 'GameObject cannot be parented to its descendant.' };
  }
  if (intent.preserveWorldTransform !== false && !canPreserveWorldTransformWithSimpleMath(document, dragged.parentId, target.id)) {
    return { ok: false, reason: 'Cannot preserve world transform under rotated or scaled parents yet.' };
  }
  return { ok: true };
}

export function createEditorSceneReparentPatch(
  document: EditorSceneDocument,
  intent: SceneGraphDropIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const validation = validateEditorSceneReparent(document, intent);
  if (!validation.ok) return null;
  const target = findEditorSceneGameObject(document, intent.draggedId);
  if (!target || !findEditorSceneTransform(target)) return null;
  const parentId = intent.targetId;
  const transform = intent.preserveWorldTransform === false
    ? readGameObjectLocalTransform(target)
    : computeLocalTransformForParent(document, target.id, parentId);
  if (!transform) return null;
  if (target.parentId === parentId && transformsEqual(readGameObjectLocalTransform(target), transform)) return null;
  return {
    label: `Reparent ${target.name ?? target.id}`,
    patch: {
      kind: 'game-object.reparent',
      targetId: target.id,
      parentId,
      transform,
    },
    changedIds: [target.id],
  };
}

export function getEditorSceneGameObjectWorldTransform(
  document: EditorSceneDocument,
  gameObjectId: string,
): EditorTransformSnapshot | null {
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  if (!gameObject) return null;
  const chain: EditorSceneGameObject[] = [];
  const byId = createGameObjectMap(document);
  const seen = new Set<string>();
  let cursor: EditorSceneGameObject | undefined = gameObject;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return chain.reduce(
    (world, entry) => combineTransforms(world, readGameObjectLocalTransform(entry)),
    identityTransform(),
  );
}

export function toEditorSceneLocalTransformFromWorld(
  document: EditorSceneDocument,
  gameObjectId: string,
  worldTransform: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  if (!gameObject || !findEditorSceneTransform(gameObject)) return null;
  if (!isSimpleParentChain(document, gameObject.parentId)) return null;
  return toLocalTransformForParent(document, gameObject.parentId, worldTransform);
}

export function createEditorScenePatchFromRuntimePatch(
  document: EditorSceneDocument,
  runtimePatch: RuntimePatch,
): { patch: EditorSceneDocumentPatch; label: string } | null {
  const sourceRef = getEditorSceneAuthoringSourceRef(document);
  const binding = runtimePatch.sourceBinding;
  if (!runtimePatch.applyable || !binding) return null;
  if (runtimePatch.applyTarget !== EDITOR_SCENE_SOURCE_TYPE) return null;
  if (binding.sourceId !== EDITOR_SCENE_SOURCE_ID || binding.sourceType !== EDITOR_SCENE_SOURCE_TYPE) return null;
  if (binding.sourceId !== sourceRef.sourceId || binding.sourceType !== sourceRef.sourceType) return null;
  const gameObjectId = binding.objectId;
  if (!gameObjectId || !document.scene.gameObjects.some((gameObject) => gameObject.id === gameObjectId)) return null;
  const after = runtimePatch.after;
  if (!isEditorTransformSnapshot(after)) return null;
  return {
    label: runtimePatch.label ?? `Apply runtime transform ${gameObjectId}`,
    patch: {
      kind: 'game-object.transform',
      targetId: gameObjectId,
      transform: after,
    },
  };
}

export function getEditorSceneSerializedObject(
  document: EditorSceneDocument,
  gameObjectId: string,
): SerializedObject<EditorSceneDocument> | null {
  const gameObject = document.scene.gameObjects.find((entry) => entry.id === gameObjectId);
  if (!gameObject) return null;
  return createSerializedObject({
    document,
    targetId: gameObjectId,
    label: gameObject.name ?? gameObject.id,
    descriptors: createEditorScenePropertyDescriptors(gameObject),
  });
}

export function getEditorSceneSerializedMultiObject(
  document: EditorSceneDocument,
  gameObjectIds: string[],
  activeId: string | null,
): SerializedMultiObject<EditorSceneDocument> | null {
  const gameObjects = gameObjectIds
    .map((gameObjectId) => document.scene.gameObjects.find((entry) => entry.id === gameObjectId) ?? null)
    .filter((gameObject): gameObject is EditorSceneGameObject => !!gameObject);
  if (gameObjects.length === 0) return null;
  return {
    targetIds: gameObjects.map((gameObject) => gameObject.id),
    activeId,
    label: `${gameObjects.length} GameObjects`,
    properties: createEditorSceneMultiTransformProperties(gameObjects),
  };
}

export function getEditorSceneInspectorObject(
  document: EditorSceneDocument,
  gameObjectId: string,
): InspectorObject<EditorSceneDocument> | null {
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  if (!gameObject) return null;
  return {
    targetIds: [gameObject.id],
    activeId: gameObject.id,
    label: gameObject.name ?? gameObject.id,
    document,
    selection: {
      targetIds: [gameObject.id],
      activeId: gameObject.id,
      targetKind: readEditorSceneNodeKind(gameObject),
      document,
    },
    sections: createEditorSceneInspectorSections(document, gameObject),
  };
}

export function getEditorSceneInspectorMultiObject(
  document: EditorSceneDocument,
  gameObjectIds: string[],
  activeId: string | null,
): InspectorObject<EditorSceneDocument> | null {
  const serialized = getEditorSceneSerializedMultiObject(document, gameObjectIds, activeId);
  if (!serialized) return null;
  return {
    targetIds: serialized.targetIds,
    activeId,
    label: serialized.label,
    document,
    selection: {
      targetIds: serialized.targetIds,
      activeId,
      document,
    },
    sections: [{
      id: 'transform',
      title: 'Transform',
      order: 20,
      placement: 'body',
      persistence: 'document',
      properties: serialized.properties.map((property, order) => ({
        path: property.path,
        label: property.label,
        valueType: property.valueType,
        control: 'number',
        value: property.value,
        mixed: property.mixed,
        readOnly: false,
        persistence: 'document',
        commitMode: 'live',
        order,
        step: property.path.startsWith('transform.rotation.') ? 1 : 0.1,
        validate: createEditorSceneInspectorValidator('group', property.path),
      })),
    }],
  };
}

export interface EditorSceneInspectorPropertyPatchInput {
  document: EditorSceneDocument;
  targetId: string;
  path: string;
  value: unknown;
}

export interface EditorSceneRuntimeInspectorContext {
  document: EditorSceneDocument;
  activeId: string | null;
  projectedRoot?: unknown;
}

export function getEditorSceneRuntimeInspectorSections(
  context: EditorSceneRuntimeInspectorContext,
): InspectorSection<EditorSceneDocument>[] {
  if (!context.activeId) return [];
  const gameObject = findEditorSceneGameObject(context.document, context.activeId);
  if (!gameObject) return [];
  const renderer = findEditorSceneModelRenderer(gameObject);
  const sourceRef = getEditorSceneAuthoringSourceRef(context.document);
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createRuntimeInspectorProperty('runtime.binding.sourceId', 'Source ID', sourceRef.sourceId, 0),
    createRuntimeInspectorProperty('runtime.binding.sourceType', 'Source Type', sourceRef.sourceType, 1),
    createRuntimeInspectorProperty('runtime.binding.objectId', 'Object ID', gameObject.id, 2),
    createRuntimeInspectorProperty('runtime.binding.component', 'Component', renderer ? 'ModelRenderer' : readEditorSceneNodeKind(gameObject) === 'transform' ? 'Transform' : 'GameObject', 3),
  ];
  const materialKind = resolveProjectedMaterialRuntimeKind(context.projectedRoot);
  if (materialKind) properties.push(createRuntimeInspectorProperty('runtime.material.kind', 'Material Kind', materialKind, properties.length));
  return [{
    id: 'runtimeBinding',
    title: 'Runtime Binding',
    order: 910,
    placement: 'body',
    persistence: 'runtime',
    runtimeOnly: true,
    properties,
  }];
}

export function createEditorSceneInspectorPropertyPatch(
  input: EditorSceneInspectorPropertyPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[] } | null {
  const gameObject = findEditorSceneGameObject(input.document, input.targetId);
  if (!gameObject) return null;
  const path = input.path;
  const value = normalizeEditorSceneInspectorValue(path, input.value);
  if (!validateEditorSceneInspectorValue(input.document, gameObject, path, value).ok) return null;
  if (isUnsafeGroupRotationOrScale(input.document, input.targetId, path)) return null;
  const changedIds = path.startsWith('transform.')
    ? collectEditorSceneSubtreeIdList(input.document, [input.targetId])
    : [input.targetId];
  return {
    label: `Patch ${input.targetId} ${path}`,
    patch: {
      kind: 'game-object.field',
      targetId: input.targetId,
      path,
      value,
    },
    changedId: input.targetId,
    changedIds,
  };
}

function isEditorTransformSnapshot(value: unknown): value is EditorTransformSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorTransformSnapshot>;
  return isVec3(candidate.position) && isVec3(candidate.rotation) && isVec3(candidate.scale);
}

function findEditorSceneGameObject(
  document: EditorSceneDocument,
  gameObjectId: string,
): EditorSceneGameObject | null {
  return document.scene.gameObjects.find((gameObject) => gameObject.id === gameObjectId) ?? null;
}

function resolveCreateGroupParentId(document: EditorSceneDocument, activeId: string | null): string | undefined {
  const active = activeId ? findEditorSceneGameObject(document, activeId) : null;
  if (active && isEditorSceneGroupLikeGameObject(active)) return active.id;
  if (active?.parentId && findEditorSceneGameObject(document, active.parentId)) return active.parentId;
  return document.scene.gameObjects.find((gameObject) => gameObject.id === 'mvp_root' && isEditorSceneGroupLikeGameObject(gameObject))?.id
    ?? document.scene.gameObjects.find((gameObject) => !gameObject.parentId && isEditorSceneGroupLikeGameObject(gameObject))?.id;
}

function collectEditorSceneSubtreeIds(document: EditorSceneDocument, rootIds: string[]): Set<string> {
  const ids = new Set(rootIds.filter((id) => !!findEditorSceneGameObject(document, id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const gameObject of document.scene.gameObjects) {
      if (gameObject.parentId && ids.has(gameObject.parentId) && !ids.has(gameObject.id)) {
        ids.add(gameObject.id);
        changed = true;
      }
    }
  }
  return ids;
}

function resolveDeleteFallbackSelectionId(
  document: EditorSceneDocument,
  deletedIds: string[],
  activeId: string | null,
): string | null {
  const deleted = new Set(deletedIds);
  const active = activeId ? findEditorSceneGameObject(document, activeId) : null;
  if (active?.parentId && !deleted.has(active.parentId) && findEditorSceneGameObject(document, active.parentId)) {
    return active.parentId;
  }
  const remaining = document.scene.gameObjects.filter((gameObject) => !deleted.has(gameObject.id));
  return remaining[remaining.length - 1]?.id ?? null;
}

function isEditorSceneAncestor(document: EditorSceneDocument, ancestorId: string, descendantId: string): boolean {
  const byId = createGameObjectMap(document);
  const seen = new Set<string>();
  let cursor = byId.get(descendantId);
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    if (cursor.parentId === ancestorId) return true;
    seen.add(cursor.parentId);
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

function createGameObjectMap(document: EditorSceneDocument): Map<string, EditorSceneGameObject> {
  return new Map(document.scene.gameObjects.map((gameObject) => [gameObject.id, gameObject]));
}

function canPreserveWorldTransformWithSimpleMath(
  document: EditorSceneDocument,
  oldParentId: string | undefined,
  newParentId: string | undefined,
): boolean {
  return isSimpleParentChain(document, oldParentId) && isSimpleParentChain(document, newParentId);
}

function isSimpleParentChain(document: EditorSceneDocument, parentId: string | undefined): boolean {
  if (!parentId) return true;
  const byId = createGameObjectMap(document);
  const seen = new Set<string>();
  let cursor = byId.get(parentId);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    const transform = readGameObjectLocalTransform(cursor);
    if (!isZeroVec3(transform.rotation) || !isOneVec3(transform.scale)) return false;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return true;
}

function computeLocalTransformForParent(
  document: EditorSceneDocument,
  gameObjectId: string,
  parentId: string | undefined,
): EditorTransformSnapshot | null {
  const world = getEditorSceneGameObjectWorldTransform(document, gameObjectId);
  if (!world) return null;
  return toLocalTransformForParent(document, parentId, world);
}

function toLocalTransformForParent(
  document: EditorSceneDocument,
  parentId: string | undefined,
  world: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const parentWorld = parentId ? getEditorSceneGameObjectWorldTransform(document, parentId) : identityTransform();
  if (!parentWorld || Math.abs(parentWorld.scale.x) < 0.000001 || Math.abs(parentWorld.scale.y) < 0.000001 || Math.abs(parentWorld.scale.z) < 0.000001) {
    return null;
  }
  return {
    position: {
      x: world.position.x - parentWorld.position.x,
      y: world.position.y - parentWorld.position.y,
      z: world.position.z - parentWorld.position.z,
    },
    rotation: {
      x: world.rotation.x - parentWorld.rotation.x,
      y: world.rotation.y - parentWorld.rotation.y,
      z: world.rotation.z - parentWorld.rotation.z,
    },
    scale: {
      x: world.scale.x / parentWorld.scale.x,
      y: world.scale.y / parentWorld.scale.y,
      z: world.scale.z / parentWorld.scale.z,
    },
  };
}

function readGameObjectLocalTransform(gameObject: EditorSceneGameObject): EditorTransformSnapshot {
  const transform = findEditorSceneTransform(gameObject);
  if (!transform) return identityTransform();
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...readTransformVector(transform, 'scale') },
  };
}

function identityTransform(): EditorTransformSnapshot {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function combineTransforms(parent: EditorTransformSnapshot, local: EditorTransformSnapshot): EditorTransformSnapshot {
  return {
    position: {
      x: parent.position.x + local.position.x,
      y: parent.position.y + local.position.y,
      z: parent.position.z + local.position.z,
    },
    rotation: {
      x: parent.rotation.x + local.rotation.x,
      y: parent.rotation.y + local.rotation.y,
      z: parent.rotation.z + local.rotation.z,
    },
    scale: {
      x: parent.scale.x * local.scale.x,
      y: parent.scale.y * local.scale.y,
      z: parent.scale.z * local.scale.z,
    },
  };
}

function transformsEqual(left: EditorTransformSnapshot, right: EditorTransformSnapshot): boolean {
  return vectorsEqual(left.position, right.position)
    && vectorsEqual(left.rotation, right.rotation)
    && vectorsEqual(left.scale, right.scale);
}

function vectorsEqual(left: EditorSceneVec3, right: EditorSceneVec3): boolean {
  return Math.abs(left.x - right.x) < 0.000001
    && Math.abs(left.y - right.y) < 0.000001
    && Math.abs(left.z - right.z) < 0.000001;
}

function isZeroVec3(value: EditorSceneVec3): boolean {
  return Math.abs(value.x) < 0.000001
    && Math.abs(value.y) < 0.000001
    && Math.abs(value.z) < 0.000001;
}

function isOneVec3(value: EditorSceneVec3): boolean {
  return Math.abs(value.x - 1) < 0.000001
    && Math.abs(value.y - 1) < 0.000001
    && Math.abs(value.z - 1) < 0.000001;
}

function isVec3(value: unknown): value is EditorSceneVec3 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorSceneVec3>;
  return typeof candidate.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.y === 'number'
    && Number.isFinite(candidate.y)
    && typeof candidate.z === 'number'
    && Number.isFinite(candidate.z);
}

function createEditorSceneInspectorSections(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): InspectorSection<EditorSceneDocument>[] {
  const nodeKind = readEditorSceneNodeKind(gameObject);
  const sections: InspectorSection<EditorSceneDocument>[] = [
    {
      id: 'common',
      title: 'Common',
      order: 10,
      placement: 'body',
      persistence: 'document',
      properties: createCommonInspectorProperties(document, gameObject, nodeKind),
    },
  ];
  const transform = findEditorSceneTransform(gameObject);
  if (transform) {
    sections.push({
      id: 'transform',
      title: 'Transform',
      order: 20,
      placement: 'body',
      persistence: 'document',
      properties: createTransformInspectorProperties(nodeKind, transform),
    });
  }
  const renderer = findEditorSceneModelRenderer(gameObject);
  if (renderer) {
    sections.push({
      id: 'renderer',
      title: 'Renderer / Asset',
      order: 30,
      placement: 'body',
      persistence: 'document',
      properties: createRendererInspectorProperties(document, gameObject, renderer.assetId),
    });
  }
  if (nodeKind === 'transform' && (gameObject.transformType === 'groundDecal' || gameObject.groundDecal)) {
    sections.push({
      id: 'groundDecal',
      title: 'Ground Decal',
      order: 40,
      placement: 'body',
      persistence: 'document',
      properties: createGroundDecalInspectorProperties(nodeKind, gameObject.groundDecal),
    });
  }
  if (nodeKind === 'instance' || nodeKind === 'transform') {
    sections.push({
      id: 'materialOverride',
      title: 'Material Override',
      order: 50,
      placement: 'body',
      persistence: 'document',
      properties: createMaterialOverrideInspectorProperties(nodeKind, gameObject.overrides?.material),
    });
    sections.push({
      id: 'outline',
      title: 'Outline',
      order: 60,
      placement: 'body',
      persistence: 'document',
      properties: createOutlineInspectorProperties(nodeKind, gameObject.overrides?.outline),
    });
  }
  const metadataProperties = createMetadataInspectorProperties(document, gameObject, renderer?.assetId ?? null);
  if (metadataProperties.length > 0) {
    sections.push({
      id: 'metadata',
      title: 'Metadata',
      order: 70,
      placement: 'body',
      persistence: 'readonly',
      properties: metadataProperties,
    });
  }
  return sections;
}

function createCommonInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  nodeKind: SceneNodeConfig['kind'],
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createReadonlyInspectorProperty('id', 'ID', gameObject.id, 0),
    createDocumentInspectorProperty(document, nodeKind, {
      path: 'name',
      label: 'Name',
      valueType: 'string',
      control: 'string',
      value: gameObject.name ?? gameObject.id,
      commitMode: 'blur',
      order: 1,
    }),
    createDocumentInspectorProperty(document, nodeKind, {
      path: 'enabled',
      label: 'Enabled',
      valueType: 'boolean',
      control: 'boolean',
      value: gameObject.active !== false,
      commitMode: 'immediate',
      order: 2,
    }),
  ];
}

function createTransformInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  transform: { position: EditorSceneVec3; rotation: EditorSceneVec3; scale?: EditorSceneVec3 },
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  let order = 0;
  for (const vectorName of ['position', 'rotation', 'scale'] as const) {
    const vector = readTransformVector(transform, vectorName);
    for (const axis of ['x', 'y', 'z'] as const) {
      const path = `transform.${vectorName}.${axis}`;
      properties.push(createDocumentInspectorProperty(null, nodeKind, {
        path,
        label: `${vectorName}.${axis}`,
        valueType: 'number',
        control: 'number',
        value: vectorName === 'rotation' ? roundForInspector(radiansToDegrees(vector[axis])) : vector[axis],
        commitMode: 'live',
        order,
        step: vectorName === 'rotation' ? 1 : 0.1,
      }));
      order += 1;
    }
  }
  return properties;
}

function createRendererInspectorProperties(
  document: EditorSceneDocument,
  _gameObject: EditorSceneGameObject,
  assetId: string,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createDocumentInspectorProperty(document, 'instance', {
      path: 'instance.assetId',
      label: 'Asset',
      valueType: 'enum',
      control: 'enum',
      value: assetId,
      commitMode: 'immediate',
      order: 0,
      options: document.assets.map((asset) => ({
        label: asset.displayName ?? asset.id,
        value: asset.id,
      })),
    }),
  ];
}

function createGroundDecalInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  groundDecal: EditorSceneGameObject['groundDecal'],
): InspectorProperty<EditorSceneDocument>[] {
  const decal = groundDecal ?? createDefaultGroundDecal();
  return [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.size.width',
      label: 'Width',
      valueType: 'number',
      control: 'number',
      value: decal.size.width,
      commitMode: 'live',
      order: 0,
      min: 0.001,
      step: 0.1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.size.depth',
      label: 'Depth',
      valueType: 'number',
      control: 'number',
      value: decal.size.depth,
      commitMode: 'live',
      order: 1,
      min: 0.001,
      step: 0.1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.textureId',
      label: 'Texture ID',
      valueType: 'string',
      control: 'string',
      value: decal.textureId ?? '',
      commitMode: 'blur',
      order: 2,
      coerce: value => normalizeEditorSceneInspectorValue('groundDecal.textureId', value),
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.color',
      label: 'Color',
      valueType: 'color',
      control: 'color',
      value: decal.color ?? { r: 1, g: 1, b: 1 },
      commitMode: 'immediate',
      order: 3,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.alphaIndex',
      label: 'Alpha Index',
      valueType: 'number',
      control: 'number',
      value: decal.alphaIndex ?? 0,
      commitMode: 'live',
      order: 4,
      step: 1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.diffuseTextureLevel',
      label: 'Diffuse Level',
      valueType: 'number',
      control: 'number',
      value: decal.diffuseTextureLevel ?? 1,
      commitMode: 'live',
      order: 5,
      step: 0.05,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.emissiveTextureLevel',
      label: 'Emissive Level',
      valueType: 'number',
      control: 'number',
      value: decal.emissiveTextureLevel ?? 0,
      commitMode: 'live',
      order: 6,
      step: 0.05,
    }),
  ];
}

function createMaterialOverrideInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.albedoColor',
      label: 'Albedo',
      valueType: 'color',
      control: 'color',
      value: material?.albedoColor ?? { r: 1, g: 1, b: 1 },
      commitMode: 'immediate',
      order: 0,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.emissiveColor',
      label: 'Emissive',
      valueType: 'color',
      control: 'color',
      value: material?.emissiveColor ?? { r: 0, g: 0, b: 0 },
      commitMode: 'immediate',
      order: 1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.metallic',
      label: 'Metallic',
      valueType: 'number',
      control: 'number',
      value: material?.metallic ?? 0,
      commitMode: 'live',
      order: 2,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.roughness',
      label: 'Roughness',
      valueType: 'number',
      control: 'number',
      value: material?.roughness ?? 1,
      commitMode: 'live',
      order: 3,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.alpha',
      label: 'Alpha',
      valueType: 'number',
      control: 'number',
      value: material?.alpha ?? 1,
      commitMode: 'live',
      order: 4,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.backFaceCulling',
      label: 'Back Face Culling',
      valueType: 'boolean',
      control: 'boolean',
      value: material?.backFaceCulling ?? true,
      commitMode: 'immediate',
      order: 5,
    }),
  ];
}

function createOutlineInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  outline: OutlineOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.outline.renderOutline',
      label: 'Render Outline',
      valueType: 'boolean',
      control: 'boolean',
      value: outline?.renderOutline ?? false,
      commitMode: 'immediate',
      order: 0,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.outline.outlineWidth',
      label: 'Width',
      valueType: 'number',
      control: 'number',
      value: outline?.outlineWidth ?? 0.04,
      commitMode: 'live',
      order: 1,
      min: 0,
      step: 0.005,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.outline.outlineColor',
      label: 'Color',
      valueType: 'color',
      control: 'color',
      value: outline?.outlineColor ?? { r: 0.03, g: 0.03, b: 0.03 },
      commitMode: 'immediate',
      order: 2,
    }),
  ];
}

function createMetadataInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  assetId: string | null,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  const asset = assetId ? document.assets.find((entry) => entry.id === assetId) : null;
  if (asset) {
    properties.push(createReadonlyInspectorProperty('metadata.assetSource', 'Asset Source', asset.sourceId, 0));
    properties.push(createReadonlyInspectorProperty('metadata.assetCategory', 'Category', asset.category ?? '', 1));
    if (asset.materialMode) properties.push(createReadonlyInspectorProperty('metadata.materialMode', 'Material Mode', asset.materialMode, 2));
    if (asset.metadata) properties.push(createReadonlyInspectorProperty('metadata.asset', 'Asset Metadata', asset.metadata, 3));
  }
  if (gameObject.metadata) {
    properties.push(createReadonlyInspectorProperty('metadata.gameObject', 'GameObject Metadata', gameObject.metadata, properties.length));
  }
  return properties;
}

function createDocumentInspectorProperty(
  document: EditorSceneDocument | null,
  nodeKind: SceneNodeConfig['kind'],
  property: Omit<InspectorProperty<EditorSceneDocument>, 'readOnly' | 'persistence' | 'validate'>,
): InspectorProperty<EditorSceneDocument> {
  return {
    ...property,
    readOnly: false,
    persistence: 'document',
    document: document ?? undefined,
    validate: createEditorSceneInspectorValidator(nodeKind, property.path, document),
  };
}

function createReadonlyInspectorProperty(
  path: string,
  label: string,
  value: unknown,
  order: number,
): InspectorProperty<EditorSceneDocument> {
  return {
    path,
    label,
    valueType: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : typeof value === 'object' ? 'object' : 'string',
    control: 'readonly',
    value,
    readOnly: true,
    persistence: 'readonly',
    commitMode: 'blur',
    order,
  };
}

function createRuntimeInspectorProperty(
  path: string,
  label: string,
  value: unknown,
  order: number,
): InspectorProperty<EditorSceneDocument> {
  return {
    path,
    label,
    valueType: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : typeof value === 'object' ? 'object' : 'string',
    control: 'readonly',
    value,
    readOnly: true,
    persistence: 'runtime',
    commitMode: 'blur',
    order,
  };
}

function createEditorSceneInspectorValidator(
  nodeKind: SceneNodeConfig['kind'],
  path: string,
  document?: EditorSceneDocument | null,
): (value: unknown) => InspectorValidationResult {
  return (value) => {
    const schema = resolveSceneNodeFieldSchema(path, nodeKind);
    if (!schema) return { ok: false, message: `Unsupported scene node field: ${path}.` };
    if (value == null && schema.allowDelete === false) {
      return { ok: false, message: `Scene node field cannot be deleted: ${path}.` };
    }
    if (!schema.validate(value)) return { ok: false, message: `Invalid value for scene node field: ${path}.` };
    if (path === 'instance.assetId' && document && typeof value === 'string' && !document.assets.some((asset) => asset.id === value)) {
      return { ok: false, message: `Asset not found: ${value}.` };
    }
    return { ok: true, value };
  };
}

function validateEditorSceneInspectorValue(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  path: string,
  value: unknown,
): InspectorValidationResult {
  return createEditorSceneInspectorValidator(readEditorSceneNodeKind(gameObject), path, document)(value);
}

function normalizeEditorSceneInspectorValue(path: string, value: unknown): unknown {
  if (path === 'groundDecal.textureId' && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

function isUnsafeGroupRotationOrScale(
  editorScene: EditorSceneDocument,
  targetId: string,
  serializedPath: string,
): boolean {
  if (!serializedPath.startsWith('transform.rotation.') && !serializedPath.startsWith('transform.scale.')) {
    return false;
  }
  return collectEditorSceneSubtreeIdList(editorScene, [targetId]).length > 1;
}

export function patchEditorSceneGameObjectField(
  document: EditorSceneDocument,
  targetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  const gameObject = findEditorSceneGameObject(document, targetId);
  if (!gameObject) return document;
  const normalizedValue = normalizeEditorSceneInspectorValue(path, value);
  if (!validateEditorSceneInspectorValue(document, gameObject, path, normalizedValue).ok) return document;
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: document.scene.gameObjects.map((entry) => (
        entry.id === targetId ? patchEditorSceneGameObject(entry, path, normalizedValue) : entry
      )),
    },
  };
}

function patchEditorSceneGameObject(
  gameObject: EditorSceneGameObject,
  path: string,
  value: unknown,
): EditorSceneGameObject {
  const next: EditorSceneGameObject = structuredClone(gameObject);
  if (path === 'name') {
    if (typeof value === 'string' && value.trim()) next.name = value.trim();
    else delete next.name;
    return next;
  }
  if (path === 'enabled') {
    next.active = value !== false;
    return next;
  }
  if (path === 'instance.assetId') {
    const renderer = findEditorSceneModelRenderer(next);
    if (renderer && typeof value === 'string') renderer.assetId = value;
    next.kind = 'instance';
    return next;
  }
  if (path === 'transformType') {
    if (value === 'plain' || value === 'light' || value === 'camera' || value === 'groundDecal') {
      next.kind = 'transform';
      next.transformType = value;
      if (value === 'groundDecal' && !next.groundDecal) next.groundDecal = createDefaultGroundDecal();
    }
    return next;
  }
  const transformMatch = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (transformMatch && typeof value === 'number' && Number.isFinite(value)) {
    const transform = findEditorSceneTransform(next);
    if (!transform) return next;
    const vectorName = transformMatch[1] as 'position' | 'rotation' | 'scale';
    const axis = transformMatch[2] as 'x' | 'y' | 'z';
    const storedValue = vectorName === 'rotation' ? degreesToRadians(value) : value;
    if (vectorName === 'scale') transform.scale = { ...readTransformVector(transform, 'scale'), [axis]: storedValue };
    else transform[vectorName] = { ...transform[vectorName], [axis]: storedValue };
    return next;
  }
  if (path.startsWith('groundDecal.')) {
    next.kind = 'transform';
    next.transformType = next.transformType ?? 'groundDecal';
    next.groundDecal = mergeGroundDecalDefaults(next.groundDecal);
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    return next;
  }
  if (path.startsWith('overrides.')) {
    if (readEditorSceneNodeKind(next) === 'group') next.kind = 'instance';
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    return next;
  }
  return next;
}

function applyJsonFieldPatch(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.').filter(Boolean);
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  const leaf = segments[segments.length - 1];
  if (!leaf) return;
  if (value == null) delete cursor[leaf];
  else cursor[leaf] = structuredClone(value);
}

function createDefaultGroundDecal(): NonNullable<EditorSceneGameObject['groundDecal']> {
  return {
    size: { width: 1, depth: 1 },
    color: { r: 1, g: 1, b: 1 },
  };
}

function mergeGroundDecalDefaults(
  groundDecal: EditorSceneGameObject['groundDecal'],
): NonNullable<EditorSceneGameObject['groundDecal']> {
  const defaults = createDefaultGroundDecal();
  return {
    ...defaults,
    ...(groundDecal ?? {}),
    size: {
      ...defaults.size,
      ...(groundDecal?.size ?? {}),
    },
    color: groundDecal?.color
      ? { ...defaults.color, ...groundDecal.color }
      : defaults.color,
  };
}

function resolveProjectedMaterialRuntimeKind(root: unknown): string | null {
  const material = findProjectedRuntimeMaterial(root);
  const className = readRuntimeClassName(material);
  if (!className) return null;
  if (className.includes('PBR')) return 'pbr';
  if (className.includes('Standard')) return 'standard';
  return className;
}

function findProjectedRuntimeMaterial(root: unknown): unknown {
  const record = isObjectRecord(root) ? root : null;
  const directMaterial = record?.material;
  if (directMaterial) return directMaterial;
  const getChildMeshes = record?.getChildMeshes;
  if (typeof getChildMeshes === 'function') {
    const meshes = getChildMeshes.call(root, false);
    if (Array.isArray(meshes)) {
      const mesh = meshes.find((candidate) => isObjectRecord(candidate) && !!candidate.material);
      if (isObjectRecord(mesh)) return mesh.material;
    }
  }
  return null;
}

function readRuntimeClassName(value: unknown): string | null {
  if (!isObjectRecord(value)) return null;
  const getClassName = value.getClassName;
  if (typeof getClassName === 'function') {
    const className = getClassName.call(value);
    if (typeof className === 'string' && className.trim()) return className;
  }
  const constructorName = value.constructor && typeof value.constructor === 'function'
    ? value.constructor.name
    : '';
  return constructorName && constructorName !== 'Object' ? constructorName : null;
}

function isObjectRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object';
}

export function applyEditorSceneSerializedPropertyPatch(
  document: EditorSceneDocument,
  patch: SerializedPropertyPatch,
): EditorSceneDocument {
  const gameObject = document.scene.gameObjects.find((entry) => entry.id === patch.targetId);
  if (!gameObject) return document;
  return applySerializedPropertyPatch(
    document,
    createEditorScenePropertyDescriptors(gameObject),
    patch,
  );
}

export function addAssetLibraryItemToEditorSceneDocument(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
): { document: EditorSceneDocument; gameObject: EditorSceneGameObject } {
  const existingAsset = document.assets.find((asset) => asset.sourceId === assetItem.sourceId);
  const asset = existingAsset
    ? mergeEditorSceneAssetWithLibraryItem(existingAsset, assetItem)
    : createEditorSceneAssetFromLibraryItem(document, assetItem);
  const gameObject = createGameObjectForAsset(document, assetItem, asset.id);
  return {
    document: {
      ...document,
      assets: existingAsset
        ? document.assets.map((candidate) => candidate.id === asset.id ? asset : candidate)
        : [...document.assets, asset],
      scene: {
        ...document.scene,
        gameObjects: [...document.scene.gameObjects, gameObject],
      },
    },
    gameObject,
  };
}

function createEditorScenePropertyDescriptors(
  gameObject: EditorSceneGameObject,
): SerializedPropertyDescriptor<EditorSceneDocument>[] {
  const descriptors: SerializedPropertyDescriptor<EditorSceneDocument>[] = [
    {
      path: 'gameObject.id',
      label: 'ID',
      valueType: 'string',
      readOnly: true,
      getValue: () => gameObject.id,
    },
    {
      path: 'gameObject.name',
      label: 'Name',
      valueType: 'string',
      readOnly: true,
      getValue: () => gameObject.name ?? gameObject.id,
    },
  ];
  const transform = findEditorSceneTransform(gameObject);
  if (transform) {
    for (const vectorName of ['position', 'rotation', 'scale'] as const) {
      for (const axis of ['x', 'y', 'z'] as const) {
        descriptors.push({
          path: `transform.${vectorName}.${axis}`,
          label: `${vectorName}.${axis}`,
          valueType: 'number',
          getValue: () => {
            const value = readTransformVector(transform, vectorName)[axis];
            return vectorName === 'rotation' ? roundForInspector(radiansToDegrees(value)) : value;
          },
          setValue: (document, value, context) => {
            const targetId = context.targetId;
            const numericValue = Number(value);
            if (!targetId || !Number.isFinite(numericValue)) return document;
            const target = document.scene.gameObjects.find((entry) => entry.id === targetId);
            const targetTransform = target ? findEditorSceneTransform(target) : null;
            if (!targetTransform) return document;
            const storedValue = vectorName === 'rotation' ? degreesToRadians(numericValue) : numericValue;
            const position = vectorName === 'position'
              ? { ...targetTransform.position, [axis]: storedValue }
              : targetTransform.position;
            const rotation = vectorName === 'rotation'
              ? { ...targetTransform.rotation, [axis]: storedValue }
              : targetTransform.rotation;
            const scale = vectorName === 'scale'
              ? { ...readTransformVector(targetTransform, 'scale'), [axis]: storedValue }
              : readTransformVector(targetTransform, 'scale');
            return patchEditorSceneGameObjectTransform(document, targetId, {
              position,
              rotation,
              scale,
            });
          },
        });
      }
    }
  }
  const renderer = findEditorSceneModelRenderer(gameObject);
  if (renderer) {
    descriptors.push({
      path: 'modelRenderer.assetId',
      label: 'Asset ID',
      valueType: 'asset',
      readOnly: true,
      getValue: () => renderer.assetId,
    });
  }
  return descriptors;
}

function createEditorSceneMultiTransformProperties(
  gameObjects: EditorSceneGameObject[],
): SerializedMultiObject<EditorSceneDocument>['properties'] {
  const properties: SerializedMultiObject<EditorSceneDocument>['properties'] = [];
  for (const vectorName of ['position', 'rotation', 'scale'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      const values = gameObjects
        .map((gameObject) => {
          const transform = findEditorSceneTransform(gameObject);
          return transform ? readTransformVector(transform, vectorName)[axis] : null;
        })
        .filter((value): value is number => typeof value === 'number');
      if (values.length !== gameObjects.length) continue;
      const displayValues = vectorName === 'rotation'
        ? values.map(radiansToDegrees)
        : values;
      const firstValue = displayValues[0] ?? 0;
      const mixed = displayValues.some((value) => Math.abs(value - firstValue) > 0.000001);
      properties.push({
        path: `transform.${vectorName}.${axis}`,
        label: `${vectorName}.${axis}`,
        valueType: 'number',
        value: roundForInspector(firstValue),
        mixed,
        readOnly: false,
        descriptor: {
          path: `transform.${vectorName}.${axis}`,
          valueType: 'number',
          getValue: () => firstValue,
        },
      });
    }
  }
  return properties;
}

function readTransformVector(
  transform: { position: EditorSceneVec3; rotation: EditorSceneVec3; scale?: EditorSceneVec3 },
  vectorName: 'position' | 'rotation' | 'scale',
): EditorSceneVec3 {
  if (vectorName === 'scale') return transform.scale ?? { x: 1, y: 1, z: 1 };
  return transform[vectorName];
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundForInspector(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function createEditorSceneAssetFromLibraryItem(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
): EditorSceneAsset {
  const preferredAssetId = assetItem.assetId || `asset_${sanitizeEditorSceneId(assetItem.sourceId)}`;
  return {
    id: createUniqueEditorSceneId(document.assets.map((asset) => asset.id), preferredAssetId),
    type: assetItem.type,
    sourceId: assetItem.sourceId,
    displayName: assetItem.displayName,
    category: assetItem.category,
    materialMode: assetItem.materialMode,
    defaults: assetItem.defaults ? structuredClone(assetItem.defaults) : undefined,
    metadata: assetItem.metadata ? structuredClone(assetItem.metadata) : undefined,
  };
}

function createGameObjectForAsset(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
  assetId: string,
): EditorSceneGameObject {
  const usedIds = document.scene.gameObjects.map((gameObject) => gameObject.id);
  const id = createUniqueEditorSceneId(usedIds, sanitizeEditorSceneId(assetItem.sourceId));
  return {
    id,
    name: assetItem.displayName,
    active: true,
    components: [
      {
        type: 'Transform',
        position: getNextPlacementPosition(document),
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      {
        type: 'ModelRenderer',
        assetId,
      },
    ],
  };
}

function getNextPlacementPosition(document: EditorSceneDocument): EditorSceneVec3 {
  const renderableCount = document.scene.gameObjects.filter((gameObject) => findEditorSceneModelRenderer(gameObject)).length;
  return {
    x: (renderableCount % 5) * 1.8 - 3.6,
    y: 0,
    z: Math.floor(renderableCount / 5) * 1.8 + 1.8,
  };
}

function createUniqueEditorSceneId(existingIds: string[], preferredId: string): string {
  const used = new Set(existingIds);
  const base = sanitizeEditorSceneId(preferredId) || 'game_object';
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function sanitizeEditorSceneId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'asset';
}
