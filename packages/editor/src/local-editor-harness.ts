import {
  type AuthoringCommandResult,
  type AuthoringSourceDescriptor,
  createEditorSession,
  type DocumentCommand,
  type EditorSelectionState,
  type EditorSession,
  type EditorSessionDispatchResult,
  type EditorSessionHistoryResult,
  type EditorTransformBatchCommit,
  type EditorTransformConstraint,
  type EditorTransformSnapshot,
  type EditorTransformSpace,
  type EditorTransformTool,
  type EditorTransformTargetSnapshot,
  type SelectionCommand,
  type SceneGraphCreateGroupIntent,
  type SceneGraphDeleteIntent,
  type SceneGraphDropIntent,
  type SceneGraphRenameIntent,
  type SceneGraphValidationResult,
  type SerializedMultiObject,
  type SerializedObject,
  type EditorHostServices,
  type ProjectAuthoringHost,
  validateSceneGraphDelete,
  validateSceneGraphDrop,
  validateSceneGraphRename,
} from '@fps-games/editor-core';
import {
  createLocalEditorBrowserUi,
  type LocalEditorBrowserUi,
  type LocalEditorBrowserUiAssetItem,
  type LocalEditorBrowserHierarchySelectionInput,
  type LocalEditorBrowserUiPropertyInput,
  type LocalEditorBrowserUiHierarchyItem,
  type LocalEditorBrowserUiState,
} from '@fps-games/editor-browser';
import {
  createBabylonEditorProjection,
  createBabylonEditorWorld,
  createBabylonProjectionSelectionController,
  createBabylonSceneViewCameraController,
  createBabylonSceneViewInputController,
  createBabylonTransformGizmoController,
  focusEditorViewportSelection,
  type BabylonEditorProjection,
  type BabylonProjectionSelectionBox,
  type BabylonProjectionSelectionController,
  type BabylonSceneViewCameraController,
  type BabylonSceneViewInputController,
  type BabylonEditorProjectionImportContext,
  type BabylonEditorProjectionImportResult,
  type BabylonEditorProjectionNode,
  type BabylonTransformGizmoCommit,
  type BabylonTransformGizmoController,
  type BabylonEditorWorld,
  type BabylonRuntimeGlobal,
} from '@fps-games/editor-babylon';

export type LocalEditorHarnessMode = 'game' | 'editor';
type LocalEditorMaybePromise<T> = T | Promise<T>;

export interface LocalEditorHarnessAssetItem {
  id: string;
  label: string;
  meta?: string;
  placeable?: boolean;
  raw?: unknown;
}

export interface LocalEditorHarnessPropertyInput<TDocument = unknown> {
  document: TDocument;
  targetId: string;
  targetIds?: string[];
  path: string;
  value: number | string | boolean;
}

export interface LocalEditorHarnessMultiPropertyInput<TDocument = unknown> {
  document: TDocument;
  targetIds: string[];
  activeId: string | null;
  path: string;
  value: number | string | boolean;
}

export interface LocalEditorHarnessTransformInput<TDocument = unknown> {
  document: TDocument;
  targetId: string;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  before: EditorTransformSnapshot;
  after: EditorTransformSnapshot;
}

export interface LocalEditorHarnessTransformBatchInput<TDocument = unknown> extends EditorTransformBatchCommit {
  document: TDocument;
}

export interface LocalEditorHarnessSceneGraphRenamePatch<TPatch> {
  patch: TPatch;
  label?: string;
  changedId?: string;
}

export interface LocalEditorHarnessSceneGraphCreateGroupPatch<TPatch> {
  patch: TPatch;
  label?: string;
  createdId: string;
}

export interface LocalEditorHarnessSceneGraphDeletePatch<TPatch> {
  patch: TPatch;
  label?: string;
  deletedIds?: string[];
  fallbackSelectionId?: string | null;
}

export interface LocalEditorHarnessSceneGraphDropPatch<TPatch> {
  patch: TPatch;
  label?: string;
  changedIds?: string[];
}

export interface LocalEditorHarnessDocumentAdapter<TDocument, TPatch, TAsset = LocalEditorHarnessAssetItem> {
  cloneDocument?(document: TDocument): TDocument;
  compareDocuments?(left: TDocument, right: TDocument): boolean;
  prepareDocument?(document: TDocument, assets: TAsset[]): TDocument;
  reduceDocument(document: TDocument, command: DocumentCommand<TDocument, TPatch>): TDocument;
  getSerializedObject(document: TDocument, activeId: string): SerializedObject<TDocument> | null;
  getSerializedMultiObject?(document: TDocument, selectedIds: string[], activeId: string | null): SerializedMultiObject<TDocument> | null;
  getHierarchyItems(document: TDocument): LocalEditorBrowserUiHierarchyItem[];
  getProjectionNodes(document: TDocument): BabylonEditorProjectionNode[];
  getProjectionNode(document: TDocument, id: string): BabylonEditorProjectionNode | null;
  isSelectable?(document: TDocument, id: string): boolean;
  isLocked?(document: TDocument, id: string): boolean;
  createPatchFromAsset(asset: TAsset): { patch: TPatch; label?: string };
  findCreatedId?(beforeDocument: TDocument, afterDocument: TDocument): string | null;
  createSerializedPropertyPatch(input: LocalEditorHarnessPropertyInput<TDocument>): { patch: TPatch; label?: string; changedId?: string; changedIds?: string[] } | null;
  createSerializedMultiPropertyPatch?(input: LocalEditorHarnessMultiPropertyInput<TDocument>): { patch: TPatch; label?: string; changedIds?: string[] } | null;
  createTransformPatch?(input: LocalEditorHarnessTransformInput<TDocument>): { patch: TPatch; label?: string; changedId?: string; changedIds?: string[] } | null;
  createTransformBatchPatch?(input: LocalEditorHarnessTransformBatchInput<TDocument>): { patch: TPatch; label?: string; changedIds?: string[] } | null;
  validateSceneGraphDrop?(document: TDocument, intent: SceneGraphDropIntent): SceneGraphValidationResult;
  createSceneGraphRenamePatch?(document: TDocument, intent: SceneGraphRenameIntent): LocalEditorHarnessSceneGraphRenamePatch<TPatch> | null;
  createSceneGraphCreateGroupPatch?(document: TDocument, intent: SceneGraphCreateGroupIntent): LocalEditorHarnessSceneGraphCreateGroupPatch<TPatch> | null;
  createSceneGraphDeletePatch?(document: TDocument, intent: SceneGraphDeleteIntent): LocalEditorHarnessSceneGraphDeletePatch<TPatch> | null;
  createSceneGraphDropPatch?(document: TDocument, intent: SceneGraphDropIntent): LocalEditorHarnessSceneGraphDropPatch<TPatch> | null;
  summarize?(document: TDocument): string;
}

export interface LocalEditorHarnessPersistenceAdapter<TDocument, TAsset = LocalEditorHarnessAssetItem> {
  loadAuthoringSource?(): LocalEditorMaybePromise<{
    source: AuthoringSourceDescriptor;
    document: TDocument;
    assets?: TAsset[];
    summary?: string;
  }>;
  loadDocument?(): LocalEditorMaybePromise<TDocument>;
  loadAssets(): LocalEditorMaybePromise<TAsset[]>;
  saveAuthoringSource?(input: {
    source: AuthoringSourceDescriptor;
    document: TDocument;
  }): LocalEditorMaybePromise<{
    source: AuthoringSourceDescriptor;
    document: TDocument;
    summary?: string;
  }>;
  saveDocument?(document: TDocument): LocalEditorMaybePromise<{ document: TDocument; summary?: string }>;
  runGame(): LocalEditorMaybePromise<void>;
}

export interface LocalEditorHarnessWorldAdapter<TAsset = LocalEditorHarnessAssetItem> {
  disposeGameWorld(): LocalEditorMaybePromise<void>;
  getCanvas(): HTMLCanvasElement | null;
  loadBabylon(): LocalEditorMaybePromise<BabylonRuntimeGlobal & Record<string, any>>;
  createEngine(babylon: BabylonRuntimeGlobal & Record<string, any>, canvas: HTMLCanvasElement): any;
  importProjectionModel(context: BabylonEditorProjectionImportContext): Promise<BabylonEditorProjectionImportResult | null>;
  toBrowserAssetItem?(asset: TAsset): LocalEditorBrowserUiAssetItem;
  resolveAssetId?(asset: TAsset): string;
}

export interface LocalEditorHarnessOptions<TDocument, TPatch, TAsset = LocalEditorHarnessAssetItem> {
  root?: HTMLElement;
  authoringHost?: ProjectAuthoringHost;
  hostServices?: EditorHostServices;
  documentAdapter: LocalEditorHarnessDocumentAdapter<TDocument, TPatch, TAsset>;
  persistenceAdapter: LocalEditorHarnessPersistenceAdapter<TDocument, TAsset>;
  worldAdapter: LocalEditorHarnessWorldAdapter<TAsset>;
  world?: {
    cameraTarget?: { x: number; y: number; z: number };
    cameraRadius?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    useRightHandedSystem?: boolean;
  };
  createGrid?: (babylon: BabylonRuntimeGlobal & Record<string, any>, scene: unknown) => void;
}

export interface LocalEditorHarness<TDocument = unknown> {
  render(): void;
  getHostServices(): EditorHostServices | null;
  getWorkingDocument(): TDocument | null;
  enterEditor(): Promise<void>;
  saveScene(): Promise<boolean>;
  saveAndRunGame(): Promise<boolean>;
  discardAndRunGame(): Promise<void>;
  dispose(): void;
}

interface LocalEditorHarnessState<TDocument, TPatch, TAsset> {
  mode: LocalEditorHarnessMode;
  busy: boolean;
  session: EditorSession<TDocument, TPatch> | null;
  source: AuthoringSourceDescriptor | null;
  assets: TAsset[];
  assetFilter: string;
  babylon: (BabylonRuntimeGlobal & Record<string, any>) | null;
  engine: any | null;
  world: BabylonEditorWorld | null;
  projection: BabylonEditorProjection | null;
  gizmo: BabylonTransformGizmoController | null;
  sceneViewInput: BabylonSceneViewInputController | null;
  sceneViewCamera: BabylonSceneViewCameraController | null;
  selectionController: BabylonProjectionSelectionController | null;
  boxSelection: BabylonProjectionSelectionBox | null;
  transformTool: EditorTransformTool;
  transformSpace: EditorTransformSpace;
  transformConstraint: EditorTransformConstraint;
  resizeHandler: (() => void) | null;
  status: string;
  summary: string;
}

export function createLocalEditorHarness<TDocument, TPatch, TAsset = LocalEditorHarnessAssetItem>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): LocalEditorHarness<TDocument> {
  const root = options.root ?? document.body;
  const state: LocalEditorHarnessState<TDocument, TPatch, TAsset> = {
    mode: 'game',
    busy: false,
    session: null,
    source: null,
    assets: [],
    assetFilter: '',
    babylon: null,
    engine: null,
    world: null,
    projection: null,
    gizmo: null,
    sceneViewInput: null,
    sceneViewCamera: null,
    selectionController: null,
    boxSelection: null,
    transformTool: 'select',
    transformSpace: 'world',
    transformConstraint: 'axis',
    resizeHandler: null,
    status: 'Game running',
    summary: '',
  };

  let harness: LocalEditorHarness<TDocument>;
  const ui: LocalEditorBrowserUi<TDocument> = createLocalEditorBrowserUi<TDocument>({
    root,
    callbacks: {
      onEnterEditor: () => {
        void runExclusive(state, harness.render, () => harness.enterEditor());
      },
      onSaveScene: () => {
        void runExclusive(state, harness.render, () => harness.saveScene());
      },
      onSaveAndRunGame: () => {
        void runExclusive(state, harness.render, () => harness.saveAndRunGame());
      },
      onDiscardAndRunGame: () => {
        void runExclusive(state, harness.render, () => harness.discardAndRunGame());
      },
      onUndo: () => {
        if (undoSessionChange(state, options)) harness.render();
      },
      onRedo: () => {
        if (redoSessionChange(state, options)) harness.render();
      },
      onCreateFromAsset: (assetId) => {
        if (addAssetToDocument(state, options, assetId)) harness.render();
      },
      onSelectHierarchyItem: (input) => {
        if (selectItem(state, options, input)) harness.render();
      },
      onSceneGraphRename: (intent) => {
        if (renameSceneGraphNode(state, options, intent)) harness.render();
      },
      onSceneGraphCreateGroup: (intent) => {
        if (createSceneGraphGroup(state, options, intent)) harness.render();
      },
      onSceneGraphDelete: (intent) => {
        if (deleteSceneGraphNodes(state, options, intent)) harness.render();
      },
      onSceneGraphDrop: (intent) => {
        if (dropSceneGraphNode(state, options, intent)) harness.render();
      },
      onAssetFilterChange: (value) => {
        state.assetFilter = value;
        harness.render();
      },
      onPropertyInput: (input) => {
        if (patchSerializedProperty(state, options, input)) harness.render();
      },
      onTransformToolChange: (tool) => {
        state.transformTool = tool;
        state.gizmo?.setTool(tool);
        harness.render();
      },
      onTransformSpaceChange: (space) => {
        state.transformSpace = space;
        state.gizmo?.setSpace(space);
        harness.render();
      },
      onTransformConstraintChange: (constraint) => {
        state.transformConstraint = constraint;
        state.gizmo?.setConstraint(constraint);
        harness.render();
      },
      onFocusSelection: () => {
        if (focusSelectedProjection(state)) harness.render();
      },
      onCancelActiveOperation: () => {
        cancelActiveOperation(state);
        harness.render();
      },
    },
  });

  harness = {
    render() {
      ui.update(createUiState(state, options));
    },
    getHostServices() {
      return options.hostServices ?? null;
    },
    getWorkingDocument() {
      return state.session?.getState().workingDocument ?? null;
    },
    async enterEditor() {
      const loadedSource = options.persistenceAdapter.loadAuthoringSource
        ? await options.persistenceAdapter.loadAuthoringSource()
        : null;
      const [document, assets] = loadedSource
        ? [loadedSource.document, loadedSource.assets ?? await options.persistenceAdapter.loadAssets()]
        : [await loadDocumentFallback(options), await options.persistenceAdapter.loadAssets()];
      const source = loadedSource?.source ?? null;
      const preparedDocument = options.documentAdapter.prepareDocument?.(document, assets) ?? document;
      state.assets = assets;
      state.source = source;
      state.session = createEditorSession<TDocument, TPatch>({
        source: source ?? undefined,
        persistedDocument: preparedDocument,
        cloneDocument: options.documentAdapter.cloneDocument,
        compareDocuments: options.documentAdapter.compareDocuments,
        reduceDocument: options.documentAdapter.reduceDocument,
      });
      await options.worldAdapter.disposeGameWorld();
      await createEditorWorld(state, options, harness.render);
      state.mode = 'editor';
      state.summary = loadedSource?.summary ?? summarizeDocument(options, preparedDocument, source);
      state.status = `GameWorld disposed; EditorWorld active; assets=${assets.length}`;
    },
    async saveScene() {
      cancelActiveOperation(state);
      const document = state.session?.getState().workingDocument ?? await loadDocumentFallback(options);
      const source = state.session?.getState().source ?? state.source;
      let savedSource: AuthoringSourceDescriptor | null = source;
      let result: { document: TDocument; summary?: string };
      if (source && options.authoringHost) {
        const hostResult = await options.authoringHost.commitSource<TDocument>({
          source,
          document,
          expectedRevision: source.ref.revision,
        });
        if (!hostResult.ok || !hostResult.document) {
          state.status = summarizeAuthoringFailure(hostResult);
          state.summary = summarizeDocument(options, document, source);
          return false;
        }
        savedSource = hostResult.source ?? source;
        result = {
          document: hostResult.document,
          summary: hostResult.summary ?? summarizeDiagnostics(hostResult.diagnostics),
        };
      } else if (source && options.persistenceAdapter.saveAuthoringSource) {
        const sourceResult = await options.persistenceAdapter.saveAuthoringSource({ source, document });
        savedSource = sourceResult.source;
        result = sourceResult;
      } else {
        result = await saveDocumentFallback(options, document);
      }
      const preparedDocument = options.documentAdapter.prepareDocument?.(result.document, state.assets) ?? result.document;
      state.source = savedSource ?? null;
      if (state.session) {
        state.session.markSaved(preparedDocument, savedSource ?? undefined);
      } else {
        state.session = createEditorSession<TDocument, TPatch>({
          source: savedSource ?? undefined,
          persistedDocument: preparedDocument,
          cloneDocument: options.documentAdapter.cloneDocument,
          compareDocuments: options.documentAdapter.compareDocuments,
          reduceDocument: options.documentAdapter.reduceDocument,
        });
      }
      state.summary = result.summary ?? summarizeDocument(options, preparedDocument, savedSource ?? null);
      state.status = 'Scene saved';
      return true;
    },
    async saveAndRunGame() {
      const saved = await harness.saveScene();
      if (!saved) return false;
      await harness.discardAndRunGame();
      return true;
    },
    async discardAndRunGame() {
      cancelActiveOperation(state);
      disposeEditorWorld(state);
      state.session = null;
      state.source = null;
      state.status = 'Reloading game';
      await options.persistenceAdapter.runGame();
    },
    dispose() {
      disposeEditorWorld(state);
      state.session = null;
      ui.dispose();
    },
  };

  harness.render();
  return harness;
}

async function createEditorWorld<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  render: () => void,
): Promise<void> {
  disposeEditorWorld(state);
  const canvas = options.worldAdapter.getCanvas();
  if (!canvas) throw new Error('Editor canvas not found');
  const babylon = await options.worldAdapter.loadBabylon();
  const engine = options.worldAdapter.createEngine(babylon, canvas);
  const world = createBabylonEditorWorld({
    engine,
    canvas,
    babylon,
    cameraTarget: options.world?.cameraTarget,
    cameraRadius: options.world?.cameraRadius,
    clearColor: options.world?.clearColor,
    useRightHandedSystem: options.world?.useRightHandedSystem,
    enableDefaultCameraControls: false,
  });
  options.createGrid?.(babylon, world.scene);
  const projection = createBabylonEditorProjection({
    babylon,
    scene: world.scene,
    importModel: options.worldAdapter.importProjectionModel,
    logger: console,
  });
  const gizmo = createBabylonTransformGizmoController({
    babylon,
    scene: world.scene,
    projection,
    initialTool: state.transformTool,
    initialSpace: state.transformSpace,
    logger: console,
    onDragStart(event) {
      state.status = event.targetIds.length > 1
        ? `Dragging ${event.tool} ${event.targetIds.length} objects`
        : `Dragging ${event.tool} ${event.nodeId ?? event.activeId ?? 'selection'}`;
      render();
    },
    onDragUpdate() {
      render();
    },
    onDragEnd(event) {
      commitGizmoTransform(state, options, event);
      render();
    },
    onDragCancel(event) {
      state.status = event.targetIds.length > 1
        ? `Canceled ${event.tool} ${event.targetIds.length} objects`
        : `Canceled ${event.tool} ${event.nodeId ?? event.activeId ?? 'selection'}`;
      render();
    },
  });
  gizmo.setConstraint(state.transformConstraint);
  const selectionController = createBabylonProjectionSelectionController({
    scene: world.scene,
    canvas,
    projection,
    getTool: () => state.transformTool,
    getSelection: () => state.session?.getSelection() ?? { selectedIds: [], activeId: null },
    isSelectable: (nodeId) => isDocumentNodeSelectable(state, options, nodeId),
    isLocked: (nodeId) => isDocumentNodeLocked(state, options, nodeId),
    isOperationBlocked: () => state.gizmo?.getState().dragPhase === 'dragging',
    onSelectionCommand(command) {
      if (dispatchSelectionCommand(state, options, command)) render();
    },
    onFocusIntent(nodeId) {
      if (focusProjectionNode(state, nodeId)) render();
    },
    onBoxSelectionChange(box) {
      state.boxSelection = box;
      render();
    },
  });
  const sceneViewInput = createBabylonSceneViewInputController({
    canvas,
    isEnabled: () => state.mode === 'editor',
    isGizmoDragCandidate: (event) => gizmo.isGizmoDragCandidate(event),
    isBoxSelectCandidate: (event) => selectionController.isBoxSelectionCandidate(event),
    isViewPlaneMoveCandidate: (event) => gizmo.isViewPlaneMoveCandidate(event),
    onPointerIntentStart(event) {
      if (event.state.intent === 'view-plane-move') {
        if (gizmo.beginViewPlaneMove(event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.beginPointerSelection(event.originalEvent);
      }
    },
    onPointerIntentMove(event) {
      if (event.state.intent === 'view-plane-move') {
        if (gizmo.updateViewPlaneMove(event.originalEvent)) render();
        return;
      }
      if (state.sceneViewCamera?.handlePointerIntentMove(event)) {
        render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.updatePointerSelection(event.originalEvent, event.state.intent);
      }
    },
    onPointerIntentEnd(event) {
      if (event.state.intent === 'view-plane-move') {
        if (gizmo.endViewPlaneMove(event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.endPointerSelection(event.originalEvent, event.state.intent);
      }
    },
    onPointerIntentCancel(event) {
      if (event.state.intent === 'view-plane-move') {
        gizmo.cancelDrag();
        render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.cancelBoxSelection();
        render();
      }
    },
    onDoubleClick(event) {
      selectionController.handleDoubleClick(event);
    },
    onWheel(event) {
      if (state.sceneViewCamera?.handleWheel(event)) render();
    },
  });
  const sceneViewCamera = createBabylonSceneViewCameraController({
    babylon,
    scene: world.scene,
    camera: world.camera,
    input: sceneViewInput,
  });
  const document = state.session?.getState().workingDocument;
  if (document) {
    projection.projectNodes(options.documentAdapter.getProjectionNodes(document));
    const selection = state.session?.getState().selection ?? { selectedIds: [], activeId: null };
    projection.syncSelection(selection);
    gizmo.setSelection(selection);
  }
  const resize = () => engine.resize?.();
  window.addEventListener('resize', resize);
  engine.runRenderLoop?.(() => world.render());
  state.babylon = babylon;
  state.engine = engine;
  state.world = world;
  state.projection = projection;
  state.gizmo = gizmo;
  state.sceneViewInput = sceneViewInput;
  state.sceneViewCamera = sceneViewCamera;
  state.selectionController = selectionController;
  state.resizeHandler = resize;
}

function disposeEditorWorld<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  if (state.resizeHandler) {
    window.removeEventListener('resize', state.resizeHandler);
    state.resizeHandler = null;
  }
  state.sceneViewCamera?.dispose();
  state.sceneViewCamera = null;
  state.sceneViewInput?.dispose();
  state.sceneViewInput = null;
  state.selectionController?.dispose();
  state.selectionController = null;
  state.boxSelection = null;
  state.gizmo?.dispose();
  state.gizmo = null;
  state.projection?.dispose();
  state.projection = null;
  state.engine?.stopRenderLoop?.();
  state.world?.dispose();
  state.engine?.dispose?.();
  state.babylon = null;
  state.world = null;
  state.engine = null;
}

async function runExclusive<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  render: () => void,
  action: () => Promise<unknown>,
): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await action();
  } catch (error) {
    state.status = error instanceof Error ? error.message : String(error);
    console.error('[LocalEditorHarness] action failed', error);
  } finally {
    state.busy = false;
    render();
  }
}

function selectItem<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: LocalEditorBrowserHierarchySelectionInput,
): boolean {
  if (state.mode !== 'editor') return false;
  if (!isDocumentNodeSelectable(state, options, input.id)) return false;
  const command: SelectionCommand = input.toggle
    ? {
        type: 'selection.toggle',
        selectedIds: [input.id],
        activeId: input.id,
        label: 'Toggle Selection',
      }
    : input.additive
      ? {
          type: 'selection.add',
          selectedIds: [input.id],
          activeId: input.id,
          label: 'Add Selection',
        }
      : {
          type: 'selection.replace',
          selectedIds: [input.id],
          activeId: input.id,
          label: 'Select Item',
        };
  return dispatchSelectionCommand(state, options, command);
}

function dispatchSelectionCommand<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  command: SelectionCommand,
): boolean {
  if (state.mode !== 'editor') return false;
  cancelActiveOperation(state);
  const session = state.session;
  if (!session) return false;
  const result = session.dispatch(command);
  const sanitized = sanitizeSelection(state, options, result.workingDocument, result.selection);
  const selection = sanitized ?? result.selection;
  syncSelectionToProjection(state, selection);
  return result.selectionChanged || !!sanitized;
}

function renameSceneGraphNode<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphRenameIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const validation = validateSceneGraphRename(options.documentAdapter.getHierarchyItems(document), intent);
  if (!validation.ok) {
    state.status = `Rename rejected: ${validation.reason ?? 'invalid scene graph rename'}`;
    return true;
  }
  const patch = options.documentAdapter.createSceneGraphRenamePatch?.(document, intent);
  if (!patch) {
    state.status = `Rename rejected: ${intent.id}`;
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Rename ${intent.id}`,
    patch: patch.patch,
    targetId: intent.id,
  });
  if (!result.documentChanged) {
    state.status = `Rename unchanged: ${intent.id}`;
    return true;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, result.selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Renamed ${intent.id}`;
  return true;
}

function createSceneGraphGroup<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphCreateGroupIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const patch = options.documentAdapter.createSceneGraphCreateGroupPatch?.(document, intent);
  if (!patch) {
    state.status = 'Create group rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? 'Create Empty Group',
    patch: patch.patch,
    targetId: patch.createdId ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Create group unchanged';
    return true;
  }
  const createdId = patch.createdId ?? null;
  let selection = result.selection;
  if (createdId && isNodeSelectableInDocument(options, result.workingDocument, createdId)) {
    selection = state.session.dispatch({
      type: 'selection.replace',
      selectedIds: [createdId],
      activeId: createdId,
      label: 'Select Created Group',
    }).selection;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? (createdId ? `Created group ${createdId}` : 'Created group');
  return true;
}

function deleteSceneGraphNodes<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphDeleteIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const validation = validateSceneGraphDelete(options.documentAdapter.getHierarchyItems(document), intent);
  if (!validation.ok) {
    state.status = `Delete rejected: ${validation.reason ?? 'invalid scene graph delete'}`;
    return true;
  }
  const patch = options.documentAdapter.createSceneGraphDeletePatch?.(document, intent);
  if (!patch) {
    state.status = 'Delete rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Delete ${intent.ids.length} node(s)`,
    patch: patch.patch,
    targetId: intent.activeId ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Delete unchanged';
    return true;
  }
  const fallbackSelectionId = patch.fallbackSelectionId ?? null;
  let selection = result.selection;
  if (fallbackSelectionId && isNodeSelectableInDocument(options, result.workingDocument, fallbackSelectionId)) {
    selection = state.session.dispatch({
      type: 'selection.replace',
      selectedIds: [fallbackSelectionId],
      activeId: fallbackSelectionId,
      label: 'Select Delete Fallback',
    }).selection;
  } else {
    selection = sanitizeSelection(state, options, result.workingDocument, selection) ?? selection;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Deleted ${patch.deletedIds?.length ?? intent.ids.length} node(s)`;
  return true;
}

function dropSceneGraphNode<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphDropIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  if (intent.placement !== 'inside') {
    state.status = 'Reparent rejected: sorting is not implemented yet';
    return true;
  }
  const hierarchy = options.documentAdapter.getHierarchyItems(document);
  const coreValidation = validateSceneGraphDrop(hierarchy, intent);
  if (!coreValidation.ok) {
    state.status = `Reparent rejected: ${coreValidation.reason ?? 'invalid scene graph drop'}`;
    return true;
  }
  const projectValidation = options.documentAdapter.validateSceneGraphDrop?.(document, intent);
  if (projectValidation && !projectValidation.ok) {
    state.status = `Reparent rejected: ${projectValidation.reason ?? 'project validation failed'}`;
    return true;
  }
  const patch = options.documentAdapter.createSceneGraphDropPatch?.(document, intent);
  if (!patch) {
    state.status = 'Reparent rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Reparent ${intent.draggedId}`,
    patch: patch.patch,
    targetId: intent.draggedId,
  });
  if (!result.documentChanged) {
    state.status = `Reparent unchanged: ${intent.draggedId}`;
    return true;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, result.selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Reparented ${intent.draggedId}`;
  return true;
}

function sanitizeSelection<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  selection: EditorSelectionState,
): EditorSelectionState | null {
  const selectedIds = selection.selectedIds.filter(id => isNodeSelectableInDocument(options, document, id));
  const activeId = selection.activeId && selectedIds.includes(selection.activeId)
    ? selection.activeId
    : selectedIds[selectedIds.length - 1] ?? null;
  if (activeId === selection.activeId && selectedIds.length === selection.selectedIds.length) return null;
  const result = state.session?.dispatch({
    type: 'selection.replace',
    selectedIds,
    activeId,
    label: 'Sanitize Selection',
  });
  return result?.selection ?? { selectedIds, activeId };
}

function syncSelectionToProjection<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  selection: EditorSelectionState,
): void {
  state.projection?.syncSelection(selection);
  state.gizmo?.setSelection(selection);
  state.gizmo?.refreshSelection();
}

function addAssetToDocument<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  assetId: string,
): boolean {
  if (state.mode !== 'editor') return false;
  cancelActiveOperation(state);
  const session = state.session;
  const beforeDocument = session?.getState().workingDocument;
  if (!session || !beforeDocument) return false;
  const asset = state.assets.find(candidate => resolveAssetId(options, candidate) === assetId);
  if (!asset) return false;
  const patch = options.documentAdapter.createPatchFromAsset(asset);
  const result = session.dispatch({
    type: 'document.patch',
    label: patch.label ?? 'Create Object From Asset',
    patch: patch.patch,
  });
  const createdId = options.documentAdapter.findCreatedId?.(beforeDocument, result.workingDocument);
  let selectionResult: EditorSessionDispatchResult<TDocument> | null = null;
  if (createdId) {
    selectionResult = session.dispatch({
      type: 'selection.replace',
      selectedIds: [createdId],
      activeId: createdId,
      label: 'Select Created Item',
    });
  }
  state.summary = summarizeDocument(options, result.workingDocument, session.getSource());
  state.status = `Added ${assetId}`;
  if (createdId) {
    const projectedNode = options.documentAdapter.getProjectionNode(result.workingDocument, createdId);
    if (projectedNode) {
      state.projection?.projectNode(projectedNode);
      if (selectionResult) syncSelectionToProjection(state, selectionResult.selection);
    }
  }
  return true;
}

function patchSerializedProperty<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: LocalEditorBrowserUiPropertyInput,
): boolean {
  if (state.mode !== 'editor') return false;
  cancelActiveOperation(state);
  if (!state.session) return false;
  const document = state.session.getState().workingDocument;
  const targetIds = input.targetIds && input.targetIds.length > 0 ? input.targetIds : [input.targetId];
  if (targetIds.length > 1) {
    const patch = options.documentAdapter.createSerializedMultiPropertyPatch?.({
      document,
      targetIds,
      activeId: state.session.getState().selection.activeId,
      path: input.path,
      value: input.value,
    });
    if (!patch) return false;
    const result = state.session.dispatch({
      type: 'document.patch',
      label: patch.label ?? `Patch ${input.path} on ${targetIds.length} objects`,
      patch: patch.patch,
      targetId: state.session.getState().selection.activeId ?? undefined,
    });
    if (!result.documentChanged) return false;
    const changedIds = patch.changedIds ?? targetIds;
    const workingDocument = result.workingDocument;
    syncProjectionForChangedIds(state, options, workingDocument, changedIds);
    state.summary = summarizeDocument(options, workingDocument, state.session.getSource());
    state.status = patch.label ?? `Patch ${input.path} on ${targetIds.length} objects`;
    return true;
  }
  const patch = options.documentAdapter.createSerializedPropertyPatch({
    ...input,
    document,
  });
  if (!patch) return false;
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Patch ${input.path}`,
    patch: patch.patch,
  });
  if (patch.changedIds) syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds);
  else syncProjectionForDispatchResult(state, options, result, patch.changedId ?? input.targetId);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Patched ${input.path}`;
  return true;
}

function commitGizmoTransform<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  event: BabylonTransformGizmoCommit,
): boolean {
  if (state.mode !== 'editor' || !state.session) return false;
  const document = state.session.getState().workingDocument;
  if (isTransformBatchCommit(event)) {
    const patch = options.documentAdapter.createTransformBatchPatch?.({
      ...event,
      document,
    });
    if (!patch) {
      restoreBatchTransformPreview(state, event.targets);
      state.status = `Ignored ${event.tool} ${event.targetIds.length} objects`;
      return false;
    }
    const result = state.session.dispatch({
      type: 'document.patch',
      label: patch.label ?? `${event.tool} ${event.targetIds.length} objects`,
      patch: patch.patch,
      targetId: event.activeId ?? undefined,
    });
    syncProjectionForDispatchResult(state, options, result);
    syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds ?? event.targetIds);
    state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
    state.status = patch.label ?? `${event.tool} ${event.targetIds.length} objects`;
    return result.documentChanged;
  }
  const patch = options.documentAdapter.createTransformPatch?.({
    document,
    targetId: event.nodeId,
    tool: event.tool,
    space: event.space,
    before: event.before,
    after: event.after,
  });
  if (!patch) {
    state.projection?.setNodeTransformPreview(event.nodeId, event.before);
    state.status = `Ignored ${event.tool} ${event.nodeId}`;
    return false;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `${event.tool} ${event.nodeId}`,
    patch: patch.patch,
    targetId: event.nodeId,
  });
  if (patch.changedIds) syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds);
  else syncProjectionForDispatchResult(state, options, result, patch.changedId ?? event.nodeId);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `${event.tool} ${event.nodeId}`;
  return result.documentChanged;
}

function isTransformBatchCommit(event: BabylonTransformGizmoCommit): event is EditorTransformBatchCommit {
  return 'targets' in event;
}

function restoreBatchTransformPreview<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  targets: EditorTransformTargetSnapshot[],
): void {
  const transforms: Record<string, EditorTransformSnapshot> = {};
  for (const target of targets) transforms[target.id] = target.before;
  state.projection?.setNodeTransformsPreview(transforms);
}

function cancelActiveGizmoDrag<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  state.gizmo?.cancelDrag();
}

function cancelActiveOperation<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  state.sceneViewInput?.cancelActiveIntent();
  state.selectionController?.cancelBoxSelection();
  cancelActiveGizmoDrag(state);
}

function focusSelectedProjection<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): boolean {
  if (state.mode !== 'editor') return false;
  const activeId = state.session?.getState().selection.activeId ?? null;
  if (!activeId) {
    state.status = 'Focus failed: no selection';
    return true;
  }
  return focusProjectionNode(state, activeId);
}

function focusProjectionNode<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  nodeId: string,
): boolean {
  if (state.mode !== 'editor') return false;
  const root = state.projection?.getAttachableRoot(nodeId) ?? null;
  if (!root) {
    state.status = `Focus failed: missing projection for ${nodeId}`;
    return true;
  }
  const focused = focusEditorViewportSelection(state.world?.camera ?? null, root, {
    babylon: state.babylon ?? undefined,
  });
  state.status = focused
    ? `Focused ${nodeId} · ${formatEditorStatusTime(Date.now())}`
    : `Focus failed: camera could not frame ${nodeId}`;
  return true;
}

function formatEditorStatusTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function undoSessionChange<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): boolean {
  cancelActiveOperation(state);
  const result = state.session?.undo();
  if (!result) return false;
  rebuildProjection(state, options, result);
  state.summary = summarizeDocument(options, result.workingDocument, state.session?.getSource());
  state.status = `Undo ${result.transaction.label}`;
  return true;
}

function redoSessionChange<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): boolean {
  cancelActiveGizmoDrag(state);
  const result = state.session?.redo();
  if (!result) return false;
  rebuildProjection(state, options, result);
  state.summary = summarizeDocument(options, result.workingDocument, state.session?.getSource());
  state.status = `Redo ${result.transaction.label}`;
  return true;
}

function rebuildProjection<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  result: EditorSessionHistoryResult<TDocument>,
): void {
  rebuildProjectionFromDocument(state, options, result.workingDocument, result.selection);
}

function rebuildProjectionFromDocument<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  selection: EditorSelectionState,
): void {
  state.projection?.rebuild(options.documentAdapter.getProjectionNodes(document));
  const sanitized = sanitizeSelection(state, options, document, selection);
  syncSelectionToProjection(state, sanitized ?? selection);
}

function syncProjectionForDispatchResult<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  result: { documentChanged: boolean; selectionChanged: boolean; workingDocument?: TDocument; selection?: EditorSelectionState },
  changedId?: string,
): void {
  if (result.documentChanged && changedId && result.workingDocument) {
    const projectedNode = options.documentAdapter.getProjectionNode(result.workingDocument, changedId);
    if (projectedNode) state.projection?.syncNodeTransform(projectedNode);
  }
  if (result.selectionChanged) {
    syncSelectionToProjection(state, result.selection ?? { selectedIds: [], activeId: null });
  } else if (result.documentChanged) {
    const selection = state.session?.getState().selection ?? { selectedIds: [], activeId: null };
    const sanitized = result.workingDocument ? sanitizeSelection(state, options, result.workingDocument, selection) : null;
    syncSelectionToProjection(state, sanitized ?? selection);
  }
}

function syncProjectionForChangedIds<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  changedIds: string[],
): void {
  for (const changedId of changedIds) {
    const projectedNode = options.documentAdapter.getProjectionNode(document, changedId);
    if (projectedNode) state.projection?.syncNodeTransform(projectedNode);
  }
  const selection = state.session?.getState().selection ?? { selectedIds: [], activeId: null };
  syncSelectionToProjection(state, selection);
}

function createUiState<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): LocalEditorBrowserUiState<TDocument> {
  const sessionState = state.session?.getState();
  const document = sessionState?.workingDocument ?? null;
  const selectedIds = sessionState?.selection.selectedIds ?? [];
  const activeId = sessionState?.selection.activeId ?? null;
  return {
    mode: state.mode,
    busy: state.busy,
    status: state.status,
    summary: state.summary,
    assetFilter: state.assetFilter,
    assets: state.assets
      .filter(asset => (asset as LocalEditorHarnessAssetItem).placeable !== false)
      .map(asset => toBrowserAssetItem(options, asset)),
    assetCountLabel: `${state.assets.length} assets`,
    hierarchy: document ? options.documentAdapter.getHierarchyItems(document) : [],
    selectedIds,
    activeId,
    selectionSummary: {
      count: selectedIds.length,
      activeId,
    },
    serializedObject: document && activeId && selectedIds.length === 1
      ? options.documentAdapter.getSerializedObject(document, activeId)
      : null,
    serializedMultiObject: document && selectedIds.length > 1
      ? options.documentAdapter.getSerializedMultiObject?.(document, selectedIds, activeId) ?? null
      : null,
    boxSelection: state.boxSelection,
    transformTool: {
      activeTool: state.gizmo?.getState().tool ?? state.transformTool,
      activeSpace: state.gizmo?.getState().space ?? state.transformSpace,
      activeConstraint: state.gizmo?.getState().constraint ?? state.transformConstraint,
      dragPhase: state.gizmo?.getState().dragPhase ?? 'idle',
      draggingNodeId: state.gizmo?.getState().draggingNodeId ?? null,
    },
    session: sessionState
      ? {
          source: sessionState.source,
          dirty: sessionState.dirty,
          canUndo: sessionState.canUndo,
          canRedo: sessionState.canRedo,
          history: sessionState.history,
        }
      : null,
  };
}

function summarizeDocument<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  _source?: AuthoringSourceDescriptor | null,
): string {
  return options.documentAdapter.summarize?.(document) ?? '';
}

function summarizeAuthoringFailure(result: AuthoringCommandResult<unknown>): string {
  const diagnostic = result.diagnostics.find(item => item.severity === 'error') ?? result.diagnostics[0];
  return diagnostic?.message ?? result.reason ?? 'Authoring source commit failed';
}

function summarizeDiagnostics(diagnostics: readonly { message: string }[] | undefined): string | undefined {
  if (!diagnostics?.length) return undefined;
  return diagnostics.map(diagnostic => diagnostic.message).join('; ');
}

async function loadDocumentFallback<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): Promise<TDocument> {
  if (!options.persistenceAdapter.loadDocument) {
    throw new Error('LocalEditorHarness requires loadAuthoringSource or loadDocument.');
  }
  return options.persistenceAdapter.loadDocument();
}

async function saveDocumentFallback<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
): Promise<{ document: TDocument; summary?: string }> {
  if (!options.persistenceAdapter.saveDocument) {
    throw new Error('LocalEditorHarness requires saveAuthoringSource or saveDocument.');
  }
  return options.persistenceAdapter.saveDocument(document);
}

function isDocumentNodeSelectable<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  id: string,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (!document) return false;
  return isNodeSelectableInDocument(options, document, id);
}

function isDocumentNodeLocked<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  id: string,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (!document) return false;
  return options.documentAdapter.isLocked?.(document, id) ?? false;
}

function isNodeSelectableInDocument<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  id: string,
): boolean {
  if (options.documentAdapter.isLocked?.(document, id)) return false;
  return options.documentAdapter.isSelectable?.(document, id) ?? true;
}

function resolveAssetId<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  asset: TAsset,
): string {
  return options.worldAdapter.resolveAssetId?.(asset)
    ?? (asset as LocalEditorHarnessAssetItem).id;
}

function toBrowserAssetItem<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  asset: TAsset,
): LocalEditorBrowserUiAssetItem {
  return options.worldAdapter.toBrowserAssetItem?.(asset)
    ?? {
      id: (asset as LocalEditorHarnessAssetItem).id,
      label: (asset as LocalEditorHarnessAssetItem).label,
      meta: (asset as LocalEditorHarnessAssetItem).meta,
      disabled: (asset as LocalEditorHarnessAssetItem).placeable === false,
    };
}
