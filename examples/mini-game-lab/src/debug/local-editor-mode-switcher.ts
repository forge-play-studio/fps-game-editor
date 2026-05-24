import {
  createLocalEditorHarness,
  type LocalEditorHarness,
  type LocalEditorHarnessMultiPropertyInput,
  type LocalEditorHarnessPropertyInput,
  type LocalEditorHarnessTransformBatchInput,
  type LocalEditorHarnessTransformInput,
} from '@fps-games/editor';
import { createProjectAuthoringHost, type EditorTransformSnapshot } from '@fps-games/editor-core';
import type {
  BabylonEditorProjectionImportContext,
  BabylonEditorProjectionImportResult,
  BabylonEditorProjectionNode,
  BabylonSceneCameraPreviewRig,
} from '@fps-games/editor-babylon';
import baseSceneConfig from '../config/scene.json';
import type { SceneAssetConfig, SceneConfig } from '../config/types';
import type { EditorSceneDocument } from '../fps-game-editor-adapter/editor-scene-document';
import {
  findEditorSceneModelRenderer,
  findEditorSceneTransform,
  type EditorSceneAssetLibraryItem,
  type EditorSceneGameObject,
} from '../fps-game-editor-adapter/editor-scene-document';
import { enrichEditorSceneDocumentAssets } from '../fps-game-editor-adapter/editor-asset-library';
import {
  collectEditorSceneSubtreeIdList,
  createEditorSceneCreateGroupPatch,
  createEditorSceneDeleteSubtreePatch,
  createEditorSceneDuplicateSelectionPatch,
  createEditorSceneGroupSelectionPatch,
  createEditorSceneHierarchyMovePatch,
  createEditorSceneInspectorPropertyPatch,
  createEditorScenePlacedAssetPatch,
  createEditorSceneRenamePatch,
  createEditorSceneReparentPatch,
  DEFAULT_EDITOR_SCENE_CAMERA,
  ensureEditorSceneEnvironmentDefaults,
  getEditorSceneHierarchyItems,
  getEditorSceneInspectorMultiObject,
  getEditorSceneInspectorObject,
  getEditorSceneRuntimeInspectorSections,
  getEditorSceneSerializedObject,
  getEditorSceneSerializedMultiObject,
  getEditorSceneGameObjectWorldTransform,
  normalizeEditorSceneHierarchyDocument,
  isEditorSceneCameraGameObject,
  isEditorSceneLightGameObject,
  reduceEditorSceneDocument,
  toEditorSceneLocalTransformFromWorld,
  validateEditorSceneGroupSelection,
  validateEditorSceneHierarchyMove,
  validateEditorSceneReparent,
  type EditorSceneDocumentPatch,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  createSceneMainSourceDriver,
  loadEditorAssetLibrary,
  loadSceneMainSource,
  saveSceneMainSource,
} from '../fps-game-editor-adapter/scene-main-source-driver';
import { compileEditorSceneDocumentToSceneConfig } from '../fps-game-editor-adapter/editor-scene-compiler';
import {
  planAssetRegistrationWithAssets,
  type AssetTransportPlan,
} from '../services/AssetManager';

type BabylonModule = Record<string, any>;

export interface LocalEditorModeSwitcherOptions {
  root?: HTMLElement;
  localTestActions?: boolean;
  disposeGameWorld: () => void;
  onBeforeReload?: () => void;
}

export interface LocalEditorModeSwitcher {
  enterEditor(): Promise<void>;
  discardAndRunGame(): Promise<void>;
  dispose(): void;
}

export function mountLocalEditorModeSwitcher(options: LocalEditorModeSwitcherOptions): LocalEditorModeSwitcher {
  const sceneMainSourceDriver = createSceneMainSourceDriver();
  const authoringHost = createProjectAuthoringHost({
    drivers: [sceneMainSourceDriver],
  });
  const harness: LocalEditorHarness<EditorSceneDocument> = createLocalEditorHarness<EditorSceneDocument, EditorSceneDocumentPatch, EditorSceneAssetLibraryItem>({
    root: options.root,
    localTestActions: options.localTestActions === true,
    authoringHost,
    documentAdapter: {
      prepareDocument: (document, assets) => normalizeEditorSceneHierarchyDocument(
        ensureEditorSceneEnvironmentDefaults(enrichEditorSceneDocumentAssets(document, assets)),
      ),
      reduceDocument: reduceEditorSceneDocument,
      getSerializedObject: getEditorSceneSerializedObject,
      getSerializedMultiObject: getEditorSceneSerializedMultiObject,
      getInspectorObject: getEditorSceneInspectorObject,
      getInspectorMultiObject: getEditorSceneInspectorMultiObject,
      getRuntimeInspectorSections: getEditorSceneRuntimeInspectorSections,
      getHierarchyItems: getEditorSceneHierarchyItems,
      getProjectionNodes: createProjectionNodes,
      getProjectionNode: (document, id) => {
        const gameObject = document.scene.gameObjects.find((entry) => entry.id === id);
        return gameObject ? createProjectionNode(document, gameObject) : null;
      },
      getSceneCameraPreviewRig: createSceneCameraPreviewRig,
      isSelectable: (_document, id) => id !== 'mvp_root',
      isLocked: () => false,
      createPatchFromAsset: (assetItem, input) => ({
        label: `Add ${assetItem.displayName}`,
        patch: {
          kind: 'game-object.create-from-asset',
          assetItem,
          ...(input?.placement ? { placement: input.placement } : {}),
        },
      }),
      createPlacedAssetPatch: createEditorScenePlacedAssetPatch,
      findCreatedId: (beforeDocument, afterDocument) => {
        const beforeIds = new Set(beforeDocument.scene.gameObjects.map((gameObject) => gameObject.id));
        return afterDocument.scene.gameObjects.find((gameObject) => !beforeIds.has(gameObject.id))?.id ?? null;
      },
      createSerializedPropertyPatch: createEditorSceneSerializedPropertyPatch,
      createSerializedMultiPropertyPatch: createEditorSceneSerializedMultiPropertyPatch,
      createTransformPatch: createEditorSceneTransformPatch,
      createTransformBatchPatch: createEditorSceneTransformBatchPatch,
      createDuplicateSelectionPatch: createEditorSceneDuplicateSelectionPatch,
      validateSceneGraphDrop: validateEditorSceneReparent,
      validateSceneGraphMove: validateEditorSceneHierarchyMove,
      validateSceneGraphGroupSelection: validateEditorSceneGroupSelection,
      createSceneGraphRenamePatch: createEditorSceneRenamePatch,
      createSceneGraphCreateGroupPatch: createEditorSceneCreateGroupPatch,
      createSceneGraphDeletePatch: createEditorSceneDeleteSubtreePatch,
      createSceneGraphDropPatch: createEditorSceneReparentPatch,
      createSceneGraphMovePatch: createEditorSceneHierarchyMovePatch,
      createSceneGraphGroupSelectionPatch: createEditorSceneGroupSelectionPatch,
      summarize: summarizeEditorScene,
    },
    persistenceAdapter: {
      async loadAuthoringSource() {
        const loaded = await loadSceneMainSource();
        authoringHost.registerSource(loaded.source);
        return {
          source: loaded.source,
          document: loaded.document,
          summary: loaded.summary,
        };
      },
      loadAssets: loadEditorAssetLibrary,
      runGame() {
        options.onBeforeReload?.();
        window.location.reload();
      },
    },
    worldAdapter: {
      disposeGameWorld: options.disposeGameWorld,
      getCanvas() {
        const canvas = document.getElementById('renderCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return null;
        return canvas;
      },
      loadBabylon: () => import('@babylonjs/core') as Promise<BabylonModule>,
      createEngine(babylon, canvas) {
        return new babylon.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
          antialias: true,
        });
      },
      importProjectionModel: importEditorProjectionModel,
      resolveAssetId: asset => asset.sourceId,
      toBrowserAssetItem(asset) {
        return {
          id: asset.sourceId,
          label: asset.displayName,
          meta: asset.sourceId,
          disabled: asset.placeable === false,
        };
      },
    },
    world: {
      cameraTarget: { x: 0, y: 0.6, z: 0 },
      cameraRadius: 12,
      clearColor: { r: 0.055, g: 0.07, b: 0.09, a: 1 },
      useRightHandedSystem: true,
    },
    createGrid: createEditorGrid,
  });

  const disposeForgePlayBridge = installForgePlayModeBridge(harness);

  return {
    enterEditor: () => harness.enterEditor(),
    discardAndRunGame: () => harness.discardAndRunGame(),
    dispose() {
      disposeForgePlayBridge();
      harness.dispose();
    },
  };
}

function createEditorGrid(BABYLON: BabylonModule, scene: any): void {
  if (!scene || !BABYLON.MeshBuilder || !BABYLON.Vector3 || !BABYLON.Color3) return;

  const gridSize = 24;
  const gridColor = new BABYLON.Color3(0.18, 0.27, 0.42);
  const axisXColor = new BABYLON.Color3(0.8, 0.22, 0.22);
  const axisZColor = new BABYLON.Color3(0.22, 0.55, 0.85);
  for (let i = -gridSize; i <= gridSize; i += 1) {
    const xLine = BABYLON.MeshBuilder.CreateLines(`editor-grid-x-${i}`, {
      points: [new BABYLON.Vector3(-gridSize, 0, i), new BABYLON.Vector3(gridSize, 0, i)],
    }, scene);
    xLine.color = i === 0 ? axisXColor : gridColor;
    const zLine = BABYLON.MeshBuilder.CreateLines(`editor-grid-z-${i}`, {
      points: [new BABYLON.Vector3(i, 0, -gridSize), new BABYLON.Vector3(i, 0, gridSize)],
    }, scene);
    zLine.color = i === 0 ? axisZColor : gridColor;
  }
}

export function createProjectionNodes(editorScene: EditorSceneDocument): BabylonEditorProjectionNode[] {
  return editorScene.scene.gameObjects.map((gameObject) => createProjectionNode(editorScene, gameObject));
}

export function createProjectionNode(
  editorScene: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): BabylonEditorProjectionNode {
  const transform = findEditorSceneTransform(gameObject);
  const worldTransform = getEditorSceneGameObjectWorldTransform(editorScene, gameObject.id);
  const renderer = findEditorSceneModelRenderer(gameObject);
  const asset = renderer
    ? editorScene.assets.find((entry) => entry.id === renderer.assetId)
    : undefined;
  const runtimeKind = isEditorSceneCameraGameObject(gameObject)
    ? 'camera'
    : isEditorSceneLightGameObject(gameObject)
      ? 'light'
      : undefined;
  return {
    id: gameObject.id,
    name: gameObject.name ?? gameObject.id,
    parentId: gameObject.parentId ?? null,
    active: gameObject.active,
    ...(runtimeKind ? { runtimeKind } : {}),
    ...(gameObject.camera ? { camera: structuredClone(gameObject.camera) } : {}),
    ...(gameObject.light ? { light: structuredClone(gameObject.light) } : {}),
    transform: transform && worldTransform
      ? {
          position: worldTransform.position,
          rotation: worldTransform.rotation,
          scale: worldTransform.scale,
        }
      : undefined,
    asset: asset
      ? {
          id: asset.id,
          sourceId: asset.sourceId,
          transform: asset.defaults?.transform,
          metadata: asset.metadata,
        }
      : null,
  };
}

export function createSceneCameraPreviewRig(
  editorScene: EditorSceneDocument,
): BabylonSceneCameraPreviewRig | null {
  const camera = editorScene.scene.gameObjects.find(isEditorSceneCameraGameObject);
  if (!camera || camera.active === false) return null;
  return {
    target: { x: 0, y: 0, z: 0 },
    settings: {
      ...DEFAULT_EDITOR_SCENE_CAMERA,
      ...(camera.camera ?? {}),
    },
  };
}

async function importEditorProjectionModel(
  context: BabylonEditorProjectionImportContext,
): Promise<BabylonEditorProjectionImportResult | null> {
  const sourceId = context.asset.sourceId;
  if (!sourceId) return null;
  await import('@babylonjs/loaders/glTF');
  const [{ SceneLoader }, assetsModule] = await Promise.all([
    import('@babylonjs/core/Loading/sceneLoader'),
    import('../assets'),
  ]);
  const url = assetsModule.resolveModelUrl(sourceId);
  if (!url) throw new Error(`model url not found for sourceId "${sourceId}"`);
  const pathInfo = await assetsModule.getModelPathAndFileAsync(url);
  return SceneLoader.ImportMeshAsync(
    '',
    pathInfo.path,
    pathInfo.filename,
    context.scene,
    undefined,
    pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined,
  );
}

function createEditorSceneSerializedPropertyPatch(
  input: LocalEditorHarnessPropertyInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  return createEditorSceneInspectorPropertyPatch(input);
}

function createEditorSceneSerializedMultiPropertyPatch(
  input: LocalEditorHarnessMultiPropertyInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const serializedPath = input.path;
  const value = Number(input.value);
  if (input.targetIds.length === 0 || !serializedPath || !Number.isFinite(value)) return null;
  if (input.targetIds.some((targetId) => isUnsafeGroupRotationOrScale(input.document, targetId, serializedPath))) return null;
  const transform = createTransformFromSerializedPath(serializedPath, value);
  if (!transform) return null;
  return {
    label: `Patch ${serializedPath} on ${input.targetIds.length} objects`,
    patch: {
      kind: 'game-object.transform-batch',
      targets: input.targetIds.map((targetId) => ({
        targetId,
        transform,
      })),
    },
    changedIds: serializedPath.startsWith('transform.')
      ? collectEditorSceneSubtreeIdList(input.document, input.targetIds)
      : input.targetIds,
  };
}

function createEditorSceneTransformPatch(
  input: LocalEditorHarnessTransformInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[] } | null {
  const transform = toEditorSceneLocalTransformFromWorld(input.document, input.targetId, input.after);
  if (!transform) return null;
  if (input.tool !== 'move' && hasEditorSceneDescendants(input.document, input.targetId)) return null;
  return {
    label: `${input.tool} ${input.targetId}`,
    patch: {
      kind: 'game-object.transform',
      targetId: input.targetId,
      transform,
    },
    changedId: input.targetId,
    changedIds: collectEditorSceneSubtreeIdList(input.document, [input.targetId]),
  };
}

function createEditorSceneTransformBatchPatch(
  input: LocalEditorHarnessTransformBatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  if (input.targets.length === 0) return null;
  if (hasAncestorDescendantPair(input.document, input.targets.map((target) => target.id))) return null;
  if (input.tool !== 'move' && input.targets.some((target) => hasEditorSceneDescendants(input.document, target.id))) return null;
  const targets = input.targets.flatMap((target) => {
    const transform = toEditorSceneLocalTransformFromWorld(input.document, target.id, target.after);
    return transform ? [{ targetId: target.id, transform }] : [];
  });
  if (targets.length !== input.targets.length) return null;
  return {
    label: `${input.tool} ${input.targets.length} objects`,
    patch: {
      kind: 'game-object.transform-batch',
      targets,
    },
    changedIds: collectEditorSceneSubtreeIdList(input.document, input.targets.map((target) => target.id)),
  };
}

function isUnsafeGroupRotationOrScale(
  editorScene: EditorSceneDocument,
  targetId: string,
  serializedPath: string,
): boolean {
  if (!serializedPath.startsWith('transform.rotation.') && !serializedPath.startsWith('transform.scale.')) {
    return false;
  }
  return hasEditorSceneDescendants(editorScene, targetId);
}

function hasEditorSceneDescendants(editorScene: EditorSceneDocument, targetId: string): boolean {
  return collectEditorSceneSubtreeIdList(editorScene, [targetId]).length > 1;
}

function hasAncestorDescendantPair(editorScene: EditorSceneDocument, ids: string[]): boolean {
  const selected = new Set(ids);
  const byId = new Map(editorScene.scene.gameObjects.map((gameObject) => [gameObject.id, gameObject]));
  for (const id of ids) {
    const seen = new Set<string>();
    let cursor = byId.get(id);
    while (cursor?.parentId && !seen.has(cursor.parentId)) {
      if (selected.has(cursor.parentId)) return true;
      seen.add(cursor.parentId);
      cursor = byId.get(cursor.parentId);
    }
  }
  return false;
}

function createTransformFromSerializedPath(
  path: string,
  value: number,
): Partial<EditorTransformSnapshot> | null {
  const match = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (!match) return null;
  const vectorName = match[1] as 'position' | 'rotation' | 'scale';
  const axis = match[2] as 'x' | 'y' | 'z';
  const storedValue = vectorName === 'rotation' ? (value * Math.PI) / 180 : value;
  const vector = { [axis]: storedValue };
  return { [vectorName]: vector };
}

const FORGE_PLAY_BRIDGE_SOURCE = 'forge-play-game-bridge';
const FORGE_PLAY_POST_MESSAGE = {
  EVENT: 'event',
  COMMAND: 'command',
} as const;
const FORGE_PLAY_COMMAND = {
  MODE_CHANGE: 'mode.change',
  DOCUMENT_EXPORT: 'document.export',
  DOCUMENT_COMMIT: 'document.commit',
  ASSET_LIBRARY_REFRESH: 'asset.library.refresh',
  ASSET_IMPORT: 'asset.import',
  EDITOR_ASSET_PLACE: 'editor.asset.place',
} as const;
const FORGE_PLAY_EVENT = {
  SCENE_READY: 'scene.ready',
  FIRST_FRAME: 'scene.first_frame',
  MODE_CHANGE: 'mode.change',
  DOCUMENT_EXPORTED: 'document.exported',
  ASSET_LIBRARY_REFRESHED: 'asset.library.refreshed',
  ASSET_IMPORT_RESULT: 'asset.import.result',
  EDITOR_ASSET_PLACE_RESULT: 'editor.asset.place.result',
  SYSTEM_ERROR: 'system.error',
} as const;

function postForgePlayEvent(name: string, payload: Record<string, unknown> = {}): void {
  if (window.parent === window) return;
  window.parent.postMessage({
    source: FORGE_PLAY_BRIDGE_SOURCE,
    type: FORGE_PLAY_POST_MESSAGE.EVENT,
    payload: { name, ...payload },
    timestamp: Date.now(),
  }, '*');
}

function installForgePlayModeBridge(harness: LocalEditorHarness): () => void {
  let currentMode: 'play' | 'edit' = 'play';
  let inFlight: Promise<void> | null = null;
  const saveState = {
    preparedRevision: 0,
    committedRevision: 0,
  };

  function reportModeChangeError(error: unknown, fallbackMode: 'play' | 'edit'): void {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error('[LocalEditorModeSwitcher] Forge Play mode change failed', error);
    postForgePlayEvent(FORGE_PLAY_EVENT.SYSTEM_ERROR, {
      kind: 'rejection',
      message: messageText,
    });
    postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: fallbackMode });
  }

  async function switchMode(mode: 'play' | 'edit', options: { save?: boolean } = {}): Promise<void> {
    if (currentMode === mode) {
      postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode });
      return;
    }

    if (inFlight) await inFlight;
    if (currentMode === mode) {
      postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode });
      return;
    }
    inFlight = (async () => {
      if (mode === 'edit') {
        saveState.preparedRevision = 0;
        saveState.committedRevision = 0;
        await harness.enterEditor();
        currentMode = 'edit';
        postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: 'edit' });
        return;
      }

      if (options.save === true) {
        const platformCommitAlreadySaved = saveState.preparedRevision > 0
          && saveState.preparedRevision === saveState.committedRevision;
        if (!platformCommitAlreadySaved) {
          const saved = await harness.saveScene();
          if (!saved) {
            reportModeChangeError(new Error('save_failed'), 'edit');
            return;
          }
        }
      }

      await harness.discardAndRunGame();
      currentMode = 'play';
      postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: 'play' });
    })();

    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  }

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if ((message as { source?: string }).source !== FORGE_PLAY_BRIDGE_SOURCE) return;
    if ((message as { type?: string }).type !== FORGE_PLAY_POST_MESSAGE.COMMAND) return;

    const payload = (message as { payload?: Record<string, unknown> }).payload;
    if (!payload) return;
    if (payload.name === FORGE_PLAY_COMMAND.DOCUMENT_EXPORT) {
      void exportForgePlayDocument(harness, payload, saveState).catch((error) => {
        postForgePlayDocumentExportError(payload, error);
      });
      return;
    }
    if (payload.name === FORGE_PLAY_COMMAND.DOCUMENT_COMMIT) {
      if (saveState.preparedRevision > 0) {
        saveState.committedRevision = saveState.preparedRevision;
      }
      return;
    }
    if (payload.name === FORGE_PLAY_COMMAND.ASSET_LIBRARY_REFRESH) {
      void refreshForgePlayAssetLibrary(harness, payload).catch((error) => {
        postForgePlayAssetRefreshError(payload, error);
      });
      return;
    }
    if (payload.name === FORGE_PLAY_COMMAND.ASSET_IMPORT || payload.name === FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE) {
      void placeForgePlayEditorAsset(harness, payload).catch((error) => {
        postForgePlayAssetPlaceError(payload, error);
      });
      return;
    }
    if (payload.name !== FORGE_PLAY_COMMAND.MODE_CHANGE) return;

    const mode = payload.mode === 'edit' ? 'edit' : payload.mode === 'play' ? 'play' : null;
    if (!mode) return;
    const save = payload.save === true;

    void switchMode(mode, { save }).catch((error) => {
      reportModeChangeError(error, currentMode);
    });
  };

  window.addEventListener('message', onMessage);
  queueMicrotask(() => {
    postForgePlayEvent(FORGE_PLAY_EVENT.SCENE_READY, { mode: currentMode });
    postForgePlayEvent(FORGE_PLAY_EVENT.FIRST_FRAME);
    postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: currentMode });
  });

  return () => {
    window.removeEventListener('message', onMessage);
  };
}

async function refreshForgePlayAssetLibrary(
  harness: LocalEditorHarness,
  payload: Record<string, unknown>,
): Promise<void> {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const refreshed = await harness.reloadAssets();
  postForgePlayEvent(FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED, {
    ...(requestId ? { requestId } : {}),
    ok: refreshed.ok,
    assetCount: refreshed.assetCount,
    status: refreshed.status,
    ...(refreshed.error ? { error: refreshed.error } : {}),
  });
}

async function placeForgePlayEditorAsset(
  harness: LocalEditorHarness,
  payload: Record<string, unknown>,
): Promise<void> {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const registered = await registerForgePlayAssetIfNeeded(harness, payload);
  const refresh = await harness.reloadAssets();
  if (!refresh.ok) {
    postForgePlayAssetPlaceFailure(payload, {
      ok: false,
      code: 'asset_library_refresh_failed',
      error: refresh.error ?? refresh.status,
    });
    return;
  }

  const assetId = resolveForgePlayAssetCommandId(payload, registered);
  if (!assetId) {
    postForgePlayAssetPlaceFailure(payload, {
      ok: false,
      code: 'asset_id_missing',
      error: 'Asset command requires assetId, sourceId, assetName, or assetPath.',
    });
    return;
  }

  const result = harness.createAssetFromAssetId(assetId, {
    placement: readForgePlayAssetPlacement(payload),
  });
  const eventName = payload.name === FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE
    ? FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT
    : FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT;
  postForgePlayEvent(eventName, {
    ...(requestId ? { requestId } : {}),
    ok: result.ok,
    assetId: result.assetId,
    ...(registered.sourceId ? { sourceId: registered.sourceId } : {}),
    ...(registered.assetUrl ? { assetUrl: registered.assetUrl } : {}),
    registered: registered.registered,
    changed: result.changed,
    status: result.status,
    ...(result.createdId ? { nodeId: result.createdId, createdId: result.createdId } : {}),
    ...(result.error ? { error: result.error, code: result.error } : {}),
    assetCount: refresh.assetCount,
  });
}

async function registerForgePlayAssetIfNeeded(
  harness: LocalEditorHarness,
  payload: Record<string, unknown>,
): Promise<{ registered: boolean; sourceId?: string; assetId?: string; assetUrl?: string }> {
  const assetPath = readNonEmptyString(payload.assetPath);
  if (!assetPath) return { registered: false };

  const plan = planAssetRegistrationWithAssets(await loadForgePlayAssetCatalogSnapshot(harness), {
    requestId: readNonEmptyString(payload.requestId) ?? undefined,
    assetPath,
    assetName: readNonEmptyString(payload.assetName) ?? undefined,
    sourceId: readNonEmptyString(payload.sourceId) ?? undefined,
    assetId: readNonEmptyString(payload.assetId) ?? undefined,
    displayName: readNonEmptyString(payload.displayName) ?? undefined,
    category: readNonEmptyString(payload.category) ?? undefined,
    materialMode: payload.materialMode as any,
    scale: payload.scale as any,
    defaultScale: payload.defaultScale as any,
    metadata: readRecord(payload.metadata),
  });
  const result = await executeForgePlayAssetTransportPlan(plan.transportPlan);
  return {
    registered: true,
    sourceId: readNonEmptyString(result.sourceId) ?? plan.sourceId,
    assetId: readNonEmptyString(result.assetId) ?? plan.assetId,
    assetUrl: readNonEmptyString(result.assetUrl) ?? undefined,
  };
}

async function loadForgePlayAssetCatalogSnapshot(harness: LocalEditorHarness): Promise<SceneAssetConfig[]> {
  const assetsById = new Map<string, SceneAssetConfig>();
  const workingDocument = harness.getWorkingDocument() as EditorSceneDocument | null;
  for (const asset of workingDocument?.assets ?? []) {
    assetsById.set(asset.id, {
      id: asset.id,
      type: asset.type,
      sourceId: asset.sourceId,
      ...(asset.displayName ? { displayName: asset.displayName } : {}),
      ...(asset.category ? { category: asset.category } : {}),
      ...(asset.materialMode ? { materialMode: asset.materialMode } : {}),
      ...(asset.defaults ? { defaults: structuredClone(asset.defaults) } : {}),
      ...(asset.metadata ? { metadata: structuredClone(asset.metadata) } : {}),
    });
  }
  for (const asset of await loadEditorAssetLibrary()) {
    assetsById.set(asset.assetId, {
      id: asset.assetId,
      type: asset.type,
      sourceId: asset.sourceId,
      displayName: asset.displayName,
      ...(asset.category ? { category: asset.category } : {}),
      ...(asset.materialMode ? { materialMode: asset.materialMode } : {}),
      ...(asset.defaults ? { defaults: structuredClone(asset.defaults) } : {}),
      ...(asset.metadata ? { metadata: structuredClone(asset.metadata) } : {}),
    });
  }
  return [...assetsById.values()];
}

async function executeForgePlayAssetTransportPlan(plan: AssetTransportPlan): Promise<Record<string, unknown>> {
  let lastResult: Record<string, unknown> = {};
  for (const write of plan.writes) {
    const response = await fetch('/__fps_editor_authoring/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: write.path, content: write.content }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(readNonEmptyString(json.error) ?? `asset_transport_write_failed:${response.status}`);
    lastResult = json;
  }
  for (const command of plan.commands) {
    const response = await fetch('/__fps_editor_authoring/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: command.cmd, cwd: command.cwd }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(readNonEmptyString(json.error) ?? `asset_transport_command_failed:${response.status}`);
    const result = readRecord(json.result) ?? {};
    lastResult = { ...json, ...result };
  }
  return lastResult;
}

function postForgePlayAssetRefreshError(payload: Record<string, unknown>, error: unknown): void {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  postForgePlayEvent(FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED, {
    ...(requestId ? { requestId } : {}),
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

function postForgePlayAssetPlaceError(payload: Record<string, unknown>, error: unknown): void {
  postForgePlayAssetPlaceFailure(payload, {
    ok: false,
    code: 'asset_place_failed',
    error: error instanceof Error ? error.message : String(error),
  });
}

function postForgePlayAssetPlaceFailure(
  payload: Record<string, unknown>,
  failure: { ok: false; code: string; error: string },
): void {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const eventName = payload.name === FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE
    ? FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT
    : FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT;
  postForgePlayEvent(eventName, {
    ...(requestId ? { requestId } : {}),
    ...failure,
  });
}

function resolveForgePlayAssetCommandId(
  payload: Record<string, unknown>,
  registered: { sourceId?: string; assetId?: string } = {},
): string | null {
  const registeredSourceId = readNonEmptyString(registered.sourceId);
  if (registeredSourceId) return sanitizeEditorAssetCommandId(registeredSourceId);
  const sourceId = readNonEmptyString(payload.sourceId);
  if (sourceId) return sanitizeEditorAssetCommandId(sourceId);
  const assetId = readNonEmptyString(payload.assetId) ?? readNonEmptyString(registered.assetId);
  if (assetId) return sanitizeEditorAssetCommandId(assetId.replace(/^asset_/i, ''));
  const assetName = readNonEmptyString(payload.assetName);
  if (assetName) return sanitizeEditorAssetCommandId(assetName.replace(/\.glb$/i, ''));
  const assetPath = readNonEmptyString(payload.assetPath);
  if (assetPath) return sanitizeEditorAssetCommandId((assetPath.split('/').pop() ?? assetPath).replace(/\.glb$/i, ''));
  return null;
}

function sanitizeEditorAssetCommandId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readForgePlayAssetPlacement(payload: Record<string, unknown>): EditorTransformSnapshot | undefined {
  const position = readVec3(payload.position);
  if (!position) return undefined;
  return {
    position,
    rotation: readVec3(payload.rotation) ?? readRotationDeg(payload.rotationDeg) ?? { x: 0, y: 0, z: 0 },
    scale: readPositiveVec3(payload.instanceScale) ?? readPositiveVec3(payload.scale) ?? { x: 1, y: 1, z: 1 },
  };
}

function readVec3(value: unknown): EditorTransformSnapshot['position'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const x = readFiniteNumber(record.x);
  const y = readFiniteNumber(record.y);
  const z = readFiniteNumber(record.z);
  return x == null || y == null || z == null ? null : { x, y, z };
}

function readPositiveVec3(value: unknown): EditorTransformSnapshot['scale'] | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return { x: value, y: value, z: value };
  }
  const vector = readVec3(value);
  if (!vector || vector.x <= 0 || vector.y <= 0 || vector.z <= 0) return null;
  return vector;
}

function readRotationDeg(value: unknown): EditorTransformSnapshot['rotation'] | null {
  const rotation = readVec3(value);
  if (!rotation) return null;
  return {
    x: (rotation.x * Math.PI) / 180,
    y: (rotation.y * Math.PI) / 180,
    z: (rotation.z * Math.PI) / 180,
  };
}

function readFiniteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

async function exportForgePlayDocument(
  harness: LocalEditorHarness,
  payload: Record<string, unknown>,
  saveState: { preparedRevision: number; committedRevision: number },
): Promise<void> {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const workingDocument = harness.getWorkingDocument();
  if (!workingDocument) throw new Error('editor_document_unavailable');
  const assets = await loadEditorAssetLibrary();
  const editorScene = enrichEditorSceneDocumentAssets(workingDocument as EditorSceneDocument, assets);
  const prepared = await saveSceneMainSource(editorScene, { mode: 'prepare-platform-save' });
  const sceneJsonText = readPreparedSceneJsonText(prepared.sceneJsonText, prepared.compiledArtifact?.data, prepared.document);
  saveState.preparedRevision += 1;
  saveState.committedRevision = 0;
  postForgePlayEvent(FORGE_PLAY_EVENT.DOCUMENT_EXPORTED, {
    ...(requestId ? { requestId } : {}),
    sceneJsonText,
    ...(typeof prepared.expectedVersion === 'number'
      ? { expectedVersion: prepared.expectedVersion }
      : readBaseSceneVersion() !== undefined
        ? { expectedVersion: readBaseSceneVersion() }
        : {}),
  });
}

function readPreparedSceneJsonText(
  sceneJsonText: string | undefined,
  compiledArtifactData: unknown,
  editorScene: EditorSceneDocument,
): string {
  if (typeof sceneJsonText === 'string' && sceneJsonText.trim()) return sceneJsonText;
  if (compiledArtifactData && typeof compiledArtifactData === 'object' && !Array.isArray(compiledArtifactData)) {
    return `${JSON.stringify(compiledArtifactData, null, 2)}\n`;
  }
  const compiled = compileEditorSceneDocumentToSceneConfig(editorScene, baseSceneConfig as SceneConfig);
  return `${JSON.stringify(compiled.sceneConfig, null, 2)}\n`;
}

function readBaseSceneVersion(): number | undefined {
  const version = (baseSceneConfig as unknown as { version?: unknown }).version;
  return typeof version === 'number' ? version : undefined;
}

function postForgePlayDocumentExportError(payload: Record<string, unknown>, error: unknown): void {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const message = error instanceof Error ? error.message : String(error);
  postForgePlayEvent(FORGE_PLAY_EVENT.DOCUMENT_EXPORTED, {
    ...(requestId ? { requestId } : {}),
    error: message,
  });
}

function summarizeEditorScene(editorScene: EditorSceneDocument): string {
  return `editorScene assets=${editorScene.assets.length}, gameObjects=${editorScene.scene.gameObjects.length}`;
}
