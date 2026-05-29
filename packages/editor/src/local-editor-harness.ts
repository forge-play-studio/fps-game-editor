import {
  type AuthoringCommandResult,
  type AuthoringSourceDescriptor,
  createEditorSession,
  createInspectorRegistry,
  DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
  DEFAULT_EDITOR_VIEWPORT_TOOL_STATE,
  createEmptyEditorViewportSpatialOverlayState,
  type DocumentCommand,
  type EditorPlacementHit,
  type EditorSelectionState,
  type EditorSession,
  type EditorSessionDispatchResult,
  type EditorSessionHistoryResult,
  type EditorPlacementMode,
  type EditorTransformAction,
  type EditorTransformBatchCommit,
  type EditorTransformCanonicalConstraint,
  type EditorTransformConstraint,
  type EditorTransformOperationSettings,
  type EditorTransformPivot,
  type EditorTransformSnapshot,
  type EditorTransformSpace,
  type EditorTransformTargetSnapshot,
  type EditorTransformTool,
  type EditorTransformVec3,
  type EditorViewportGroundMeasurement,
  type EditorViewportOverlaySettings,
  type EditorViewportProjectionMode,
  type EditorViewportSpatialOverlayState,
  type EditorViewportToolState,
  type EditorViewportUtilityTool,
  type EditorViewportViewPreset,
  cloneEditorViewportToolState,
  cloneEditorViewportSpatialOverlayState,
  type SelectionCommand,
  type SceneGraphCreateGroupIntent,
  type SceneGraphCreatePrimitiveIntent,
  type SceneGraphDeleteIntent,
  type SceneGraphDropIntent,
  type SceneGraphGroupSelectionIntent,
  type SceneGraphMoveIntent,
  type SceneGraphRenameIntent,
  type SceneGraphValidationResult,
  createInspectorEditPayload,
  type SerializedMultiObject,
  type SerializedObject,
  type InspectorControlKind,
  type InspectorCommitMode,
  type InspectorComponentRegistration,
  type InspectorEditPayload,
  type InspectorObject,
  type InspectorPersistenceMode,
  type InspectorProperty,
  type InspectorRegistry,
  type InspectorRegistryConflictStrategy,
  type InspectorSection,
  type InspectorSelectionContext,
  type EditorHostServices,
  computeEditorTransformActionTargets,
  mergeInspectorSections,
  normalizeEditorTransformConstraint,
  type ProjectAuthoringHost,
  resolveEditorSelectionCommand,
  serializedMultiObjectToInspectorObject,
  serializedObjectToInspectorObject,
  validateSceneGraphDelete,
  validateSceneGraphDrop,
  validateSceneGraphGroupSelection,
  validateSceneGraphMove,
  validateSceneGraphRename,
} from '@fps-games/editor-core';
import {
  createLocalEditorBrowserUi,
  type LocalEditorBrowserUi,
  type LocalEditorBrowserAssetActionInput,
  type LocalEditorBrowserUiAssetItem,
  type LocalEditorBrowserHierarchyContextActionContext,
  type LocalEditorBrowserHierarchyContextActionRegistration,
  type LocalEditorBrowserHierarchySelectionInput,
  type LocalEditorBrowserInspectorOptions,
  type LocalEditorBrowserRenderingPanelState,
  type LocalEditorBrowserRenderingActionInput,
  type LocalEditorBrowserRenderingPropertyChangeInput,
  type LocalEditorBrowserUiPropertyInput,
  type LocalEditorBrowserUiHierarchyItem,
  type LocalEditorBrowserUiState,
  type LocalEditorContextAction,
  type LocalEditorThemeController,
  type LocalEditorThemeName,
} from '@fps-games/editor-browser';
import {
  createBabylonEditorProjection,
  createBabylonEditorWorld,
  createBabylonProjectionSelectionController,
  createBabylonSceneCameraPreviewController,
  createBabylonSceneViewCameraController,
  createBabylonSceneViewInputController,
  createBabylonSceneViewMeasurementController,
  createBabylonSceneViewSpatialOverlayController,
  createBabylonEditorShadowPreviewController,
  createBabylonTransformGizmoController,
  focusEditorViewportSelection,
  type BabylonEditorProjection,
  type BabylonProjectionSelectionBox,
  type BabylonProjectionSelectionController,
  type BabylonSceneViewCameraController,
  type BabylonSceneViewInputController,
  type BabylonSceneViewMeasurementController,
  type BabylonSceneViewSpatialOverlayController,
  type BabylonEditorShadowPreviewController,
  type BabylonEditorShadowPreviewOptions,
  type BabylonEditorProjectionImportContext,
  type BabylonEditorProjectionImportResult,
  type BabylonEditorProjectionNode,
  type BabylonSceneCameraPreviewController,
  type BabylonSceneCameraPreviewRig,
  type BabylonEditorGridController,
  type BabylonEditorGridColorOptions,
  type BabylonTransformGizmoCommit,
  type BabylonTransformGizmoBlockEvent,
  type BabylonTransformGizmoController,
  type BabylonTransformGizmoDuplicateDragInput,
  type BabylonTransformGizmoDuplicateDragResult,
  type BabylonEditorWorld,
  type BabylonEditorWorldAppearanceOptions,
  type BabylonEditorSkyOptions,
  type BabylonRuntimeGlobal,
} from '@fps-games/editor-babylon';
import {
  createLocalEditorSceneRenderScheduler,
  type LocalEditorSceneRenderScheduler,
  type LocalEditorSceneRenderStats,
} from './local-editor-scene-render-scheduler';
import {
  createLocalEditorViewportRenderCoordinator,
  type LocalEditorViewportRenderCoordinator,
} from './local-editor-viewport-render-coordinator';
import {
  createLocalEditorSceneViewInteractionRuntime,
  type LocalEditorSceneViewInteractionRuntime,
} from './local-editor-scene-view-interaction-runtime';

export type LocalEditorHarnessMode = 'game' | 'editor';
type LocalEditorMaybePromise<T> = T | Promise<T>;

export interface LocalEditorAuthoringFailureStatus {
  status: string;
  details: string;
}

export interface LocalEditorHarnessAssetItem {
  id: string;
  label: string;
  guid?: string;
  assetId?: string;
  kind?: string;
  external?: {
    platformAssetId?: string;
    assetPath?: string;
    assetUrl?: string;
    [key: string]: unknown;
  };
  origin?: string;
  dedupeKey?: string;
  displayName?: string;
  meta?: string;
  placeable?: boolean;
  preview?: LocalEditorBrowserUiAssetItem['preview'];
  disabled?: boolean;
  raw?: unknown;
}

export interface LocalEditorHarnessViewportMeasurementState {
  viewportTools: EditorViewportToolState;
  viewportMeasurement: EditorViewportGroundMeasurement;
  sceneViewMeasurement: Pick<
    BabylonSceneViewMeasurementController,
    'beginAt' | 'previewAt' | 'completeAt' | 'clear'
  > | null;
  status: string;
  statusTone?: 'default' | 'success' | 'warning' | 'error';
  statusToneStatus: string;
  statusDetails: string;
}

export interface LocalEditorHarnessPropertyInput<TDocument = unknown> {
  document: TDocument;
  targetId: string;
  targetIds?: string[];
  path: string;
  value: unknown;
  control?: InspectorControlKind;
  valueType?: InspectorProperty['valueType'];
  commitMode?: InspectorCommitMode;
  persistence?: InspectorPersistenceMode;
  source?: InspectorEditPayload['source'];
}

export interface LocalEditorHarnessMultiPropertyInput<TDocument = unknown> {
  document: TDocument;
  targetIds: string[];
  activeId: string | null;
  path: string;
  value: unknown;
  control?: InspectorControlKind;
  valueType?: InspectorProperty['valueType'];
  commitMode?: InspectorCommitMode;
  persistence?: InspectorPersistenceMode;
  source?: InspectorEditPayload['source'];
}

export interface LocalEditorHarnessRenderingPropertyInput<TDocument = unknown>
  extends LocalEditorBrowserRenderingPropertyChangeInput {
  document: TDocument;
}

export interface LocalEditorHarnessRenderingActionInput<TDocument = unknown>
  extends LocalEditorBrowserRenderingActionInput {
  document: TDocument;
}

export interface LocalEditorHarnessRenderingPropertyChangeResult {
  changed?: boolean;
  status?: string;
  statusTone?: LocalEditorBrowserUiState['statusTone'];
  statusDetails?: string;
  refreshWorldRendering?: boolean;
}

export interface LocalEditorHarnessRuntimeInspectorContext<TDocument = unknown> {
  document: TDocument;
  targetIds: string[];
  activeId: string | null;
  inspectorObject: InspectorObject<TDocument>;
  projectionNode?: BabylonEditorProjectionNode | null;
  projectedRoot?: unknown;
}

export interface LocalEditorHarnessInspectorOptions<TDocument = unknown>
  extends LocalEditorBrowserInspectorOptions<TDocument> {
  components?: InspectorRegistry<TDocument> | readonly InspectorComponentRegistration<TDocument>[];
  componentConflict?: InspectorRegistryConflictStrategy;
  propertyConflict?: InspectorRegistryConflictStrategy;
}

export interface LocalEditorHarnessInspectorComponentMergeInput<TDocument = unknown> {
  inspectorObject: InspectorObject<TDocument>;
  components?: InspectorRegistry<TDocument> | readonly InspectorComponentRegistration<TDocument>[];
  context?: InspectorSelectionContext<TDocument>;
  componentConflict?: InspectorRegistryConflictStrategy;
  propertyConflict?: InspectorRegistryConflictStrategy;
}

export interface LocalEditorHarnessTransformInput<TDocument = unknown> {
  document: TDocument;
  targetId: string;
  tool: Exclude<EditorTransformTool, 'select'>;
  space: EditorTransformSpace;
  constraint: EditorTransformCanonicalConstraint;
  before: EditorTransformSnapshot;
  after: EditorTransformSnapshot;
}

export interface LocalEditorHarnessTransformBatchInput<TDocument = unknown> extends EditorTransformBatchCommit {
  document: TDocument;
}

export interface LocalEditorHarnessDuplicateSelectionInput<TDocument = unknown> {
  document: TDocument;
  targetIds: string[];
  activeId: string | null;
  transforms: Record<string, EditorTransformSnapshot>;
}

export interface LocalEditorHarnessPlacedAssetInput<TDocument = unknown, TAsset = LocalEditorHarnessAssetItem> {
  document: TDocument;
  asset: TAsset;
  hit: EditorPlacementHit;
}

export interface LocalEditorHarnessHierarchyContextActionContext<TDocument = unknown> {
  document: TDocument;
  contextNodeId: string | null;
  targetIds: string[];
  activeId: string | null;
  hierarchyItem: LocalEditorBrowserUiHierarchyItem | null;
  projectionNode: BabylonEditorProjectionNode | null;
  hostServices: EditorHostServices | null;
  payload?: Record<string, unknown>;
  browserContext: LocalEditorBrowserHierarchyContextActionContext<TDocument>;
}

export interface LocalEditorHarnessHierarchyContextActionRegistration<TDocument = unknown> {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  placement?: LocalEditorBrowserHierarchyContextActionRegistration<TDocument>['placement'];
  separatorBefore?: boolean;
  visible?(context: LocalEditorHarnessHierarchyContextActionContext<TDocument>): boolean;
  disabled?(context: LocalEditorHarnessHierarchyContextActionContext<TDocument>): boolean | string;
  run(context: LocalEditorHarnessHierarchyContextActionContext<TDocument>): boolean | void;
}

export interface LocalEditorHarnessPatchResult<TPatch> {
  patch: TPatch;
  label?: string;
  changedId?: string;
  changedIds?: string[];
  reprojectIds?: string[];
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

export interface LocalEditorHarnessSceneGraphCreatePrimitivePatch<TPatch> {
  patch: TPatch;
  label?: string;
  createdId: string;
  changedIds?: string[];
  reprojectIds?: string[];
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

export interface LocalEditorHarnessSceneGraphMovePatch<TPatch> {
  patch: TPatch;
  label?: string;
  changedIds?: string[];
}

export interface LocalEditorHarnessSceneGraphGroupSelectionPatch<TPatch> {
  patch: TPatch;
  label?: string;
  createdId: string;
  changedIds?: string[];
}

export interface LocalEditorHarnessDuplicateSelectionPatch<TPatch> {
  patch: TPatch;
  label?: string;
  createdIds: string[];
  activeId?: string | null;
  changedIds?: string[];
  reprojectIds?: string[];
}

export interface LocalEditorHarnessPlacedAssetPatch<TPatch> {
  patch: TPatch;
  label?: string;
  createdId?: string | null;
  changedIds?: string[];
  reprojectIds?: string[];
}

export interface LocalEditorHarnessAssetPatchInput<TDocument, TAsset = LocalEditorHarnessAssetItem> {
  document: TDocument;
  asset: TAsset;
  assetId: string;
  placement?: EditorTransformSnapshot;
}

export interface LocalEditorHarnessAssetReloadResult {
  ok: boolean;
  assetCount: number;
  status: string;
  error?: string;
}

export interface LocalEditorHarnessAssetCreationResult {
  ok: boolean;
  assetId: string;
  changed: boolean;
  status: string;
  createdId?: string | null;
  error?: string;
}

export interface LocalEditorHarnessAssetCreationOptions {
  placement?: EditorTransformSnapshot;
}

export interface LocalEditorHarnessAssetActionPatchInput<TDocument, TAsset = LocalEditorHarnessAssetItem> extends LocalEditorBrowserAssetActionInput {
  document: TDocument;
  asset: TAsset | null;
  activeId: string | null;
  selectedIds: string[];
}

export interface LocalEditorHarnessDocumentAdapter<TDocument, TPatch, TAsset = LocalEditorHarnessAssetItem> {
  cloneDocument?(document: TDocument): TDocument;
  compareDocuments?(left: TDocument, right: TDocument): boolean;
  prepareDocument?(document: TDocument, assets: TAsset[]): TDocument;
  reduceDocument(document: TDocument, command: DocumentCommand<TDocument, TPatch>): TDocument;
  getSerializedObject(document: TDocument, activeId: string): SerializedObject<TDocument> | null;
  getSerializedMultiObject?(document: TDocument, selectedIds: string[], activeId: string | null): SerializedMultiObject<TDocument> | null;
  getInspectorObject?(document: TDocument, activeId: string): InspectorObject<TDocument> | null;
  getInspectorMultiObject?(document: TDocument, selectedIds: string[], activeId: string | null): InspectorObject<TDocument> | null;
  getRuntimeInspectorSections?(context: LocalEditorHarnessRuntimeInspectorContext<TDocument>): InspectorSection<TDocument>[];
  getHierarchyItems(document: TDocument): LocalEditorBrowserUiHierarchyItem[];
  getBrowserAssetItems?(document: TDocument): LocalEditorBrowserUiAssetItem[];
  getProjectionNodes(document: TDocument): BabylonEditorProjectionNode[];
  getProjectionNode(document: TDocument, id: string): BabylonEditorProjectionNode | null;
  getSceneCameraPreviewRig?(document: TDocument): BabylonSceneCameraPreviewRig | null;
  getWorldAppearance?(document: TDocument): LocalEditorHarnessWorldAppearance | null;
  getWorldRendering?(document: TDocument): LocalEditorHarnessWorldRendering | null;
  getRenderingPanelState?(document: TDocument): LocalEditorBrowserRenderingPanelState | null;
  onRenderingAction?(input: LocalEditorHarnessRenderingActionInput<TDocument>): LocalEditorMaybePromise<
    boolean | void | LocalEditorHarnessRenderingPropertyChangeResult
  >;
  onRenderingPropertyChange?(input: LocalEditorHarnessRenderingPropertyInput<TDocument>): LocalEditorMaybePromise<
    boolean | void | LocalEditorHarnessRenderingPropertyChangeResult
  >;
  isSelectable?(document: TDocument, id: string): boolean;
  isLocked?(document: TDocument, id: string): boolean;
  createPatchFromAsset(asset: TAsset, input?: LocalEditorHarnessAssetPatchInput<TDocument, TAsset>): { patch: TPatch; label?: string };
  createAssetActionPatch?(input: LocalEditorHarnessAssetActionPatchInput<TDocument, TAsset>): LocalEditorHarnessPatchResult<TPatch> | null;
  createPlacedAssetPatch?(input: LocalEditorHarnessPlacedAssetInput<TDocument, TAsset>): LocalEditorHarnessPlacedAssetPatch<TPatch> | null;
  findCreatedId?(beforeDocument: TDocument, afterDocument: TDocument): string | null;
  createSerializedPropertyPatch(input: LocalEditorHarnessPropertyInput<TDocument>): LocalEditorHarnessPatchResult<TPatch> | null;
  createSerializedMultiPropertyPatch?(input: LocalEditorHarnessMultiPropertyInput<TDocument>): LocalEditorHarnessPatchResult<TPatch> | null;
  createTransformPatch?(input: LocalEditorHarnessTransformInput<TDocument>): LocalEditorHarnessPatchResult<TPatch> | null;
  createTransformBatchPatch?(input: LocalEditorHarnessTransformBatchInput<TDocument>): LocalEditorHarnessPatchResult<TPatch> | null;
  createDuplicateSelectionPatch?(input: LocalEditorHarnessDuplicateSelectionInput<TDocument>): LocalEditorHarnessDuplicateSelectionPatch<TPatch> | null;
  validateSceneGraphDrop?(document: TDocument, intent: SceneGraphDropIntent): SceneGraphValidationResult;
  createSceneGraphRenamePatch?(document: TDocument, intent: SceneGraphRenameIntent): LocalEditorHarnessSceneGraphRenamePatch<TPatch> | null;
  createSceneGraphCreateGroupPatch?(document: TDocument, intent: SceneGraphCreateGroupIntent): LocalEditorHarnessSceneGraphCreateGroupPatch<TPatch> | null;
  createSceneGraphCreatePrimitivePatch?(document: TDocument, intent: SceneGraphCreatePrimitiveIntent): LocalEditorHarnessSceneGraphCreatePrimitivePatch<TPatch> | null;
  createSceneGraphDeletePatch?(document: TDocument, intent: SceneGraphDeleteIntent): LocalEditorHarnessSceneGraphDeletePatch<TPatch> | null;
  createSceneGraphDropPatch?(document: TDocument, intent: SceneGraphDropIntent): LocalEditorHarnessSceneGraphDropPatch<TPatch> | null;
  validateSceneGraphMove?(document: TDocument, intent: SceneGraphMoveIntent): SceneGraphValidationResult;
  createSceneGraphMovePatch?(document: TDocument, intent: SceneGraphMoveIntent): LocalEditorHarnessSceneGraphMovePatch<TPatch> | null;
  validateSceneGraphGroupSelection?(document: TDocument, intent: SceneGraphGroupSelectionIntent): SceneGraphValidationResult;
  createSceneGraphGroupSelectionPatch?(document: TDocument, intent: SceneGraphGroupSelectionIntent): LocalEditorHarnessSceneGraphGroupSelectionPatch<TPatch> | null;
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

export interface LocalEditorHarnessWorldAppearance {
  clearColor?: BabylonEditorWorldAppearanceOptions['clearColor'];
  sky?: BabylonEditorSkyOptions | false;
  grid?: BabylonEditorGridColorOptions;
}

export interface LocalEditorHarnessWorldRendering {
  shadowPreview?: BabylonEditorShadowPreviewOptions | null;
}

export type LocalEditorHarnessGridController = BabylonEditorGridController;

export interface LocalEditorHarnessGridContext {
  getCamera(): unknown | null;
  getEditorCamera(): unknown | null;
}

export interface LocalEditorHarnessOptions<TDocument, TPatch, TAsset = LocalEditorHarnessAssetItem> {
  root?: HTMLElement;
  theme?: LocalEditorThemeName;
  localTestActions?: boolean;
  authoringHost?: ProjectAuthoringHost;
  hostServices?: EditorHostServices;
  documentAdapter: LocalEditorHarnessDocumentAdapter<TDocument, TPatch, TAsset>;
  persistenceAdapter: LocalEditorHarnessPersistenceAdapter<TDocument, TAsset>;
  worldAdapter: LocalEditorHarnessWorldAdapter<TAsset>;
  world?: {
    cameraTarget?: { x: number; y: number; z: number };
    cameraRadius?: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    sky?: BabylonEditorSkyOptions | false;
    grid?: BabylonEditorGridColorOptions;
    useRightHandedSystem?: boolean;
    coordinateAxes?: boolean;
  };
  inspector?: LocalEditorHarnessInspectorOptions<TDocument>;
  hierarchy?: {
    contextActions?: readonly LocalEditorHarnessHierarchyContextActionRegistration<TDocument>[];
  };
  createGrid?: (
    babylon: BabylonRuntimeGlobal & Record<string, any>,
    scene: unknown,
    camera?: unknown,
    context?: LocalEditorHarnessGridContext,
  ) => LocalEditorHarnessGridController | void;
}

export interface LocalEditorHarness<TDocument = unknown> {
  render(): void;
  notifyViewportRevealed(reason?: string): void;
  setTheme?(theme: LocalEditorThemeName): void;
  getTheme?(): LocalEditorThemeName;
  getHostServices(): EditorHostServices | null;
  getWorkingDocument(): TDocument | null;
  reloadAssets(): Promise<LocalEditorHarnessAssetReloadResult>;
  createAssetFromAssetId(assetId: string, options?: LocalEditorHarnessAssetCreationOptions): LocalEditorHarnessAssetCreationResult;
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
  selectedAssetId: string | null;
  babylon: (BabylonRuntimeGlobal & Record<string, any>) | null;
  engine: any | null;
  world: BabylonEditorWorld | null;
  grid: LocalEditorHarnessGridController | null;
  gridVisible: boolean;
  projection: BabylonEditorProjection | null;
  shadowPreview: BabylonEditorShadowPreviewController | null;
  gizmo: BabylonTransformGizmoController | null;
  sceneCameraPreview: BabylonSceneCameraPreviewController | null;
  sceneCameraPreviewEnabled: boolean;
  sceneViewInput: BabylonSceneViewInputController | null;
  sceneViewCamera: BabylonSceneViewCameraController | null;
  sceneViewInteraction: LocalEditorSceneViewInteractionRuntime | null;
  sceneViewMeasurement: BabylonSceneViewMeasurementController | null;
  sceneViewSpatialOverlay: BabylonSceneViewSpatialOverlayController | null;
  selectionController: BabylonProjectionSelectionController | null;
  sceneRenderScheduler: LocalEditorSceneRenderScheduler | null;
  viewportRenderCoordinator: LocalEditorViewportRenderCoordinator | null;
  sceneFrameStats: LocalEditorSceneRenderStats | null;
  worldAppearanceKey: string;
  worldRenderingKey: string;
  boxSelection: BabylonProjectionSelectionBox | null;
  transformTool: EditorTransformTool;
  transformSpace: EditorTransformSpace;
  transformConstraint: EditorTransformCanonicalConstraint;
  transformOperationSettings: EditorTransformOperationSettings;
  viewportTools: EditorViewportToolState;
  viewportMeasurement: EditorViewportGroundMeasurement;
  viewportSpatialOverlay: EditorViewportSpatialOverlayState;
  duplicateDrag: {
    originalSelection: EditorSelectionState;
    createdIds: string[];
    activeId: string | null;
  } | null;
  armedPlacement: {
    assetId: string;
    asset: TAsset;
  } | null;
  resizeHandler: (() => void) | null;
  status: string;
  statusTone: LocalEditorBrowserUiState<TDocument>['statusTone'];
  statusToneStatus: string;
  statusDetails: string;
  summary: string;
}

export function createLocalEditorHarness<TDocument, TPatch, TAsset = LocalEditorHarnessAssetItem>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): LocalEditorHarness<TDocument> & LocalEditorThemeController {
  const root = options.root ?? document.body;
  const state: LocalEditorHarnessState<TDocument, TPatch, TAsset> = {
    mode: 'game',
    busy: false,
    session: null,
    source: null,
    assets: [],
    assetFilter: '',
    selectedAssetId: null,
    babylon: null,
    engine: null,
    world: null,
    grid: null,
    gridVisible: true,
    projection: null,
    shadowPreview: null,
    gizmo: null,
    sceneCameraPreview: null,
    sceneCameraPreviewEnabled: false,
    sceneViewInput: null,
    sceneViewCamera: null,
    sceneViewInteraction: null,
    sceneViewMeasurement: null,
    sceneViewSpatialOverlay: null,
    selectionController: null,
    sceneRenderScheduler: null,
    viewportRenderCoordinator: null,
    sceneFrameStats: null,
    worldAppearanceKey: '',
    worldRenderingKey: '',
    boxSelection: null,
    transformTool: 'select',
    transformSpace: 'world',
    transformConstraint: 'axis',
    transformOperationSettings: cloneTransformOperationSettings(DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS),
    viewportTools: cloneEditorViewportToolState(DEFAULT_EDITOR_VIEWPORT_TOOL_STATE),
    viewportMeasurement: createEmptyViewportMeasurement(),
    viewportSpatialOverlay: createEmptyEditorViewportSpatialOverlayState(),
    duplicateDrag: null,
    armedPlacement: null,
    resizeHandler: null,
    status: 'Game running',
    statusTone: 'default',
    statusToneStatus: 'Game running',
    statusDetails: '',
    summary: '',
  };

  let harness: LocalEditorHarness<TDocument> & LocalEditorThemeController;
  const ui: LocalEditorBrowserUi<TDocument> & LocalEditorThemeController = createLocalEditorBrowserUi<TDocument>({
    root,
    theme: options.theme,
    localTestActions: options.localTestActions,
    input: {
      isShortcutReserved: (event) => state.sceneViewInput?.ownsKeyboardEvent(event) ?? false,
    },
    inspector: options.inspector,
    hierarchy: {
      contextActions: createBrowserHierarchyContextActions(state, options),
    },
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
        if (createAssetFromBrowserIntent(state, options, assetId)) harness.render();
      },
      onSelectAsset: (assetId) => {
        if (selectBrowserAsset(state, assetId)) harness.render();
      },
      onAssetAction: (input) => {
        if (handleBrowserAssetAction(state, options, input)) harness.render();
      },
      onSelectHierarchyItem: (input) => {
        if (selectItem(state, options, input)) harness.render();
      },
      onSelectionCommand: (command) => {
        if (dispatchSelectionCommand(state, options, command)) harness.render();
      },
      onSceneGraphRename: (intent) => {
        if (renameSceneGraphNode(state, options, intent)) harness.render();
      },
      onSceneGraphCreateGroup: (intent) => {
        if (createSceneGraphGroup(state, options, intent)) harness.render();
      },
      onSceneGraphCreatePrimitive: options.documentAdapter.createSceneGraphCreatePrimitivePatch
        ? (intent) => {
            if (createSceneGraphPrimitive(state, options, intent)) harness.render();
          }
        : undefined,
      onSceneGraphDelete: (intent) => {
        if (deleteSceneGraphNodes(state, options, intent)) harness.render();
      },
      onSceneGraphDuplicate: options.documentAdapter.createDuplicateSelectionPatch
        ? (intent) => {
            if (duplicateSceneGraphNodes(state, options, {
              targetIds: intent.targetIds,
              activeId: intent.activeId ?? null,
            })) harness.render();
          }
        : undefined,
      onSceneGraphDrop: (intent) => {
        if (dropSceneGraphNode(state, options, intent)) harness.render();
      },
      onSceneGraphMove: (intent) => {
        if (moveSceneGraphNodes(state, options, intent)) harness.render();
      },
      onSceneGraphGroupSelection: (intent) => {
        if (groupSceneGraphSelection(state, options, intent)) harness.render();
      },
      onContextAction: (action) => {
        if (handleContextAction(state, options, action)) harness.render();
      },
      onAssetFilterChange: (value) => {
        state.assetFilter = value;
        harness.render();
      },
      onPropertyInput: (input) => {
        const previousStatus = state.status;
        const patched = patchSerializedProperty(state, options, input);
        if (patched || state.status !== previousStatus) harness.render();
      },
      onRenderingPropertyChange: options.documentAdapter.onRenderingPropertyChange
        ? (input) => {
            void applyRenderingPropertyChange(state, options, input)
              .then((changed) => {
                if (changed) harness.render();
              });
          }
        : undefined,
      onRenderingAction: options.documentAdapter.onRenderingAction
        ? (input) => {
            void applyRenderingAction(state, options, input)
              .then((changed) => {
                if (changed) harness.render();
              });
          }
        : undefined,
      onTransformToolChange: (tool) => {
        state.transformTool = tool;
        state.transformConstraint = normalizeTransformConstraint(tool, state.transformConstraint);
        state.gizmo?.setTool(tool);
        state.gizmo?.setConstraint(state.transformConstraint);
        harness.render();
        requestEditorSceneFrame(state, 'transform-tool-change');
      },
      onTransformSpaceChange: (space) => {
        state.transformSpace = space;
        state.gizmo?.setSpace(space);
        harness.render();
        requestEditorSceneFrame(state, 'transform-space-change');
      },
      onTransformConstraintChange: (constraint) => {
        state.transformConstraint = normalizeTransformConstraint(state.transformTool, constraint);
        state.gizmo?.setConstraint(state.transformConstraint);
        harness.render();
        requestEditorSceneFrame(state, 'transform-constraint-change');
      },
      onTransformSnapEnabledChange: (enabled) => {
        state.transformOperationSettings = updateTransformOperationSettings(state.transformOperationSettings, {
          snap: {
            ...state.transformOperationSettings.snap,
            enabled,
          },
        });
        state.gizmo?.setOperationSettings(state.transformOperationSettings);
        state.status = enabled ? 'Transform snap enabled' : 'Transform snap disabled';
        harness.render();
        requestEditorSceneFrame(state, 'transform-operation-settings-change');
      },
      onTransformSnapStepChange: (input) => {
        const value = normalizePositiveStep(input.value);
        if (value == null) return;
        const snap = { ...state.transformOperationSettings.snap };
        if (input.kind === 'move') snap.moveStep = value;
        else if (input.kind === 'rotate') snap.rotateStepDegrees = value;
        else snap.scaleStep = value;
        state.transformOperationSettings = updateTransformOperationSettings(state.transformOperationSettings, { snap });
        state.gizmo?.setOperationSettings(state.transformOperationSettings);
        state.status = `Transform snap ${input.kind} step ${value}`;
        harness.render();
        requestEditorSceneFrame(state, 'transform-operation-settings-change');
      },
      onPlacementModeChange: (mode) => {
        state.transformOperationSettings = updateTransformOperationSettings(state.transformOperationSettings, {
          placementMode: normalizePlacementMode(mode),
        });
        state.gizmo?.setOperationSettings(state.transformOperationSettings);
        if (state.transformOperationSettings.placementMode === 'off') clearArmedPlacement(state);
        state.status = `Placement mode: ${state.transformOperationSettings.placementMode}`;
        harness.render();
        requestEditorSceneFrame(state, 'placement-mode-change');
      },
      onTransformAction: (action) => {
        if (executeTransformAction(state, options, action)) harness.render();
      },
      onViewportViewPresetChange: (preset) => {
        if (setViewportViewPreset(state, preset)) harness.render();
      },
      onViewportProjectionModeChange: (mode) => {
        if (setViewportProjectionMode(state, mode)) harness.render();
      },
      onViewportOverlaySettingsChange: (settings) => {
        if (setViewportOverlaySettings(state, settings)) harness.render();
      },
      onViewportUtilityToolChange: (tool) => {
        if (setViewportUtilityTool(state, tool)) harness.render();
      },
      onViewportMeasurementClear: () => {
        if (clearViewportMeasurement(state)) harness.render();
      },
      onSceneCameraPreviewToggle: (enabled) => {
        if (setSceneCameraPreviewEnabled(state, options, enabled)) harness.render();
      },
      onGridVisibleChange: (visible) => {
        if (setGridVisible(state, visible)) harness.render();
      },
      onFocusSelection: () => {
        if (focusSelectedProjection(state)) harness.render();
      },
      onCancelEditorIntent: () => {
        if (cancelEditorIntent(state, options)) harness.render();
      },
      onCancelActiveOperation: () => {
        cancelActiveOperation(state);
        harness.render();
      },
    },
  });

  harness = {
    render() {
      syncSceneCameraPreview(state, options);
      syncViewportCameraState(state);
      syncViewportMeasurementState(state);
      syncViewportSpatialOverlay(state);
      ui.update(createUiState(state, options));
    },
    notifyViewportRevealed(reason = 'viewport-revealed') {
      state.viewportRenderCoordinator?.requestRevealFrame(reason);
    },
    setTheme(theme) {
      ui.setTheme(theme);
    },
    getTheme() {
      return ui.getTheme();
    },
    getHostServices() {
      return options.hostServices ?? null;
    },
    getWorkingDocument() {
      return state.session?.getState().workingDocument ?? null;
    },
    async reloadAssets() {
      try {
        const assets = await options.persistenceAdapter.loadAssets();
        state.assets = assets;
        clearArmedPlacement(state);
        state.status = `Assets reloaded; assets=${assets.length}`;
        state.statusTone = 'success';
        state.statusToneStatus = state.status;
        state.statusDetails = '';
        harness.render();
        return {
          ok: true,
          assetCount: assets.length,
          status: state.status,
        };
      } catch (error) {
        state.status = 'Asset reload failed';
        state.statusTone = 'error';
        state.statusToneStatus = state.status;
        state.statusDetails = error instanceof Error ? error.message : String(error);
        harness.render();
        return {
          ok: false,
          assetCount: state.assets.length,
          status: state.status,
          error: state.statusDetails,
        };
      }
    },
    createAssetFromAssetId(assetId, createOptions) {
      const result = addAssetToDocument(state, options, assetId, createOptions);
      harness.render();
      return result;
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
      await createEditorWorld(state, options, harness.render, stats => ui.updateSceneFrameStats?.(stats));
      state.mode = 'editor';
      state.summary = loadedSource?.summary ?? summarizeDocument(options, preparedDocument, source);
      state.status = `GameWorld disposed; EditorWorld active; assets=${assets.length}`;
      harness.render();
      harness.notifyViewportRevealed('editor-enter');
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
          const failureStatus = summarizeLocalEditorAuthoringFailure(hostResult);
          state.status = failureStatus.status;
          state.statusTone = 'error';
          state.statusToneStatus = state.status;
          state.statusDetails = failureStatus.details;
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
      state.statusTone = 'success';
      state.statusToneStatus = state.status;
      state.statusDetails = '';
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
      state.statusTone = 'default';
      state.statusToneStatus = state.status;
      state.statusDetails = '';
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

export function mergeLocalEditorHarnessInspectorComponentSections<TDocument>(
  input: LocalEditorHarnessInspectorComponentMergeInput<TDocument>,
): InspectorObject<TDocument> {
  const components = input.components;
  if (!components) return input.inspectorObject;
  const context = {
    ...input.inspectorObject.selection,
    ...input.context,
    targetIds: input.context?.targetIds ?? input.inspectorObject.targetIds,
    activeId: input.context?.activeId ?? input.inspectorObject.activeId,
    document: input.context?.document ?? input.inspectorObject.document ?? input.inspectorObject.selection.document,
  };
  const componentSections = getInspectorComponentSections({
    components,
    context,
    componentConflict: input.componentConflict,
    propertyConflict: input.propertyConflict,
  });
  if (componentSections.length === 0) return input.inspectorObject;
  return {
    ...input.inspectorObject,
    sections: mergeInspectorSections(input.inspectorObject.sections, componentSections, {
      propertyConflict: input.propertyConflict,
    }),
  };
}

function normalizeTransformConstraint(
  tool: EditorTransformTool,
  constraint?: EditorTransformConstraint | null,
): EditorTransformCanonicalConstraint {
  return normalizeEditorTransformConstraint(tool, constraint) ?? 'axis';
}

function cloneTransformOperationSettings(
  settings: EditorTransformOperationSettings,
): EditorTransformOperationSettings {
  return {
    snap: {
      enabled: settings.snap.enabled,
      moveStep: settings.snap.moveStep,
      rotateStepDegrees: settings.snap.rotateStepDegrees,
      scaleStep: settings.snap.scaleStep,
    },
    placementMode: settings.placementMode,
  };
}

function updateTransformOperationSettings(
  current: EditorTransformOperationSettings,
  patch: Partial<EditorTransformOperationSettings>,
): EditorTransformOperationSettings {
  return {
    ...current,
    ...patch,
    snap: patch.snap
      ? { ...current.snap, ...patch.snap }
      : { ...current.snap },
  };
}

function normalizePositiveStep(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Number(value.toFixed(4));
}

function normalizePlacementMode(mode: EditorPlacementMode): EditorPlacementMode {
  return mode === 'ground' || mode === 'surface' ? mode : 'off';
}

function normalizeViewportViewPreset(
  preset: EditorViewportViewPreset,
): EditorViewportViewPreset {
  return preset === 'top' || preset === 'front' || preset === 'right' ? preset : 'perspective';
}

function normalizeViewportProjectionMode(
  mode: EditorViewportProjectionMode,
): EditorViewportProjectionMode {
  return mode === 'orthographic' ? 'orthographic' : 'perspective';
}

function createEmptyViewportMeasurement(): EditorViewportGroundMeasurement {
  return {
    active: false,
    start: null,
    end: null,
    preview: null,
    distance: null,
    screenStart: null,
    screenEnd: null,
    screenPreview: null,
    label: null,
  };
}

function cloneViewportMeasurement(
  measurement: EditorViewportGroundMeasurement,
): EditorViewportGroundMeasurement {
  return {
    active: measurement.active,
    start: measurement.start ? { ...measurement.start } : null,
    end: measurement.end ? { ...measurement.end } : null,
    preview: measurement.preview ? { ...measurement.preview } : null,
    distance: measurement.distance,
    screenStart: measurement.screenStart ? { ...measurement.screenStart } : null,
    screenEnd: measurement.screenEnd ? { ...measurement.screenEnd } : null,
    screenPreview: measurement.screenPreview ? { ...measurement.screenPreview } : null,
    label: measurement.label ? { ...measurement.label } : null,
  };
}

function setViewportViewPreset<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  preset: EditorViewportViewPreset,
): boolean {
  if (state.sceneCameraPreviewEnabled) {
    state.status = 'Viewport view unavailable during Scene Camera preview';
    state.statusTone = 'warning';
    state.statusToneStatus = state.status;
    state.statusDetails = 'Disable Scene Camera preview before switching editor viewport views.';
    return true;
  }
  const nextPreset = normalizeViewportViewPreset(preset);
  const target = resolveViewportPresetTarget(state);
  const radius = resolveViewportPresetRadius(state);
  const changed = state.sceneViewCamera?.setViewPreset(nextPreset, { target, radius }) ?? false;
  if (!changed) return false;
  const cameraState = state.sceneViewCamera?.getState();
  state.viewportTools = {
    ...state.viewportTools,
    viewPreset: cameraState?.viewPreset ?? nextPreset,
    projectionMode: cameraState?.projectionMode ?? (nextPreset === 'perspective' ? 'perspective' : 'orthographic'),
  };
  state.status = `Viewport view: ${state.viewportTools.viewPreset}`;
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  requestEditorSceneFrame(state, 'viewport-view-preset');
  return true;
}

function setViewportProjectionMode<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  mode: EditorViewportProjectionMode,
): boolean {
  if (state.sceneCameraPreviewEnabled) {
    state.status = 'Viewport projection unavailable during Scene Camera preview';
    state.statusTone = 'warning';
    state.statusToneStatus = state.status;
    state.statusDetails = 'Disable Scene Camera preview before switching editor viewport projection.';
    return true;
  }
  const nextMode = normalizeViewportProjectionMode(mode);
  const changed = state.sceneViewCamera?.setProjectionMode(nextMode) ?? false;
  if (!changed) return false;
  const cameraState = state.sceneViewCamera?.getState();
  state.viewportTools = {
    ...state.viewportTools,
    projectionMode: cameraState?.projectionMode ?? nextMode,
  };
  state.status = `Viewport projection: ${state.viewportTools.projectionMode}`;
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  requestEditorSceneFrame(state, 'viewport-projection-mode');
  return true;
}

function setViewportOverlaySettings<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  settings: Partial<EditorViewportOverlaySettings>,
): boolean {
  state.viewportTools = {
    ...state.viewportTools,
    overlay: {
      ...state.viewportTools.overlay,
      bounds: settings.bounds ?? state.viewportTools.overlay.bounds,
      dimensions: settings.dimensions ?? state.viewportTools.overlay.dimensions,
      edgeLengths: settings.edgeLengths ?? state.viewportTools.overlay.edgeLengths,
      anchor: settings.anchor ?? state.viewportTools.overlay.anchor,
    },
  };
  state.status = 'Viewport overlay settings updated';
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  return true;
}

function setViewportUtilityTool<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  tool: EditorViewportUtilityTool,
): boolean {
  const nextTool = tool === 'measure-distance' ? 'measure-distance' : 'none';
  state.viewportTools = {
    ...state.viewportTools,
    activeUtilityTool: nextTool,
  };
  if (nextTool === 'measure-distance') {
    state.viewportMeasurement = {
      ...cloneViewportMeasurement(state.viewportMeasurement),
      active: !!state.viewportMeasurement.start && !state.viewportMeasurement.end,
    };
    state.status = 'Measure distance: pick first XZ ground point';
  } else {
    const unfinishedMeasurement = state.viewportMeasurement.active
      || (!!state.viewportMeasurement.start && !state.viewportMeasurement.end);
    state.viewportMeasurement = unfinishedMeasurement
      ? state.sceneViewMeasurement?.clear() ?? createEmptyViewportMeasurement()
      : {
          ...cloneViewportMeasurement(state.viewportMeasurement),
          active: false,
          preview: null,
          screenPreview: null,
        };
    state.status = 'Viewport utility: none';
  }
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  requestEditorSceneFrame(state, 'viewport-utility-tool');
  return true;
}

function clearViewportMeasurement<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): boolean {
  state.viewportMeasurement = state.sceneViewMeasurement?.clear() ?? createEmptyViewportMeasurement();
  state.viewportTools = {
    ...state.viewportTools,
    activeUtilityTool: 'none',
  };
  state.status = 'Measurement cleared';
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  requestEditorSceneFrame(state, 'viewport-measurement-clear');
  return true;
}

export function applyLocalEditorHarnessViewportMeasurementPointerStart(
  state: LocalEditorHarnessViewportMeasurementState,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
): boolean {
  if (state.viewportTools.activeUtilityTool !== 'measure-distance') return false;
  if (!state.viewportMeasurement.start || state.viewportMeasurement.end) {
    const next = state.sceneViewMeasurement?.beginAt(event.clientX, event.clientY) ?? null;
    if (!next) return false;
    state.viewportMeasurement = next;
    state.status = 'Measure distance: pick second XZ ground point';
    state.statusTone = 'default';
    state.statusToneStatus = state.status;
    state.statusDetails = '';
    return true;
  }
  const next = state.sceneViewMeasurement?.completeAt(event.clientX, event.clientY) ?? null;
  if (!next) return false;
  state.viewportMeasurement = next;
  state.viewportTools = {
    ...state.viewportTools,
    activeUtilityTool: 'none',
  };
  state.status = `Measured distance: ${formatViewportMeasurementDistance(next.distance)} units`;
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = next.start && next.end
    ? `A (${formatViewportMeasurementDistance(next.start.x)}, ${formatViewportMeasurementDistance(next.start.z)}) · B (${formatViewportMeasurementDistance(next.end.x)}, ${formatViewportMeasurementDistance(next.end.z)})`
    : '';
  return true;
}

export function applyLocalEditorHarnessViewportMeasurementPointerMove(
  state: LocalEditorHarnessViewportMeasurementState,
  event: Pick<PointerEvent, 'clientX' | 'clientY'>,
): boolean {
  if (state.viewportTools.activeUtilityTool !== 'measure-distance') return false;
  const next = state.sceneViewMeasurement?.previewAt(event.clientX, event.clientY) ?? null;
  if (!next) return false;
  state.viewportMeasurement = next;
  return true;
}

export function applyLocalEditorHarnessViewportMeasurementPointerEnd(
  _state: LocalEditorHarnessViewportMeasurementState,
): boolean {
  return false;
}

function handleViewportMeasurementStart<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  event: PointerEvent,
): boolean {
  return applyLocalEditorHarnessViewportMeasurementPointerStart(state, event);
}

function handleViewportMeasurementMove<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  event: PointerEvent,
): boolean {
  return applyLocalEditorHarnessViewportMeasurementPointerMove(state, event);
}

function handleViewportMeasurementEnd<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): boolean {
  return applyLocalEditorHarnessViewportMeasurementPointerEnd(state);
}

function formatViewportMeasurementDistance(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value as number) < 0.005 ? 0 : value as number;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function resolveViewportPresetTarget<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): EditorTransformVec3 | null {
  const selection = state.session?.getState().selection;
  const activeId = selection?.activeId ?? null;
  if (!activeId || selection?.selectedIds.length !== 1) return null;
  const bounds = state.projection?.getSelectionBounds([activeId]) ?? null;
  return bounds?.center ?? null;
}

function resolveViewportPresetRadius<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): number | undefined {
  const selection = state.session?.getState().selection;
  const activeId = selection?.activeId ?? null;
  if (!activeId || selection?.selectedIds.length !== 1) return undefined;
  const bounds = state.projection?.getSelectionBounds([activeId]) ?? null;
  if (!bounds) return undefined;
  const size = bounds.size;
  const radius = Math.hypot(size.x, size.y, size.z);
  return Number.isFinite(radius) && radius > 0 ? Math.max(radius * 1.5, 2) : undefined;
}

function validateTransformActionSelection<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  action: EditorTransformAction,
): { ok: true } | { ok: false; message: string } {
  const selection = state.session?.getState().selection;
  const selectedCount = selection?.selectedIds.length ?? 0;
  if (action.startsWith('align-')) {
    return selectedCount >= 2 && selection?.activeId
      ? { ok: true }
      : { ok: false, message: 'Align needs at least 2 selected objects and an active object' };
  }
  return selectedCount >= 3
    ? { ok: true }
    : { ok: false, message: 'Distribute needs at least 3 selected objects' };
}

async function createEditorWorld<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  renderUi: () => void,
  updateSceneFrameStats: (stats: LocalEditorSceneRenderStats | null) => void,
): Promise<void> {
  disposeEditorWorld(state);
  const render = (reason = 'editor-world-update'): void => {
    renderUi();
    requestEditorSceneFrame(state, reason);
  };
  const canvas = options.worldAdapter.getCanvas();
  if (!canvas) throw new Error('Editor canvas not found');
  const babylon = await options.worldAdapter.loadBabylon();
  const engine = options.worldAdapter.createEngine(babylon, canvas);
  const document = state.session?.getState().workingDocument;
  const initialAppearance = resolveLocalEditorWorldAppearance(options, document);
  const initialAppearanceKey = serializeLocalEditorWorldAppearance(initialAppearance);
  const initialRendering = resolveLocalEditorWorldRendering(options, document);
  const initialRenderingKey = serializeLocalEditorWorldRendering(initialRendering);
  const world = createBabylonEditorWorld({
    engine,
    canvas,
    babylon,
    cameraTarget: options.world?.cameraTarget,
    cameraRadius: options.world?.cameraRadius,
    clearColor: initialAppearance.clearColor,
    sky: initialAppearance.sky,
    useRightHandedSystem: options.world?.useRightHandedSystem,
    enableDefaultCameraControls: false,
  });
  const sceneRenderScheduler = createLocalEditorSceneRenderScheduler((frame) => {
    state.sceneViewInteraction?.updateFrame(frame);
    world.render();
  }, {
    onStatsChange(stats) {
      state.sceneFrameStats = stats;
      updateSceneFrameStats(stats);
    },
  });
  const viewportRenderCoordinator = createLocalEditorViewportRenderCoordinator({
    scheduler: sceneRenderScheduler,
    getEngine: () => engine,
    getScene: () => world.scene,
  });
  const sceneViewInteraction = createLocalEditorSceneViewInteractionRuntime({
    coordinator: viewportRenderCoordinator,
    getCamera: () => state.sceneViewCamera,
  });
  state.sceneViewInteraction = sceneViewInteraction;
  const grid = options.createGrid?.(babylon, world.scene, world.camera, {
    getCamera: () => world.scene?.activeCamera ?? world.camera ?? null,
    getEditorCamera: () => world.camera ?? null,
  }) ?? null;
  if (initialAppearance.grid) grid?.setColors(initialAppearance.grid);
  grid?.setVisible(state.gridVisible);
  const projection = createBabylonEditorProjection({
    babylon,
    scene: world.scene,
    importModel: options.worldAdapter.importProjectionModel,
    logger: console,
    onProjectionReady(event) {
      syncCurrentSelectionToSceneArtifacts(state);
      viewportRenderCoordinator.invalidateScene(`projection-${event.nodeId}-ready`);
    },
  });
  const gizmo = createBabylonTransformGizmoController({
    babylon,
    scene: world.scene,
    projection,
    initialTool: state.transformTool,
    initialSpace: state.transformSpace,
    logger: console,
    onDragStart(event) {
      sceneViewInteraction.beginGizmoDrag();
      state.status = event.targetIds.length > 1
        ? `Dragging ${event.duplicate ? 'duplicate ' : ''}${event.tool} ${event.targetIds.length} objects`
        : `Dragging ${event.duplicate ? 'duplicate ' : ''}${event.tool} ${event.nodeId ?? event.activeId ?? 'selection'}`;
      render();
    },
    onDragUpdate() {
      render();
    },
    onDragEnd(event) {
      sceneViewInteraction.endGizmoDrag();
      const changed = commitGizmoTransform(state, options, event);
      if (!changed) requestEditorSceneFrame(state, 'gizmo-drag-end');
      renderUi();
    },
    onDragCancel(event) {
      sceneViewInteraction.endGizmoDrag();
      if (event.duplicate && cancelDuplicateDrag(state, options)) {
        render();
        return;
      }
      state.status = event.targetIds.length > 1
        ? `Canceled ${event.tool} ${event.targetIds.length} objects`
        : `Canceled ${event.tool} ${event.nodeId ?? event.activeId ?? 'selection'}`;
      render();
    },
    onDragBlocked(event) {
      sceneViewInteraction.endGizmoDrag();
      if (event.duplicate) cancelDuplicateDrag(state, options);
      requestEditorSceneFrame(state, 'gizmo-drag-blocked');
      state.status = formatBlockedGizmoTransformStatus(event);
      state.statusTone = 'warning';
      state.statusToneStatus = state.status;
      renderUi();
    },
    onDuplicateDragStart(input) {
      return beginDuplicateDrag(state, options, input);
    },
  });
  gizmo.setOperationSettings(state.transformOperationSettings);
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
  const sceneViewMeasurement = createBabylonSceneViewMeasurementController({
    babylon,
    scene: world.scene,
  });
  const sceneViewInput = createBabylonSceneViewInputController({
    canvas,
    isEnabled: () => state.mode === 'editor',
    isGizmoDragCandidate: (event) => gizmo.isGizmoDragCandidate(event),
    isBoxSelectCandidate: (event) => selectionController.isBoxSelectionCandidate(event),
    isViewPlaneMoveCandidate: (event) => gizmo.isViewPlaneMoveCandidate(event),
    isPlacementCandidate: () => isPlacementArmed(state),
    isMeasurementCandidate: () => state.viewportTools.activeUtilityTool === 'measure-distance',
    onPointerIntentStart(event) {
      sceneViewInteraction.beginPointerIntent(event.state.intent);
      if (event.state.intent === 'measurement') {
        if (handleViewportMeasurementStart(state, event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'gizmo-drag') {
        gizmo.preparePointerDrag(event.originalEvent);
        return;
      }
      if (event.state.intent === 'placement') {
        if (previewArmedPlacement(state, event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'view-plane-move') {
        if (gizmo.beginViewPlaneMove(event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.beginPointerSelection(event.originalEvent);
        requestEditorSceneFrame(state, 'viewport-pointer-selection-start');
      }
    },
    onPointerIntentMove(event) {
      if (event.state.intent === 'measurement') {
        if (handleViewportMeasurementMove(state, event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'placement') {
        if (previewArmedPlacement(state, event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'view-plane-move') {
        if (gizmo.updateViewPlaneMove(event.originalEvent)) render();
        return;
      }
      if (!state.sceneCameraPreviewEnabled && state.sceneViewCamera?.handlePointerIntentMove(event)) {
        render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.updatePointerSelection(event.originalEvent, event.state.intent);
        requestEditorSceneFrame(state, 'viewport-pointer-selection-update');
      }
    },
    onPointerIntentEnd(event) {
      sceneViewInteraction.endPointerIntent(event.state.intent);
      if (event.state.intent === 'measurement') {
        if (handleViewportMeasurementEnd(state)) render();
        return;
      }
      if (event.state.intent === 'placement') {
        if (commitArmedPlacement(state, options, event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'view-plane-move') {
        if (gizmo.endViewPlaneMove(event.originalEvent)) render();
        return;
      }
      if (event.state.intent === 'selection-click' || event.state.intent === 'box-select') {
        selectionController.endPointerSelection(event.originalEvent, event.state.intent);
        requestEditorSceneFrame(state, 'viewport-pointer-selection-end');
      }
    },
    onPointerIntentCancel(event) {
      sceneViewInteraction.cancelPointerIntent(event.state.intent);
      if (event.state.intent === 'measurement') {
        render();
        return;
      }
      if (event.state.intent === 'placement') {
        state.gizmo?.setPlacementMarker(null);
        render();
        return;
      }
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
      if (!state.sceneCameraPreviewEnabled && state.sceneViewCamera?.handleWheel(event)) render();
    },
    onMovementKeysChange(event) {
      sceneViewInteraction.updateMovementKeys(event.pressedMovementKeys);
      renderUi();
    },
  });
  const sceneViewCamera = createBabylonSceneViewCameraController({
    babylon,
    scene: world.scene,
    camera: world.camera,
    input: sceneViewInput,
  });
  const sceneCameraPreview = createBabylonSceneCameraPreviewController({
    babylon,
    scene: world.scene,
    editorCamera: world.camera,
  });
  const sceneViewSpatialOverlay = createBabylonSceneViewSpatialOverlayController({
    babylon,
    scene: world.scene,
  });
  if (document) {
    projection.projectNodes(options.documentAdapter.getProjectionNodes(document));
    const selection = state.session?.getState().selection ?? { selectedIds: [], activeId: null };
    projection.syncSelection(selection);
    gizmo.setSelection(selection);
  }
  const shadowPreview = createBabylonEditorShadowPreviewController({
    scene: world.scene,
    projection,
    options: initialRendering.shadowPreview,
  });
  const resize = () => {
    engine.resize?.();
    viewportRenderCoordinator.requestFrame('resize');
  };
  window.addEventListener('resize', resize);
  state.babylon = babylon;
  state.engine = engine;
  state.world = world;
  state.grid = grid;
  state.projection = projection;
  state.shadowPreview = shadowPreview;
  state.gizmo = gizmo;
  state.sceneCameraPreview = sceneCameraPreview;
  state.sceneViewInput = sceneViewInput;
  state.sceneViewCamera = sceneViewCamera;
  state.sceneViewMeasurement = sceneViewMeasurement;
  state.sceneViewSpatialOverlay = sceneViewSpatialOverlay;
  state.selectionController = selectionController;
  state.sceneRenderScheduler = sceneRenderScheduler;
  state.viewportRenderCoordinator = viewportRenderCoordinator;
  state.sceneFrameStats = sceneRenderScheduler.getStats();
  state.worldAppearanceKey = initialAppearanceKey;
  state.worldRenderingKey = initialRenderingKey;
  state.resizeHandler = resize;
  viewportRenderCoordinator.requestFrame('editor-world-created');
}

function disposeEditorWorld<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  state.sceneViewInteraction?.dispose();
  state.sceneViewInteraction = null;
  if (state.resizeHandler) {
    window.removeEventListener('resize', state.resizeHandler);
    state.resizeHandler = null;
  }
  state.sceneCameraPreview?.dispose();
  state.sceneCameraPreview = null;
  state.sceneCameraPreviewEnabled = false;
  state.sceneViewCamera?.dispose();
  state.sceneViewCamera = null;
  state.sceneViewMeasurement?.dispose();
  state.sceneViewMeasurement = null;
  state.sceneViewSpatialOverlay?.dispose();
  state.sceneViewSpatialOverlay = null;
  state.sceneViewInput?.dispose();
  state.sceneViewInput = null;
  state.selectionController?.dispose();
  state.selectionController = null;
  state.viewportRenderCoordinator?.dispose();
  state.viewportRenderCoordinator = null;
  state.sceneRenderScheduler?.dispose();
  state.sceneRenderScheduler = null;
  state.sceneFrameStats = null;
  state.boxSelection = null;
  state.viewportSpatialOverlay = createEmptyEditorViewportSpatialOverlayState();
  state.viewportMeasurement = createEmptyViewportMeasurement();
  state.viewportTools = {
    ...state.viewportTools,
    activeUtilityTool: 'none',
  };
  state.gizmo?.dispose();
  state.gizmo = null;
  state.shadowPreview?.dispose();
  state.shadowPreview = null;
  state.projection?.dispose();
  state.projection = null;
  state.grid?.dispose();
  state.grid = null;
  state.engine?.stopRenderLoop?.();
  state.world?.dispose();
  state.engine?.dispose?.();
  state.babylon = null;
  state.world = null;
  state.engine = null;
}

function requestEditorSceneFrame<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  reason: string,
): void {
  state.viewportRenderCoordinator?.requestFrame(reason);
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
    state.statusTone = 'error';
    state.statusToneStatus = state.status;
    state.statusDetails = state.status;
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
  const selection = state.session?.getState().selection ?? { selectedIds: [], activeId: null };
  const command = resolveEditorSelectionCommand({
    selection,
    targetIds: [input.id],
    activeId: input.id,
    gesture: 'click',
    modifier: input.toggle ? 'toggle' : input.additive ? 'additive' : 'replace',
  });
  if (!command) return false;
  return dispatchSelectionCommand(state, options, command);
}

function createBrowserHierarchyContextActions<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): LocalEditorBrowserHierarchyContextActionRegistration<TDocument>[] {
  return (options.hierarchy?.contextActions ?? []).map((registration) => ({
    id: registration.id,
    label: registration.label,
    shortcut: registration.shortcut,
    danger: registration.danger,
    placement: registration.placement,
    separatorBefore: registration.separatorBefore,
    visible: (browserContext) => {
      const context = createHarnessHierarchyContextActionContext(state, options, browserContext);
      if (!context) return false;
      return registration.visible?.(context) ?? true;
    },
    disabled: (browserContext) => {
      const context = createHarnessHierarchyContextActionContext(state, options, browserContext);
      if (!context) return 'No editable document is loaded.';
      return registration.disabled?.(context) ?? false;
    },
  }));
}

function createHarnessHierarchyContextActionContext<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  browserContext: LocalEditorBrowserHierarchyContextActionContext<TDocument>,
  payload?: Record<string, unknown>,
): LocalEditorHarnessHierarchyContextActionContext<TDocument> | null {
  const document = state.session?.getState().workingDocument ?? null;
  if (!document) return null;
  const activeId = browserContext.activeId;
  return {
    document,
    contextNodeId: browserContext.contextNodeId,
    targetIds: browserContext.targetIds,
    activeId,
    hierarchyItem: browserContext.node,
    projectionNode: browserContext.contextNodeId
      ? options.documentAdapter.getProjectionNode(document, browserContext.contextNodeId)
      : null,
    hostServices: options.hostServices ?? null,
    payload,
    browserContext,
  };
}

function createBrowserContextForCustomAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  action: Extract<LocalEditorContextAction, { region: 'hierarchy'; action: 'custom' }>,
): LocalEditorBrowserHierarchyContextActionContext<TDocument> | null {
  const document = state.session?.getState().workingDocument ?? null;
  if (!document) return null;
  const uiState = createUiState(state, options);
  const node = action.contextNodeId
    ? uiState.hierarchy.find(item => item.id === action.contextNodeId) ?? null
    : null;
  return {
    state: uiState,
    menuKind: node ? 'node' : 'blank',
    node,
    contextNodeId: action.contextNodeId,
    targetIds: action.targetIds,
    activeId: action.activeId,
  };
}

function runHierarchyCustomContextAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  action: Extract<LocalEditorContextAction, { region: 'hierarchy'; action: 'custom' }>,
): boolean {
  const registration = options.hierarchy?.contextActions?.find(candidate => candidate.id === action.id);
  if (!registration) return false;
  const browserContext = createBrowserContextForCustomAction(state, options, action);
  const context = browserContext
    ? createHarnessHierarchyContextActionContext(state, options, browserContext, action.payload)
    : null;
  if (!context) return false;
  try {
    return registration.run(context) === true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.status = `${registration.label} failed`;
    state.statusTone = 'error';
    state.statusToneStatus = state.status;
    state.statusDetails = message;
    console.error('[LocalEditorHarness] hierarchy context action failed', error);
    return true;
  }
}

function handleContextAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  action: LocalEditorContextAction,
): boolean {
  if (action.region !== 'hierarchy') return false;
  if (action.action === 'custom') return runHierarchyCustomContextAction(state, options, action);
  if (action.action === 'focus') {
    const activeId = action.activeId ?? action.targetIds[action.targetIds.length - 1] ?? null;
    const selectionChanged = activeId && !state.session?.getState().selection.selectedIds.includes(activeId)
      ? dispatchSelectionCommand(state, options, {
          type: 'selection.replace',
          selectedIds: [activeId],
          activeId,
          label: 'Select Context Target',
        })
      : false;
    return focusSelectedProjection(state) || selectionChanged;
  }
  if (action.action === 'rename') return false;
  if (action.action === 'create-group') {
    return createSceneGraphGroup(state, options, {
      parentId: action.parentId ?? null,
      activeId: action.activeId ?? null,
      name: 'Empty',
    });
  }
  if (action.action === 'create-primitive') {
    return createSceneGraphPrimitive(state, options, {
      parentId: action.parentId ?? null,
      activeId: action.activeId ?? null,
      shape: action.shape,
      name: action.name,
    });
  }
  if (action.action === 'delete') {
    return deleteSceneGraphNodes(state, options, {
      ids: action.targetIds,
      activeId: action.activeId ?? null,
    });
  }
  if (action.action === 'duplicate') {
    return duplicateSceneGraphNodes(state, options, {
      targetIds: action.targetIds,
      activeId: action.activeId ?? null,
    });
  }
  if (action.action === 'paste') {
    return duplicateSceneGraphNodes(state, options, {
      targetIds: action.sourceIds,
      activeId: action.activeId ?? null,
    });
  }
  return false;
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
    state.status = 'Create empty rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? 'Create Empty',
    patch: patch.patch,
    targetId: patch.createdId ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Create empty unchanged';
    return true;
  }
  const createdId = patch.createdId ?? null;
  let selection = result.selection;
  if (createdId && isNodeSelectableInDocument(options, result.workingDocument, createdId)) {
    selection = state.session.dispatch({
      type: 'selection.replace',
      selectedIds: [createdId],
      activeId: createdId,
      label: 'Select Created Empty',
    }).selection;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? (createdId ? `Created empty ${createdId}` : 'Created empty');
  return true;
}

function createSceneGraphPrimitive<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphCreatePrimitiveIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const patch = options.documentAdapter.createSceneGraphCreatePrimitivePatch?.(document, intent);
  if (!patch) {
    state.status = `Create ${intent.shape} rejected`;
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Create ${intent.shape}`,
    patch: patch.patch,
    targetId: patch.createdId ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = `Create ${intent.shape} unchanged`;
    return true;
  }
  const createdId = patch.createdId ?? null;
  let selection = result.selection;
  if (createdId && isNodeSelectableInDocument(options, result.workingDocument, createdId)) {
    selection = state.session.dispatch({
      type: 'selection.replace',
      selectedIds: [createdId],
      activeId: createdId,
      label: 'Select Created Primitive',
    }).selection;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? (createdId ? `Created ${intent.shape} ${createdId}` : `Created ${intent.shape}`);
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

function duplicateSceneGraphNodes<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: { targetIds: string[]; activeId?: string | null },
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const targetIds = Array.from(new Set(intent.targetIds.filter(Boolean)));
  if (targetIds.length === 0) {
    state.status = 'Duplicate rejected: empty selection';
    return true;
  }
  const patch = options.documentAdapter.createDuplicateSelectionPatch?.({
    document,
    targetIds,
    activeId: intent.activeId && targetIds.includes(intent.activeId) ? intent.activeId : targetIds[targetIds.length - 1] ?? null,
    transforms: {},
  });
  if (!patch || patch.createdIds.length === 0) {
    state.status = 'Duplicate rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Duplicate ${targetIds.length} object(s)`,
    patch: patch.patch,
    targetId: patch.activeId ?? patch.createdIds[patch.createdIds.length - 1] ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Duplicate unchanged';
    return true;
  }
  const createdIds = patch.createdIds.filter(id => isNodeSelectableInDocument(options, result.workingDocument, id));
  const activeId = patch.activeId && createdIds.includes(patch.activeId)
    ? patch.activeId
    : createdIds[createdIds.length - 1] ?? null;
  const selection = createdIds.length > 0
    ? state.session.dispatch({
        type: 'selection.replace',
        selectedIds: createdIds,
        activeId,
        label: 'Select Duplicated Nodes',
      }).selection
    : sanitizeSelection(state, options, result.workingDocument, result.selection) ?? result.selection;
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  if (patch.reprojectIds?.length) reprojectProjectionForChangedIds(state, options, result.workingDocument, patch.reprojectIds);
  else syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds ?? createdIds);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Duplicated ${createdIds.length} object(s)`;
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

function moveSceneGraphNodes<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphMoveIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const hierarchy = options.documentAdapter.getHierarchyItems(document);
  const coreValidation = validateSceneGraphMove(hierarchy, intent);
  if (!coreValidation.ok) {
    state.status = `Move rejected: ${coreValidation.reason ?? 'invalid scene graph move'}`;
    return true;
  }
  const projectValidation = options.documentAdapter.validateSceneGraphMove?.(document, intent);
  if (projectValidation && !projectValidation.ok) {
    state.status = `Move rejected: ${projectValidation.reason ?? 'project validation failed'}`;
    return true;
  }
  if (!options.documentAdapter.createSceneGraphMovePatch && intent.placement === 'inside' && intent.ids.length === 1 && intent.targetId) {
    return dropSceneGraphNode(state, options, {
      draggedId: intent.ids[0]!,
      targetId: intent.targetId,
      placement: 'inside',
      preserveWorldTransform: intent.preserveWorldTransform,
    });
  }
  const patch = options.documentAdapter.createSceneGraphMovePatch?.(document, intent);
  if (!patch) {
    state.status = 'Move rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Move ${intent.ids.length} node(s)`,
    patch: patch.patch,
    targetId: intent.ids[0] ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Move unchanged';
    return true;
  }
  const selection = sanitizeSelection(state, options, result.workingDocument, result.selection) ?? result.selection;
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Moved ${patch.changedIds?.length ?? intent.ids.length} node(s)`;
  return true;
}

function groupSceneGraphSelection<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  intent: SceneGraphGroupSelectionIntent,
): boolean {
  const document = state.session?.getState().workingDocument;
  if (state.mode !== 'editor' || !state.session || !document) return false;
  cancelActiveOperation(state);
  const hierarchy = options.documentAdapter.getHierarchyItems(document);
  const coreValidation = validateSceneGraphGroupSelection(hierarchy, intent);
  if (!coreValidation.ok) {
    state.status = `Parent selection rejected: ${coreValidation.reason ?? 'invalid scene graph parent selection'}`;
    return true;
  }
  const projectValidation = options.documentAdapter.validateSceneGraphGroupSelection?.(document, intent);
  if (projectValidation && !projectValidation.ok) {
    state.status = `Parent selection rejected: ${projectValidation.reason ?? 'project validation failed'}`;
    return true;
  }
  const patch = options.documentAdapter.createSceneGraphGroupSelectionPatch?.(document, intent);
  if (!patch) {
    state.status = 'Parent selection rejected';
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? 'Parent Selection',
    patch: patch.patch,
    targetId: patch.createdId,
  });
  if (!result.documentChanged) {
    state.status = 'Parent selection unchanged';
    return true;
  }
  let selection = result.selection;
  if (patch.createdId && isNodeSelectableInDocument(options, result.workingDocument, patch.createdId)) {
    selection = state.session.dispatch({
      type: 'selection.replace',
      selectedIds: [patch.createdId],
      activeId: patch.createdId,
      label: 'Select Created Parent',
    }).selection;
  } else {
    selection = sanitizeSelection(state, options, result.workingDocument, selection) ?? selection;
  }
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Parented ${patch.changedIds?.length ?? intent.ids.length} node(s)`;
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
  requestEditorSceneFrame(state, 'projection-selection');
}

function syncCurrentSelectionToSceneArtifacts<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  syncSelectionToProjection(
    state,
    state.session?.getState().selection ?? { selectedIds: [], activeId: null },
  );
}

function invalidateEditorScene<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  reason: string,
  options?: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): void {
  if (options && state.sceneCameraPreviewEnabled) {
    syncSceneCameraPreview(state, options);
  }
  state.viewportRenderCoordinator?.invalidateScene(reason);
}

function syncEditorWorldAppearanceFromDocument<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  reason: string,
): void {
  const appearance = resolveLocalEditorWorldAppearance(options, document);
  const key = serializeLocalEditorWorldAppearance(appearance);
  if (key === state.worldAppearanceKey) return;
  state.worldAppearanceKey = key;
  state.world?.setAppearance({
    clearColor: appearance.clearColor,
    sky: appearance.sky,
  });
  state.grid?.setColors(appearance.grid ?? {});
  requestEditorSceneFrame(state, reason);
}

function syncEditorWorldRenderingFromDocument<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  reason: string,
  refreshProjection = false,
): void {
  const rendering = resolveLocalEditorWorldRendering(options, document);
  const key = serializeLocalEditorWorldRendering(rendering);
  if (key === state.worldRenderingKey) {
    if (refreshProjection) state.shadowPreview?.refresh();
    return;
  }
  state.worldRenderingKey = key;
  state.shadowPreview?.setOptions(rendering.shadowPreview);
  requestEditorSceneFrame(state, reason);
}

function resolveLocalEditorWorldAppearance<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument | undefined,
): LocalEditorHarnessWorldAppearance {
  const documentAppearance = document
    ? options.documentAdapter.getWorldAppearance?.(document) ?? null
    : null;
  return {
    clearColor: documentAppearance?.clearColor ?? options.world?.clearColor,
    sky: hasEditorWorldAppearanceSky(documentAppearance) ? documentAppearance.sky : options.world?.sky,
    grid: documentAppearance?.grid ?? options.world?.grid,
  };
}

function resolveLocalEditorWorldRendering<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument | undefined,
): LocalEditorHarnessWorldRendering {
  const documentRendering = document
    ? options.documentAdapter.getWorldRendering?.(document) ?? null
    : null;
  return {
    shadowPreview: documentRendering?.shadowPreview ?? null,
  };
}

function hasEditorWorldAppearanceSky(
  appearance: LocalEditorHarnessWorldAppearance | null,
): appearance is LocalEditorHarnessWorldAppearance & Pick<Required<LocalEditorHarnessWorldAppearance>, 'sky'> {
  return !!appearance && Object.prototype.hasOwnProperty.call(appearance, 'sky');
}

function serializeLocalEditorWorldAppearance(appearance: LocalEditorHarnessWorldAppearance): string {
  return JSON.stringify({
    clearColor: appearance.clearColor ?? null,
    sky: hasEditorWorldAppearanceSky(appearance) ? appearance.sky : null,
    grid: appearance.grid ?? null,
  });
}

function serializeLocalEditorWorldRendering(rendering: LocalEditorHarnessWorldRendering): string {
  return JSON.stringify({
    shadowPreview: rendering.shadowPreview ?? null,
  });
}

function executeTransformAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  action: EditorTransformAction,
): boolean {
  if (state.mode !== 'editor' || !state.session) return false;
  const document = state.session.getState().workingDocument;
  const selection = state.session.getState().selection;
  cancelActiveOperation(state);
  const validation = validateTransformActionSelection(state, action);
  if (!validation.ok) {
    state.status = validation.message;
    return true;
  }
  const beforeTransforms = state.projection?.readNodeTransforms(selection.selectedIds) ?? {};
  const transformTargets = selection.selectedIds
    .map((id) => {
      const transform = beforeTransforms[id];
      return transform ? { id, transform } : null;
    })
    .filter((target): target is { id: string; transform: EditorTransformSnapshot } => !!target);
  const targets = computeEditorTransformActionTargets({
    action,
    activeId: selection.activeId,
    targets: transformTargets,
  });
  if (targets.length === 0) {
    state.status = `Transform action rejected: ${action}`;
    return true;
  }
  const changedTargets = targets.filter(target => !editorTransformSnapshotsEqual(target.before, target.after));
  if (changedTargets.length === 0) {
    state.status = `Transform action unchanged: ${action}`;
    return true;
  }
  const patch = options.documentAdapter.createTransformBatchPatch?.({
    document,
    targetIds: changedTargets.map(target => target.id),
    activeId: selection.activeId,
    tool: 'move',
    space: 'world',
    constraint: action === 'align-all' ? 'free' : 'axis',
    pivot: createTransformActionPivot(targets),
    targets: changedTargets,
  });
  if (!patch) {
    state.status = `Transform action ignored: ${action}`;
    return true;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? formatTransformActionStatus(action, changedTargets.length),
    patch: patch.patch,
    targetId: selection.activeId ?? changedTargets[0]?.id,
  });
  if (!result.documentChanged) {
    state.status = `Transform action unchanged: ${action}`;
    return true;
  }
  const changedIds = patch.changedIds ?? changedTargets.map(target => target.id);
  syncProjectionForChangedIds(state, options, result.workingDocument, changedIds);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? formatTransformActionStatus(action, changedTargets.length);
  return true;
}

function createTransformActionPivot(targets: EditorTransformTargetSnapshot[]): EditorTransformPivot {
  const center = averageTransformTargetPositions(targets);
  return {
    mode: 'selection-center',
    position: center,
  };
}

function averageTransformTargetPositions(targets: EditorTransformTargetSnapshot[]): EditorTransformVec3 {
  if (targets.length === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: targets.reduce((sum, target) => sum + target.before.position.x, 0) / targets.length,
    y: targets.reduce((sum, target) => sum + target.before.position.y, 0) / targets.length,
    z: targets.reduce((sum, target) => sum + target.before.position.z, 0) / targets.length,
  };
}

function editorTransformSnapshotsEqual(
  left: EditorTransformSnapshot,
  right: EditorTransformSnapshot,
): boolean {
  return editorVec3Equal(left.position, right.position)
    && editorVec3Equal(left.rotation, right.rotation)
    && editorVec3Equal(left.scale, right.scale);
}

function editorVec3Equal(
  left: EditorTransformVec3,
  right: EditorTransformVec3,
): boolean {
  return Math.abs(left.x - right.x) < 0.000000001
    && Math.abs(left.y - right.y) < 0.000000001
    && Math.abs(left.z - right.z) < 0.000000001;
}

function formatTransformActionStatus(action: EditorTransformAction, count: number): string {
  return `${action} ${count} object${count === 1 ? '' : 's'}`;
}

function createAssetFromBrowserIntent<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  assetId: string,
): boolean {
  if (state.transformOperationSettings.placementMode === 'off') {
    return addAssetToDocument(state, options, assetId).ok;
  }
  return armAssetPlacement(state, options, assetId);
}

function selectBrowserAsset<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  assetId: string,
): boolean {
  if (state.selectedAssetId === assetId) return false;
  state.selectedAssetId = assetId;
  state.status = `Selected asset ${assetId}`;
  return true;
}

function handleBrowserAssetAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: LocalEditorBrowserAssetActionInput,
): boolean {
  state.selectedAssetId = input.browserAssetId;
  if (input.actionId === 'asset.add-to-scene') {
    return addAssetToDocument(state, options, input.assetId).ok;
  }
  if (input.actionId === 'asset.place') {
    if (state.transformOperationSettings.placementMode === 'off') {
      state.transformOperationSettings = updateTransformOperationSettings(state.transformOperationSettings, {
        placementMode: 'ground',
      });
      state.gizmo?.setOperationSettings(state.transformOperationSettings);
    }
    return armAssetPlacement(state, options, input.assetId);
  }

  const patched = patchBrowserAssetAction(state, options, input);
  if (patched) return true;
  state.status = `Asset action unavailable: ${input.actionId}`;
  state.statusTone = 'warning';
  state.statusToneStatus = state.status;
  return true;
}

function patchBrowserAssetAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: LocalEditorBrowserAssetActionInput,
): boolean {
  const session = state.session;
  const document = session?.getState().workingDocument ?? null;
  if (!session || !document || !options.documentAdapter.createAssetActionPatch) return false;
  const asset = findAssetByResolvedId(state, options, input.assetId);
  const patch = options.documentAdapter.createAssetActionPatch({
    ...input,
    document,
    asset,
    activeId: session.getState().selection.activeId,
    selectedIds: [...session.getState().selection.selectedIds],
  });
  if (!patch) return false;
  const result = session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Asset action ${input.actionId}`,
    patch: patch.patch,
  });
  state.summary = summarizeDocument(options, result.workingDocument, session.getSource());
  state.status = patch.label ?? `Asset action ${input.actionId}`;
  state.statusTone = 'success';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  if (patch.reprojectIds?.length) reprojectProjectionForChangedIds(state, options, result.workingDocument, patch.reprojectIds);
  else if (patch.changedIds) syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds);
  return true;
}

function armAssetPlacement<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  assetId: string,
): boolean {
  if (state.mode !== 'editor') return false;
  cancelActiveOperation(state);
  const asset = findAssetByResolvedId(state, options, assetId);
  if (!asset) return false;
  state.armedPlacement = { assetId, asset };
  state.gizmo?.setPlacementMarker(null);
  state.status = `Placement armed: ${formatAssetLabel(asset, assetId)} (${state.transformOperationSettings.placementMode})`;
  return true;
}

function isPlacementArmed<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): boolean {
  return state.mode === 'editor'
    && !!state.armedPlacement
    && state.transformOperationSettings.placementMode !== 'off';
}

function previewArmedPlacement<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  event: PointerEvent,
): boolean {
  if (!isPlacementArmed(state)) return false;
  const hit = pickArmedPlacementHit(state, event);
  state.gizmo?.setPlacementMarker(hit);
  const mode = state.transformOperationSettings.placementMode;
  state.status = hit
    ? `Placement ${mode}: ${formatVec3(hit.position)}`
    : `Placement ${mode}: no hit`;
  return true;
}

function commitArmedPlacement<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  event: PointerEvent,
): boolean {
  if (!isPlacementArmed(state) || !state.session) return false;
  const armed = state.armedPlacement;
  const session = state.session;
  const beforeDocument = session.getState().workingDocument;
  const hit = pickArmedPlacementHit(state, event);
  if (!armed || !hit) {
    state.gizmo?.setPlacementMarker(null);
    state.status = 'Placement rejected: no hit';
    return true;
  }
  const patch = options.documentAdapter.createPlacedAssetPatch?.({
    document: beforeDocument,
    asset: armed.asset,
    hit,
  });
  if (!patch) {
    state.status = 'Placement rejected: document adapter does not support placed assets';
    return true;
  }
  const result = session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Place ${armed.assetId}`,
    patch: patch.patch,
    targetId: patch.createdId ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Placement unchanged';
    return true;
  }
  const createdId = patch.createdId
    ?? options.documentAdapter.findCreatedId?.(beforeDocument, result.workingDocument)
    ?? null;
  let selection = result.selection;
  if (createdId && isNodeSelectableInDocument(options, result.workingDocument, createdId)) {
    selection = session.dispatch({
      type: 'selection.replace',
      selectedIds: [createdId],
      activeId: createdId,
      label: 'Select Placed Item',
    }).selection;
  } else {
    selection = sanitizeSelection(state, options, result.workingDocument, selection) ?? selection;
  }
  clearArmedPlacement(state);
  rebuildProjectionFromDocument(state, options, result.workingDocument, selection);
  state.summary = summarizeDocument(options, result.workingDocument, session.getSource());
  state.status = patch.label ?? `Placed ${formatAssetLabel(armed.asset, armed.assetId)} at ${formatVec3(hit.position)}`;
  return true;
}

function pickArmedPlacementHit<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  event: PointerEvent,
): EditorPlacementHit | null {
  const mode = state.transformOperationSettings.placementMode;
  return mode === 'off'
    ? null
    : state.gizmo?.pickPlacementHit(event.clientX, event.clientY, mode) ?? null;
}

function clearArmedPlacement<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  state.armedPlacement = null;
  state.gizmo?.setPlacementMarker(null);
}

function addAssetToDocument<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  assetId: string,
  createOptions: LocalEditorHarnessAssetCreationOptions = {},
): LocalEditorHarnessAssetCreationResult {
  if (state.mode !== 'editor') {
    state.status = 'Asset creation rejected: editor is not active';
    return { ok: false, assetId, changed: false, status: state.status, error: 'editor_not_active' };
  }
  cancelActiveOperation(state);
  const session = state.session;
  const beforeDocument = session?.getState().workingDocument;
  if (!session || !beforeDocument) {
    state.status = 'Asset creation rejected: document is not loaded';
    return { ok: false, assetId, changed: false, status: state.status, error: 'document_not_loaded' };
  }
  const asset = findAssetByResolvedId(state, options, assetId);
  if (!asset) {
    state.status = `Asset creation rejected: ${assetId} not found`;
    return { ok: false, assetId, changed: false, status: state.status, error: 'asset_not_found' };
  }
  const patch = options.documentAdapter.createPatchFromAsset(asset, {
    document: beforeDocument,
    asset,
    assetId,
    placement: createOptions.placement,
  });
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
  state.statusTone = 'success';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  if (createdId) {
    const projectedNode = options.documentAdapter.getProjectionNode(result.workingDocument, createdId);
    if (projectedNode) {
      state.projection?.projectNode(projectedNode);
      if (selectionResult) syncSelectionToProjection(state, selectionResult.selection);
      invalidateEditorScene(state, 'projection-project-node');
    }
  }
  return {
    ok: true,
    assetId,
    changed: result.documentChanged,
    status: state.status,
    createdId: createdId ?? null,
  };
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
  const transaction = createInspectorEditTransaction(state, options, document, input, targetIds);
  if (!transaction.ok) {
    state.status = transaction.message;
    return false;
  }
  const payload = transaction.payload;
  if (targetIds.length > 1) {
    const patch = options.documentAdapter.createSerializedMultiPropertyPatch?.({
      document,
      targetIds,
      activeId: state.session.getState().selection.activeId,
      path: payload.path,
      value: payload.value,
      control: payload.control,
      valueType: payload.valueType,
      commitMode: payload.commitMode,
      persistence: payload.persistence,
      source: payload.source,
    });
    if (!patch) return false;
    const result = state.session.dispatch({
      type: 'document.patch',
      label: patch.label ?? `Patch ${payload.path} on ${targetIds.length} objects`,
      patch: patch.patch,
      targetId: state.session.getState().selection.activeId ?? undefined,
    });
    if (!result.documentChanged) return false;
    const changedIds = patch.changedIds ?? targetIds;
    const workingDocument = result.workingDocument;
    if (patch.reprojectIds?.length) reprojectProjectionForChangedIds(state, options, workingDocument, patch.reprojectIds);
    else syncProjectionForChangedIds(state, options, workingDocument, changedIds);
    state.summary = summarizeDocument(options, workingDocument, state.session.getSource());
    state.status = patch.label ?? `Patch ${payload.path} on ${targetIds.length} objects`;
    return true;
  }
  const patch = options.documentAdapter.createSerializedPropertyPatch({
    document,
    targetId: payload.targetId,
    targetIds: payload.targetIds,
    path: payload.path,
    value: payload.value,
    control: payload.control,
    valueType: payload.valueType,
    commitMode: payload.commitMode,
    persistence: payload.persistence,
    source: payload.source,
  });
  if (!patch) return false;
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Patch ${payload.path}`,
    patch: patch.patch,
  });
  if (patch.reprojectIds?.length) reprojectProjectionForChangedIds(state, options, result.workingDocument, patch.reprojectIds);
  else if (patch.changedIds) syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds);
  else syncProjectionForDispatchResult(state, options, result, patch.changedId ?? payload.targetId);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Patched ${payload.path}`;
  return true;
}

async function applyRenderingPropertyChange<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: LocalEditorBrowserRenderingPropertyChangeInput,
): Promise<boolean> {
  if (state.mode !== 'editor') return false;
  if (!state.session || !options.documentAdapter.onRenderingPropertyChange) return false;
  const document = state.session.getState().workingDocument;
  try {
    const result = await options.documentAdapter.onRenderingPropertyChange({
      document,
      sectionId: input.sectionId,
      systemId: input.systemId,
      path: input.path,
      value: input.value,
      control: input.control,
      valueType: input.valueType,
      commitMode: input.commitMode,
      source: input.source,
    });
    const resultObject = typeof result === 'object' && result != null ? result : null;
    const changed = result === true || resultObject?.changed === true || resultObject?.refreshWorldRendering === true;
    if (resultObject?.status) {
      state.status = resultObject.status;
      state.statusTone = resultObject.statusTone ?? 'default';
      state.statusToneStatus = state.status;
      state.statusDetails = resultObject.statusDetails ?? '';
    } else if (changed) {
      state.status = `Updated rendering: ${input.path}`;
      state.statusTone = 'success';
      state.statusToneStatus = state.status;
      state.statusDetails = '';
    }
    if (changed) {
      syncEditorWorldRenderingFromDocument(state, options, document, 'rendering-panel-change', true);
      requestEditorSceneFrame(state, 'rendering-panel-change');
    }
    return changed || !!resultObject?.status;
  } catch (error) {
    state.status = error instanceof Error ? error.message : String(error);
    state.statusTone = 'error';
    state.statusToneStatus = state.status;
    state.statusDetails = state.status;
    console.error('[LocalEditorHarness] rendering property change failed', error);
    return true;
  }
}

async function applyRenderingAction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: LocalEditorBrowserRenderingActionInput,
): Promise<boolean> {
  if (state.mode !== 'editor') return false;
  if (!state.session || !options.documentAdapter.onRenderingAction) return false;
  const document = state.session.getState().workingDocument;
  try {
    const result = await options.documentAdapter.onRenderingAction({
      document,
      actionId: input.actionId,
    });
    const resultObject = typeof result === 'object' && result != null ? result : null;
    const changed = result === true || resultObject?.changed === true || resultObject?.refreshWorldRendering === true;
    if (resultObject?.status) {
      state.status = resultObject.status;
      state.statusTone = resultObject.statusTone ?? 'default';
      state.statusToneStatus = state.status;
      state.statusDetails = resultObject.statusDetails ?? '';
    } else if (changed) {
      state.status = `Rendering action: ${input.actionId}`;
      state.statusTone = 'success';
      state.statusToneStatus = state.status;
      state.statusDetails = '';
    }
    if (changed) {
      syncEditorWorldRenderingFromDocument(state, options, document, 'rendering-panel-action', true);
      requestEditorSceneFrame(state, 'rendering-panel-action');
    }
    return changed || !!resultObject?.status;
  } catch (error) {
    state.status = error instanceof Error ? error.message : String(error);
    state.statusTone = 'error';
    state.statusToneStatus = state.status;
    state.statusDetails = state.status;
    console.error('[LocalEditorHarness] rendering action failed', error);
    return true;
  }
}

function createInspectorEditTransaction<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  input: LocalEditorBrowserUiPropertyInput,
  targetIds: string[],
): { ok: true; payload: InspectorEditPayload } | { ok: false; message: string } {
  const property = findInspectorPropertyForEdit(state, options, document, input, targetIds);
  if (!property) {
    return { ok: false, message: `Inspector property not found: ${input.path}.` };
  }
  const result = createInspectorEditPayload(property, {
    targetId: input.targetId,
    targetIds: input.targetIds,
    path: input.path,
    value: input.value,
    control: input.control as InspectorControlKind | undefined,
    valueType: input.valueType as InspectorProperty['valueType'] | undefined,
    commitMode: input.commitMode as InspectorCommitMode | undefined,
    persistence: input.persistence as InspectorPersistenceMode | undefined,
    source: input.source,
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, payload: result.value };
}

function findInspectorPropertyForEdit<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  input: LocalEditorBrowserUiPropertyInput,
  targetIds: string[],
): InspectorProperty<TDocument> | null {
  const inspector = createInspectorObjectForEdit(state, options, document, input, targetIds);
  if (!inspector) return null;
  return findInspectorPropertyByPath(inspector, input.path);
}

function createInspectorObjectForEdit<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  input: LocalEditorBrowserUiPropertyInput,
  targetIds: string[],
): InspectorObject<TDocument> | null {
  if (targetIds.length > 1) {
    const activeId = state.session?.getState().selection.activeId ?? input.targetId ?? null;
    const inspector = options.documentAdapter.getInspectorMultiObject?.(document, targetIds, activeId) ?? null;
    if (inspector) return withInspectorComponentSections(state, options, document, inspector);
    const serializedMultiObject = options.documentAdapter.getSerializedMultiObject?.(document, targetIds, activeId) ?? null;
    return serializedMultiObject
      ? withInspectorComponentSections(state, options, document, serializedMultiObjectToInspectorObject(serializedMultiObject, document))
      : null;
  }
  const inspector = options.documentAdapter.getInspectorObject?.(document, input.targetId) ?? null;
  if (inspector) return withInspectorComponentSections(state, options, document, inspector);
  const serializedObject = options.documentAdapter.getSerializedObject(document, input.targetId);
  return serializedObject
    ? withInspectorComponentSections(state, options, document, serializedObjectToInspectorObject(serializedObject, document))
    : null;
}

function findInspectorPropertyByPath<TDocument>(
  inspector: InspectorObject<TDocument>,
  path: string,
): InspectorProperty<TDocument> | null {
  for (const section of inspector.sections) {
    const property = section.properties.find(candidate => candidate.path === path);
    if (property) return property;
  }
  return null;
}

function beginDuplicateDrag<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  input: BabylonTransformGizmoDuplicateDragInput,
): BabylonTransformGizmoDuplicateDragResult | null {
  if (state.mode !== 'editor' || !state.session) return null;
  if (state.duplicateDrag) return null;
  const document = state.session.getState().workingDocument;
  const patch = options.documentAdapter.createDuplicateSelectionPatch?.({
    document,
    targetIds: input.targetIds,
    activeId: input.activeId,
    transforms: input.beforeTransforms,
  });
  if (!patch || patch.createdIds.length === 0) {
    state.status = 'Duplicate drag rejected';
    return null;
  }
  const originalSelection = state.session.getSelection();
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `Duplicate ${input.targetIds.length} object(s)`,
    patch: patch.patch,
    targetId: patch.activeId ?? patch.createdIds[patch.createdIds.length - 1] ?? undefined,
  });
  if (!result.documentChanged) {
    state.status = 'Duplicate drag unchanged';
    return null;
  }
  const createdIds = patch.createdIds.filter(id => isNodeSelectableInDocument(options, result.workingDocument, id));
  if (createdIds.length === 0) {
    const undone = state.session.undo();
    if (undone) rebuildProjectionFromDocument(state, options, undone.workingDocument, originalSelection);
    state.status = 'Duplicate drag rejected: duplicated selection is not selectable';
    return null;
  }
  const activeId = patch.activeId && createdIds.includes(patch.activeId)
    ? patch.activeId
    : createdIds[createdIds.length - 1] ?? null;
  const selectionResult = state.session.dispatch({
    type: 'selection.replace',
    selectedIds: createdIds,
    activeId,
    label: 'Select Duplicate Drag Targets',
  });
  state.duplicateDrag = {
    originalSelection,
    createdIds,
    activeId,
  };
  rebuildProjectionFromDocument(state, options, result.workingDocument, selectionResult.selection);
  if (patch.reprojectIds?.length) reprojectProjectionForChangedIds(state, options, result.workingDocument, patch.reprojectIds);
  else syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds ?? createdIds);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `Duplicated ${createdIds.length} object(s)`;
  return {
    targetIds: createdIds,
    activeId,
  };
}

function cancelDuplicateDrag<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): boolean {
  const duplicate = state.duplicateDrag;
  if (!duplicate || !state.session) return false;
  state.duplicateDrag = null;
  const undone = state.session.undo();
  if (!undone) return false;
  const selectionResult = state.session.dispatch({
    type: 'selection.replace',
    selectedIds: duplicate.originalSelection.selectedIds,
    activeId: duplicate.originalSelection.activeId,
    label: 'Restore Duplicate Drag Selection',
  });
  rebuildProjectionFromDocument(state, options, undone.workingDocument, selectionResult.selection);
  state.summary = summarizeDocument(options, undone.workingDocument, state.session.getSource());
  state.status = `Canceled duplicate drag ${duplicate.createdIds.length} object(s)`;
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
      if (!cancelDuplicateDrag(state, options)) {
        restoreBatchTransformPreview(state, event.targets);
        state.status = `Ignored ${event.tool} ${event.targetIds.length} objects`;
      }
      return false;
    }
    const result = state.session.dispatch({
      type: 'document.patch',
      label: patch.label ?? `${event.tool} ${event.targetIds.length} objects`,
      patch: patch.patch,
      targetId: event.activeId ?? undefined,
    }, {
      mergeWithPrevious: event.targetIds.some(id => state.duplicateDrag?.createdIds.includes(id)) === true,
    });
    syncProjectionForDispatchResult(state, options, result);
    syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds ?? event.targetIds);
    state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
    state.status = patch.label ?? `${event.tool} ${event.targetIds.length} objects`;
    state.duplicateDrag = null;
    return result.documentChanged;
  }
  const patch = options.documentAdapter.createTransformPatch?.({
    document,
    targetId: event.nodeId,
    tool: event.tool,
    space: event.space,
    constraint: event.constraint,
    before: event.before,
    after: event.after,
  });
  if (!patch) {
    if (!cancelDuplicateDrag(state, options)) {
      state.projection?.setNodeTransformPreview(event.nodeId, event.before);
      state.status = `Ignored ${event.tool} ${event.nodeId}`;
    }
    return false;
  }
  const result = state.session.dispatch({
    type: 'document.patch',
    label: patch.label ?? `${event.tool} ${event.nodeId}`,
    patch: patch.patch,
    targetId: event.nodeId,
  }, {
    mergeWithPrevious: state.duplicateDrag?.createdIds.includes(event.nodeId) === true,
  });
  if (patch.changedIds) syncProjectionForChangedIds(state, options, result.workingDocument, patch.changedIds);
  else syncProjectionForDispatchResult(state, options, result, patch.changedId ?? event.nodeId);
  state.summary = summarizeDocument(options, result.workingDocument, state.session.getSource());
  state.status = patch.label ?? `${event.tool} ${event.nodeId}`;
  state.duplicateDrag = null;
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

function formatBlockedGizmoTransformStatus(event: BabylonTransformGizmoBlockEvent): string {
  const target = event.targetIds.length > 1
    ? `${event.targetIds.length} objects`
    : event.nodeId ?? event.activeId ?? 'selection';
  const failed = event.failedTargetId && event.targetIds.length > 1
    ? ` at ${event.failedTargetId}`
    : '';
  return `Blocked ${event.tool} ${target}${failed}: ${formatTransformOperationBlockReason(event.reason)}`;
}

function formatTransformOperationBlockReason(reason: BabylonTransformGizmoBlockEvent['reason']): string {
  if (reason === 'non-trs-representable') return 'result cannot be represented as position/rotation/scale';
  if (reason === 'non-invertible-parent') return 'parent transform cannot be inverted';
  return 'unsupported transform';
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
  clearArmedPlacement(state);
}

function cancelEditorIntent<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): boolean {
  if (state.mode !== 'editor') return false;
  if (
    state.viewportTools.activeUtilityTool === 'measure-distance'
    || state.viewportMeasurement.start
    || state.viewportMeasurement.end
  ) {
    return clearViewportMeasurement(state);
  }
  const selection = state.session?.getSelection();
  if (selection && selection.selectedIds.length > 0) {
    return dispatchSelectionCommand(state, options, { type: 'selection.clear', label: 'Clear Selection' });
  }
  cancelActiveOperation(state);
  return true;
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
  if (focused) requestEditorSceneFrame(state, 'viewport-focus-selection');
  return true;
}

function formatEditorStatusTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatVec3(value: { x: number; y: number; z: number }): string {
  return `${formatPlacementNumber(value.x)}, ${formatPlacementNumber(value.y)}, ${formatPlacementNumber(value.z)}`;
}

function formatPlacementNumber(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : String(value);
}

function formatAssetLabel<TAsset>(asset: TAsset, fallback: string): string {
  const record = isObjectRecord(asset) ? asset : null;
  const label = record?.label ?? record?.displayName ?? record?.name;
  return typeof label === 'string' && label.trim() ? label : fallback;
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
  cancelActiveOperation(state);
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
  syncEditorWorldAppearanceFromDocument(state, options, document, 'world-appearance-rebuild');
  syncEditorWorldRenderingFromDocument(state, options, document, 'world-rendering-rebuild', true);
  invalidateEditorScene(state, 'projection-rebuild');
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
  if (result.documentChanged && result.workingDocument) {
    syncEditorWorldAppearanceFromDocument(state, options, result.workingDocument, 'world-appearance-dispatch-result');
    syncEditorWorldRenderingFromDocument(state, options, result.workingDocument, 'world-rendering-dispatch-result', true);
  }
  if (result.documentChanged || result.selectionChanged) {
    invalidateEditorScene(state, 'projection-dispatch-result');
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
  syncEditorWorldAppearanceFromDocument(state, options, document, 'world-appearance-sync-changed-ids');
  syncEditorWorldRenderingFromDocument(state, options, document, 'world-rendering-sync-changed-ids', true);
  invalidateEditorScene(state, 'projection-sync-changed-ids');
}

function reprojectProjectionForChangedIds<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  changedIds: string[],
): void {
  for (const changedId of changedIds) {
    const projectedNode = options.documentAdapter.getProjectionNode(document, changedId);
    if (projectedNode) state.projection?.projectNode(projectedNode);
  }
  syncCurrentSelectionToSceneArtifacts(state);
  syncEditorWorldAppearanceFromDocument(state, options, document, 'world-appearance-reproject-changed-ids');
  syncEditorWorldRenderingFromDocument(state, options, document, 'world-rendering-reproject-changed-ids', true);
  invalidateEditorScene(state, 'projection-reproject-changed-ids', options);
}

function setSceneCameraPreviewEnabled<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  enabled: boolean,
): boolean {
  if (!enabled) {
    state.sceneCameraPreviewEnabled = false;
    state.sceneCameraPreview?.setActive(false);
    state.status = 'Scene Camera preview disabled';
    requestEditorSceneFrame(state, 'scene-camera-preview-toggle');
    return true;
  }
  state.sceneCameraPreviewEnabled = true;
  if (!syncSceneCameraPreview(state, options)) {
    state.sceneCameraPreviewEnabled = false;
    state.status = 'Scene Camera preview unavailable';
    state.statusTone = 'warning';
    state.statusToneStatus = state.status;
    state.statusDetails = 'The current document did not provide a Main Camera preview rig.';
    return true;
  }
  state.status = 'Scene Camera preview enabled';
  requestEditorSceneFrame(state, 'scene-camera-preview-toggle');
  return true;
}

function setGridVisible<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  visible: boolean,
): boolean {
  const nextVisible = visible === true;
  if (state.gridVisible === nextVisible) return false;
  state.gridVisible = nextVisible;
  state.grid?.setVisible(nextVisible);
  state.status = nextVisible ? 'Grid visible' : 'Grid hidden';
  state.statusTone = 'default';
  state.statusToneStatus = state.status;
  state.statusDetails = '';
  requestEditorSceneFrame(state, 'grid-visible-change');
  return true;
}

function syncSceneCameraPreview<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): boolean {
  const controller = state.sceneCameraPreview;
  if (!controller) return false;
  if (!state.sceneCameraPreviewEnabled) {
    controller.setActive(false);
    return false;
  }
  const document = state.session?.getState().workingDocument ?? null;
  const rig = document ? options.documentAdapter.getSceneCameraPreviewRig?.(document) ?? null : null;
  if (!rig) {
    controller.setActive(false);
    return false;
  }
  controller.setActive(true, rig);
  return controller.isActive();
}

function syncViewportCameraState<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  const cameraState = state.sceneViewCamera?.getState();
  if (!cameraState) return;
  state.viewportTools = {
    ...state.viewportTools,
    viewPreset: cameraState.viewPreset,
    projectionMode: cameraState.projectionMode,
  };
}

function syncViewportSpatialOverlay<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  const settings = state.viewportTools.overlay;
  if (!settings.bounds && !settings.dimensions && !settings.edgeLengths && !settings.anchor) {
    state.viewportSpatialOverlay = createEmptyEditorViewportSpatialOverlayState();
    return;
  }
  const overlay = state.sceneViewSpatialOverlay;
  const selection = state.session?.getState().selection;
  const activeId = selection?.activeId ?? null;
  if (state.mode !== 'editor' || !overlay || !activeId || selection?.selectedIds.length !== 1) {
    state.viewportSpatialOverlay = createEmptyEditorViewportSpatialOverlayState();
    return;
  }
  const bounds = state.projection?.getSelectionBounds([activeId]) ?? null;
  const anchor = state.projection?.readNodeTransform(activeId)?.position ?? bounds?.center ?? null;
  state.viewportSpatialOverlay = overlay.compute({
    nodeId: activeId,
    bounds,
    anchor,
    settings,
  });
}

function syncViewportMeasurementState<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): void {
  if (state.mode !== 'editor') return;
  const measurement = state.sceneViewMeasurement?.getState();
  if (measurement) state.viewportMeasurement = measurement;
}

function hasSceneCameraPreviewRig<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): boolean {
  const document = state.session?.getState().workingDocument ?? null;
  return !!document && !!options.documentAdapter.getSceneCameraPreviewRig?.(document);
}

function createUiState<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
): LocalEditorBrowserUiState<TDocument> {
  const sessionState = state.session?.getState();
  const document = sessionState?.workingDocument ?? null;
  const selectedIds = sessionState?.selection.selectedIds ?? [];
  const activeId = sessionState?.selection.activeId ?? null;
  const serializedObject = document && activeId && selectedIds.length === 1
    ? options.documentAdapter.getSerializedObject(document, activeId)
    : null;
  const serializedMultiObject = document && selectedIds.length > 1
    ? options.documentAdapter.getSerializedMultiObject?.(document, selectedIds, activeId) ?? null
    : null;
  const inspectorObjectBase = document && activeId && selectedIds.length === 1
    ? options.documentAdapter.getInspectorObject?.(document, activeId) ?? (serializedObject ? serializedObjectToInspectorObject(serializedObject, document) : null)
    : null;
  const inspectorMultiObjectBase = document && selectedIds.length > 1
    ? options.documentAdapter.getInspectorMultiObject?.(document, selectedIds, activeId) ?? (serializedMultiObject ? serializedMultiObjectToInspectorObject(serializedMultiObject, document) : null)
    : null;
  const inspectorObject = document && inspectorObjectBase
    ? withRuntimeInspectorSections(state, options, document, inspectorObjectBase)
    : inspectorObjectBase;
  const inspectorMultiObject = document && inspectorMultiObjectBase
    ? withRuntimeInspectorSections(state, options, document, inspectorMultiObjectBase)
    : inspectorMultiObjectBase;
  const documentAssetItems = document
    ? options.documentAdapter.getBrowserAssetItems?.(document) ?? []
    : [];
  const assets = dedupeLocalEditorBrowserAssetItems([
    ...state.assets.map(asset => toBrowserAssetItem(options, asset)),
    ...documentAssetItems,
  ]);
  return {
    mode: state.mode,
    busy: state.busy,
    status: state.status,
    statusTone: state.statusToneStatus === state.status ? state.statusTone : 'default',
    statusDetails: state.statusToneStatus === state.status ? state.statusDetails : '',
    summary: state.summary,
    assetFilter: state.assetFilter,
    assets,
    selectedAssetId: state.selectedAssetId,
    assetCountLabel: `${assets.length} assets`,
    hierarchy: document ? options.documentAdapter.getHierarchyItems(document) : [],
    selectedIds,
    activeId,
    selectionSummary: {
      count: selectedIds.length,
      activeId,
    },
    serializedObject,
    serializedMultiObject,
    inspectorObject,
    inspectorMultiObject,
    renderingPanel: document ? options.documentAdapter.getRenderingPanelState?.(document) ?? null : null,
    boxSelection: state.boxSelection,
    coordinateAxes: options.world?.coordinateAxes === false
      ? null
      : createSceneViewCoordinateAxesState(state),
    transformTool: {
      activeTool: state.gizmo?.getState().tool ?? state.transformTool,
      activeSpace: state.gizmo?.getState().space ?? state.transformSpace,
      activeConstraint: state.gizmo?.getState().constraint ?? state.transformConstraint,
      dragPhase: state.gizmo?.getState().dragPhase ?? 'idle',
      draggingNodeId: state.gizmo?.getState().draggingNodeId ?? null,
    },
    transformOperations: {
      settings: cloneTransformOperationSettings(state.transformOperationSettings),
      selectedCount: selectedIds.length,
      activeId,
      canAlign: selectedIds.length >= 2 && activeId != null,
      canDistribute: selectedIds.length >= 3,
    },
    viewportTools: cloneEditorViewportToolState(state.viewportTools),
    viewportMeasurement: cloneViewportMeasurement(state.viewportMeasurement),
    viewportSpatialOverlay: cloneEditorViewportSpatialOverlayState(state.viewportSpatialOverlay),
    sceneFrameStats: state.sceneFrameStats
      ? { ...state.sceneFrameStats, activeReasons: [...state.sceneFrameStats.activeReasons] }
      : null,
    sceneCameraPreview: {
      enabled: state.sceneCameraPreviewEnabled,
      available: hasSceneCameraPreviewRig(state, options),
    },
    grid: {
      visible: state.gridVisible,
      available: !!state.grid,
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

interface SceneViewAxisVec3 {
  x: number;
  y: number;
  z: number;
}

function createSceneViewCoordinateAxesState<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
): LocalEditorBrowserUiState['coordinateAxes'] | null {
  if (state.mode !== 'editor') return null;
  const scene = state.world?.scene ?? null;
  const camera = scene?.activeCamera ?? state.world?.camera ?? null;
  const Vector3 = state.babylon?.Vector3;
  if (!scene || !camera || !Vector3) return null;

  const right = readSceneViewCameraDirection(camera, Vector3, { x: 1, y: 0, z: 0 });
  const up = readSceneViewCameraDirection(camera, Vector3, { x: 0, y: 1, z: 0 });
  const forward = readSceneViewCameraForward(scene, camera, Vector3);
  if (!right || !up || !forward) return null;

  return {
    projectionMode: readSceneViewFreeCameraProjectionMode(state, camera),
    projectionToggleDisabled: state.sceneCameraPreviewEnabled,
    axes: [
      createSceneViewCoordinateAxis('x', 'X', '#ff4b70', { x: 1, y: 0, z: 0 }, right, up, forward),
      createSceneViewCoordinateAxis('y', 'Y', '#75ff42', { x: 0, y: 1, z: 0 }, right, up, forward),
      createSceneViewCoordinateAxis('z', 'Z', '#4f86ff', { x: 0, y: 0, z: 1 }, right, up, forward),
    ],
  };
}

function readSceneViewFreeCameraProjectionMode<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  camera: any,
): EditorViewportProjectionMode {
  return state.sceneViewCamera?.getState().projectionMode
    ?? readSceneViewCameraProjectionMode(state, state.world?.camera ?? camera);
}

function readSceneViewCameraProjectionMode<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  camera: any,
): EditorViewportProjectionMode {
  const orthoMode = state.babylon?.Camera?.ORTHOGRAPHIC_CAMERA ?? 1;
  return camera?.mode === orthoMode ? 'orthographic' : 'perspective';
}

function createSceneViewCoordinateAxis(
  id: 'x' | 'y' | 'z',
  label: string,
  color: string,
  worldAxis: SceneViewAxisVec3,
  cameraRight: SceneViewAxisVec3,
  cameraUp: SceneViewAxisVec3,
  cameraForward: SceneViewAxisVec3,
): NonNullable<LocalEditorBrowserUiState['coordinateAxes']>['axes'][number] {
  const screenX = dotSceneViewAxisVec3(worldAxis, cameraRight);
  const screenY = -dotSceneViewAxisVec3(worldAxis, cameraUp);
  const projectedLength = Math.hypot(screenX, screenY);
  const fallback = getSceneViewAxisFallbackDirection(id);
  const direction = projectedLength > 0.0001
    ? { x: screenX / projectedLength, y: screenY / projectedLength }
    : fallback;
  return {
    id,
    label,
    color,
    x: direction.x,
    y: direction.y,
    depth: dotSceneViewAxisVec3(worldAxis, cameraForward),
    scale: clampNumber(projectedLength, 0.36, 1),
  };
}

function readSceneViewCameraDirection(camera: any, Vector3: any, local: SceneViewAxisVec3): SceneViewAxisVec3 | null {
  if (!camera?.getDirection) return null;
  try {
    return normalizeSceneViewAxisVec3(camera.getDirection(new Vector3(local.x, local.y, local.z)));
  } catch {
    return null;
  }
}

function readSceneViewCameraForward(scene: any, camera: any, Vector3: any): SceneViewAxisVec3 | null {
  const rayDirection = normalizeSceneViewAxisVec3(camera?.getForwardRay?.()?.direction);
  if (rayDirection) return rayDirection;
  return readSceneViewCameraDirection(camera, Vector3, {
    x: 0,
    y: 0,
    z: scene?.useRightHandedSystem ? -1 : 1,
  });
}

function normalizeSceneViewAxisVec3(value: any): SceneViewAxisVec3 | null {
  const x = Number(value?.x) || 0;
  const y = Number(value?.y) || 0;
  const z = Number(value?.z) || 0;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 0.000001) return null;
  return { x: x / length, y: y / length, z: z / length };
}

function dotSceneViewAxisVec3(left: SceneViewAxisVec3, right: SceneViewAxisVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function getSceneViewAxisFallbackDirection(id: 'x' | 'y' | 'z'): { x: number; y: number } {
  if (id === 'x') return { x: 1, y: 0 };
  if (id === 'y') return { x: 0, y: -1 };
  return { x: -1, y: 0 };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function withRuntimeInspectorSections<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  inspectorObject: InspectorObject<TDocument>,
): InspectorObject<TDocument> {
  const baseInspectorObject = withInspectorComponentSections(state, options, document, inspectorObject);
  const activeId = inspectorObject.activeId;
  const projectionNode = activeId ? options.documentAdapter.getProjectionNode(document, activeId) : null;
  const projectedRoot = activeId ? state.projection?.getProjectedNode(activeId)?.root ?? null : null;
  const context: LocalEditorHarnessRuntimeInspectorContext<TDocument> = {
    document,
    targetIds: baseInspectorObject.targetIds,
    activeId,
    inspectorObject: baseInspectorObject,
    projectionNode,
    projectedRoot,
  };
  const runtimeSections = [
    ...createDefaultRuntimeInspectorSections(context),
    ...(options.documentAdapter.getRuntimeInspectorSections?.(context) ?? []),
  ];
  const sections = mergeInspectorSections(baseInspectorObject.sections, runtimeSections, {
    propertyConflict: options.inspector?.propertyConflict,
  });
  return {
    ...baseInspectorObject,
    sections,
  };
}

function withInspectorComponentSections<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  inspectorObject: InspectorObject<TDocument>,
): InspectorObject<TDocument> {
  const context = createHarnessInspectorSelectionContext(state, document, inspectorObject);
  return mergeLocalEditorHarnessInspectorComponentSections({
    inspectorObject,
    components: options.inspector?.components,
    context,
    componentConflict: options.inspector?.componentConflict,
    propertyConflict: options.inspector?.propertyConflict,
  });
}

function getInspectorComponentSections<TDocument>(input: {
  components: InspectorRegistry<TDocument> | readonly InspectorComponentRegistration<TDocument>[];
  context: InspectorSelectionContext<TDocument>;
  componentConflict?: InspectorRegistryConflictStrategy;
  propertyConflict?: InspectorRegistryConflictStrategy;
}): InspectorSection<TDocument>[] {
  if (isInspectorRegistry(input.components)) return input.components.getSections(input.context);
  const registry = createInspectorRegistry<TDocument>({
    onConflict: input.componentConflict,
    propertyConflict: input.propertyConflict,
  });
  for (const component of input.components) registry.register(component);
  return registry.getSections(input.context);
}

function createHarnessInspectorSelectionContext<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  document: TDocument,
  inspectorObject: InspectorObject<TDocument>,
): InspectorSelectionContext<TDocument> {
  const activeId = inspectorObject.activeId;
  const projectedRoot = activeId ? state.projection?.getProjectedNode(activeId)?.root ?? null : null;
  return {
    ...inspectorObject.selection,
    targetIds: inspectorObject.targetIds,
    activeId,
    document,
    runtimeTarget: inspectorObject.selection.runtimeTarget ?? projectedRoot ?? undefined,
  };
}

function isInspectorRegistry<TDocument>(
  components: InspectorRegistry<TDocument> | readonly InspectorComponentRegistration<TDocument>[],
): components is InspectorRegistry<TDocument> {
  return !Array.isArray(components)
    && typeof (components as InspectorRegistry<TDocument>).getSections === 'function';
}

function createDefaultRuntimeInspectorSections<TDocument>(
  context: LocalEditorHarnessRuntimeInspectorContext<TDocument>,
): InspectorSection<TDocument>[] {
  if (context.targetIds.length !== 1) return [];
  const root = context.projectedRoot;
  const projectionNode = context.projectionNode;
  if (!root && !projectionNode) return [];
  const properties: InspectorProperty<TDocument>[] = [];
  if (projectionNode) {
    properties.push(createRuntimeInspectorProperty('runtime.projection.nodeId', 'Projected ID', projectionNode.id, properties.length));
    const projectionAsset = projectionNode.asset as (typeof projectionNode.asset & { assetId?: string }) | undefined;
    const assetId = projectionAsset?.assetId ?? projectionAsset?.id ?? '';
    if (assetId) properties.push(createRuntimeInspectorProperty('runtime.projection.assetId', 'Asset ID', assetId, properties.length));
  }
  const runtimeClass = readRuntimeClassName(root);
  if (runtimeClass) properties.push(createRuntimeInspectorProperty('runtime.root.className', 'Runtime Class', runtimeClass, properties.length));
  const runtimeName = readRuntimeStringProperty(root, 'name');
  if (runtimeName) properties.push(createRuntimeInspectorProperty('runtime.root.name', 'Runtime Name', runtimeName, properties.length));
  const childCount = readRuntimeChildCount(root);
  if (childCount != null) properties.push(createRuntimeInspectorProperty('runtime.root.children', 'Runtime Children', childCount, properties.length));
  if (properties.length === 0) return [];
  return [{
    id: 'runtimeDiagnostics',
    title: 'Runtime Diagnostics',
    order: 900,
    placement: 'body',
    persistence: 'runtime',
    runtimeOnly: true,
    properties,
  }];
}

function createRuntimeInspectorProperty<TDocument>(
  path: string,
  label: string,
  value: unknown,
  order: number,
): InspectorProperty<TDocument> {
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

function readRuntimeClassName(value: unknown): string | null {
  const record = isObjectRecord(value) ? value : null;
  const getter = record?.getClassName;
  if (typeof getter === 'function') {
    const className = getter.call(value);
    if (typeof className === 'string' && className.trim()) return className;
  }
  const constructorName = record?.constructor && typeof record.constructor === 'function'
    ? record.constructor.name
    : '';
  return constructorName && constructorName !== 'Object' ? constructorName : null;
}

function readRuntimeStringProperty(value: unknown, key: string): string | null {
  if (!isObjectRecord(value)) return null;
  const raw = value[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function readRuntimeChildCount(value: unknown): number | null {
  if (!isObjectRecord(value)) return null;
  const children = value.getChildren;
  if (typeof children === 'function') {
    const result = children.call(value);
    return Array.isArray(result) ? result.length : null;
  }
  return null;
}

function isObjectRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object';
}

function summarizeDocument<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  document: TDocument,
  _source?: AuthoringSourceDescriptor | null,
): string {
  return options.documentAdapter.summarize?.(document) ?? '';
}

export function summarizeLocalEditorAuthoringFailure(
  result: AuthoringCommandResult<unknown>,
): LocalEditorAuthoringFailureStatus {
  const diagnostic = result.diagnostics.find(item => item.severity === 'error') ?? result.diagnostics[0];
  const status = diagnostic?.message ?? result.reason ?? 'Authoring source commit failed';
  const diagnostics = summarizeDiagnostics(result.diagnostics);
  const details = [
    result.reason ? `Reason: ${result.reason}` : '',
    diagnostics ? `Diagnostics: ${diagnostics}` : '',
  ].filter(Boolean).join('\n') || status;
  return { status, details };
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
    ?? (asset as LocalEditorHarnessAssetItem).assetId
    ?? (asset as LocalEditorHarnessAssetItem).id;
}

function findAssetByResolvedId<TDocument, TPatch, TAsset>(
  state: LocalEditorHarnessState<TDocument, TPatch, TAsset>,
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  assetId: string,
): TAsset | undefined {
  let selected: { asset: TAsset; item: LocalEditorBrowserUiAssetItem } | null = null;
  for (const asset of state.assets) {
    if (resolveAssetId(options, asset) !== assetId) continue;
    const item = toBrowserAssetItem(options, asset);
    if (!selected || shouldReplaceBrowserAssetItem(selected.item, item)) {
      selected = { asset, item };
    }
  }
  return selected?.asset;
}

function toBrowserAssetItem<TDocument, TPatch, TAsset>(
  options: LocalEditorHarnessOptions<TDocument, TPatch, TAsset>,
  asset: TAsset,
): LocalEditorBrowserUiAssetItem {
  return options.worldAdapter.toBrowserAssetItem?.(asset)
    ?? {
      id: (asset as LocalEditorHarnessAssetItem).assetId ?? (asset as LocalEditorHarnessAssetItem).id,
      label: (asset as LocalEditorHarnessAssetItem).displayName ?? (asset as LocalEditorHarnessAssetItem).label,
      guid: (asset as LocalEditorHarnessAssetItem).guid,
      assetId: (asset as LocalEditorHarnessAssetItem).assetId,
      kind: (asset as LocalEditorHarnessAssetItem).kind,
      external: (asset as LocalEditorHarnessAssetItem).external,
      origin: (asset as LocalEditorHarnessAssetItem).origin,
      dedupeKey: (asset as LocalEditorHarnessAssetItem).dedupeKey,
      placeable: (asset as LocalEditorHarnessAssetItem).placeable,
      preview: (asset as LocalEditorHarnessAssetItem).preview,
      material: (asset as LocalEditorHarnessAssetItem & { material?: LocalEditorBrowserUiAssetItem['material'] }).material,
      meta: (asset as LocalEditorHarnessAssetItem).meta,
      disabled: (asset as LocalEditorHarnessAssetItem).disabled ?? (asset as LocalEditorHarnessAssetItem).placeable === false,
    };
}

export function dedupeLocalEditorBrowserAssetItems(
  items: LocalEditorBrowserUiAssetItem[],
): LocalEditorBrowserUiAssetItem[] {
  const byKey = new Map<string, LocalEditorBrowserUiAssetItem>();
  for (const item of items) {
    const key = getBrowserAssetCanonicalKey(item);
    const existing = byKey.get(key);
    if (!existing || shouldReplaceBrowserAssetItem(existing, item)) {
      byKey.set(key, item);
    }
  }

  const projectDuplicateKeys = new Set<string>();
  for (const item of byKey.values()) {
    if (!item.guid || item.origin !== 'project') continue;
    for (const duplicateKey of getBrowserAssetDuplicateSuppressionKeys(item)) {
      projectDuplicateKeys.add(duplicateKey);
    }
  }

  return [...byKey.values()].filter((item) => {
    if (item.guid) return true;
    return !getBrowserAssetDuplicateSuppressionKeys(item)
      .some(duplicateKey => projectDuplicateKeys.has(duplicateKey));
  });
}

function getBrowserAssetCanonicalKey(item: LocalEditorBrowserUiAssetItem): string {
  const guid = normalizeBrowserAssetString(item.guid);
  if (guid) return `guid:${guid}`;
  const platformAssetId = normalizeBrowserAssetString(item.external?.platformAssetId);
  if (platformAssetId) return `external:${platformAssetId}`;
  const dedupeKey = normalizeBrowserAssetString(item.dedupeKey);
  if (dedupeKey) return `dedupe:${dedupeKey}`;
  const assetId = normalizeBrowserAssetString(item.assetId);
  if (assetId) return `asset:${assetId}`;
  return `id:${normalizeBrowserAssetString(item.id) ?? item.id}`;
}

function getBrowserAssetDuplicateSuppressionKeys(item: LocalEditorBrowserUiAssetItem): string[] {
  const keys: string[] = [];
  pushBrowserAssetDuplicateKey(keys, 'external', item.external?.platformAssetId);
  pushBrowserAssetDuplicateKey(keys, 'dedupe', item.dedupeKey);
  pushBrowserAssetDuplicateKey(keys, 'asset', item.assetId);
  pushBrowserAssetDuplicateKey(keys, 'id', item.id);
  return keys;
}

function pushBrowserAssetDuplicateKey(keys: string[], prefix: string, value: unknown): void {
  const normalized = normalizeBrowserAssetString(value);
  if (normalized) keys.push(`${prefix}:${normalized}`);
}

function shouldReplaceBrowserAssetItem(
  current: LocalEditorBrowserUiAssetItem,
  candidate: LocalEditorBrowserUiAssetItem,
): boolean {
  const currentScore = getBrowserAssetPreferenceScore(current);
  const candidateScore = getBrowserAssetPreferenceScore(candidate);
  if (candidateScore !== currentScore) return candidateScore > currentScore;
  return getBrowserAssetDetailScore(candidate) > getBrowserAssetDetailScore(current);
}

function getBrowserAssetPreferenceScore(item: LocalEditorBrowserUiAssetItem): number {
  return (item.origin === 'project' ? 1000 : 0)
    + (item.guid ? 100 : 0)
    + (item.assetId ? 40 : 0)
    + (item.placeable === false ? 0 : 10)
    + (item.disabled ? 0 : 5);
}

function getBrowserAssetDetailScore(item: LocalEditorBrowserUiAssetItem): number {
  return [
    item.label,
    item.meta,
    item.kind,
    item.external?.platformAssetId,
    item.external?.assetPath,
    item.external?.assetUrl,
  ].filter(value => typeof value === 'string' && value.trim()).length;
}

function normalizeBrowserAssetString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
