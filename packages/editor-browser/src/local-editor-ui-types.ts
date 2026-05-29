import type {
  EditorPlacementMode,
  EditorTransformAction,
  EditorTransformConstraint,
  EditorTransformHandleDescriptor,
  EditorTransformOperationSettings,
  EditorTransformSpace,
  EditorTransformTool,
  EditorTransformToolDescriptor,
  EditorViewportGroundMeasurement,
  EditorViewportOverlaySettings,
  EditorViewportProjectionMode,
  EditorViewportSpatialOverlayState,
  EditorViewportToolState,
  EditorViewportUtilityTool,
  EditorViewportViewPreset,
  SceneGraphPrimitiveShape,
  SelectionCommand,
} from '@fps-games/editor-core';
import type { LocalEditorThemeName } from './local-editor-ui-theme';

export type LocalEditorBrowserSerializedValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'asset'
  | 'object'
  | 'unknown';

export interface LocalEditorBrowserSerializedProperty<TDocument = unknown> {
  path: string;
  label: string;
  valueType: LocalEditorBrowserSerializedValueType;
  value: unknown;
  mixed?: boolean;
  readOnly?: boolean;
  document?: TDocument;
}

export interface LocalEditorBrowserSerializedObject<TDocument = unknown> {
  targetId: string;
  label?: string;
  properties: LocalEditorBrowserSerializedProperty<TDocument>[];
  document?: TDocument;
}

export interface LocalEditorBrowserSerializedMultiObject<TDocument = unknown> {
  targetIds: string[];
  activeId: string | null;
  label?: string;
  properties: LocalEditorBrowserSerializedProperty<TDocument>[];
  document?: TDocument;
}

export type LocalEditorBrowserInspectorPersistenceMode = 'document' | 'runtime' | 'readonly';

export type LocalEditorBrowserInspectorControlKind =
  | 'readonly'
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'vec2'
  | 'vec3'
  | 'color'
  | 'asset'
  | 'object'
  | 'custom';

export type LocalEditorBrowserInspectorCommitMode = 'live' | 'blur' | 'change' | 'immediate';

export type LocalEditorBrowserInspectorEffectMode = 'active' | 'default' | 'derived' | 'runtime' | 'unsupported';

export type LocalEditorBrowserInspectorEditSource =
  | 'input'
  | 'toggle'
  | 'select'
  | 'color'
  | 'asset'
  | 'custom';

export interface LocalEditorBrowserInspectorEnumOption<TValue = string | number | boolean> {
  label: string;
  value: TValue;
  disabled?: boolean;
}

export interface LocalEditorBrowserInspectorSelectionContext<TDocument = unknown> {
  targetIds: string[];
  activeId: string | null;
  targetKind?: string;
  document?: TDocument;
  runtimeTarget?: unknown;
  capabilities?: readonly string[];
}

export interface LocalEditorBrowserInspectorProperty<TDocument = unknown> {
  id?: string;
  path: string;
  label: string;
  valueType: LocalEditorBrowserSerializedValueType | 'color' | 'vec2' | 'vec3';
  control: LocalEditorBrowserInspectorControlKind;
  customControl?: string;
  controlOptions?: Record<string, unknown>;
  value: unknown;
  mixed?: boolean;
  readOnly: boolean;
  persistence: LocalEditorBrowserInspectorPersistenceMode;
  commitMode: LocalEditorBrowserInspectorCommitMode;
  order?: number;
  tags?: readonly string[];
  tooltip?: string;
  effect?: LocalEditorBrowserInspectorEffectMode;
  disabledReason?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly LocalEditorBrowserInspectorEnumOption[];
  document?: TDocument;
}

export interface LocalEditorBrowserInspectorSection<TDocument = unknown> {
  id: string;
  title: string;
  summary?: string;
  order?: number;
  placement?: 'summary' | 'body';
  collapsedByDefault?: boolean;
  persistence?: LocalEditorBrowserInspectorPersistenceMode;
  runtimeOnly?: boolean;
  effect?: LocalEditorBrowserInspectorEffectMode;
  disabledReason?: string;
  tags?: readonly string[];
  properties: LocalEditorBrowserInspectorProperty<TDocument>[];
}

export interface LocalEditorBrowserInspectorObject<TDocument = unknown> {
  targetIds: string[];
  activeId: string | null;
  label?: string;
  selection: LocalEditorBrowserInspectorSelectionContext<TDocument>;
  sections: LocalEditorBrowserInspectorSection<TDocument>[];
  document?: TDocument;
}

export interface LocalEditorBrowserUiHierarchyItem {
  id: string;
  label: string;
  parentId?: string | null;
  depth?: number;
  role?: 'root' | 'group' | 'object';
  selectable?: boolean;
  locked?: boolean;
  protected?: boolean;
  canHaveChildren?: boolean;
  renamable?: boolean;
  deletable?: boolean;
  draggable?: boolean;
}

export interface LocalEditorBrowserAssetPreviewColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export type LocalEditorBrowserAssetPreviewColorValue = string | LocalEditorBrowserAssetPreviewColor;

export type LocalEditorBrowserAssetPreview =
  | {
    kind: 'image';
    url: string;
    alt?: string;
    fit?: 'cover' | 'contain';
  }
  | {
    kind: 'material-sphere';
    baseColor?: LocalEditorBrowserAssetPreviewColorValue;
    metallic?: number;
    roughness?: number;
    emissionColor?: LocalEditorBrowserAssetPreviewColorValue;
    emissionIntensity?: number;
    textureUrl?: string;
  };

export interface LocalEditorBrowserMaterialTextureRef {
  url?: string;
  textureAssetId?: string;
}

export interface LocalEditorBrowserMaterialBaseColorProfile {
  color?: LocalEditorBrowserAssetPreviewColor;
  texture?: LocalEditorBrowserMaterialTextureRef;
  brightness?: number;
  saturation?: number;
  contrast?: number;
  hue?: number;
}

export interface LocalEditorBrowserMaterialEmissionProfile {
  color?: LocalEditorBrowserAssetPreviewColor;
  intensity?: number;
  maskTexture?: LocalEditorBrowserMaterialTextureRef;
}

export interface LocalEditorBrowserMaterialProfile {
  baseColor?: LocalEditorBrowserMaterialBaseColorProfile;
  metallic?: number;
  roughness?: number;
  emission?: LocalEditorBrowserMaterialEmissionProfile;
}

export interface LocalEditorBrowserMaterialAssetEditorData {
  id: string;
  name: string;
  materialKind?: 'pbr' | 'standard' | string;
  readonly?: boolean;
  profile?: LocalEditorBrowserMaterialProfile;
}

export interface LocalEditorBrowserInspectorAssetPickerOption {
  label: string;
  value: string;
  meta?: string;
  kind?: string;
  preview?: LocalEditorBrowserAssetPreview;
}

export interface LocalEditorBrowserUiAssetItem {
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
  placeable?: boolean;
  preview?: LocalEditorBrowserAssetPreview;
  material?: LocalEditorBrowserMaterialAssetEditorData;
  meta?: string;
  disabled?: boolean;
}

export type LocalEditorBrowserTransformTool = EditorTransformTool;

export type LocalEditorBrowserTransformSpace = EditorTransformSpace;

export type LocalEditorBrowserTransformConstraint = EditorTransformConstraint;

export type LocalEditorBrowserTransformHandleDescriptor = EditorTransformHandleDescriptor;

export type LocalEditorBrowserTransformToolDescriptor = EditorTransformToolDescriptor;

export type LocalEditorBrowserPlacementMode = EditorPlacementMode;

export type LocalEditorBrowserTransformAction = EditorTransformAction;

export type LocalEditorBrowserTransformOperationSettings = EditorTransformOperationSettings;

export type LocalEditorBrowserTransformSnapStepKind = 'move' | 'rotate' | 'scale';

export interface LocalEditorBrowserTransformToolState {
  activeTool: LocalEditorBrowserTransformTool;
  activeSpace: LocalEditorBrowserTransformSpace;
  activeConstraint?: LocalEditorBrowserTransformConstraint;
  dragPhase: 'idle' | 'dragging';
  draggingNodeId?: string | null;
}

export interface LocalEditorBrowserTransformOperationState {
  settings: LocalEditorBrowserTransformOperationSettings;
  selectedCount: number;
  activeId: string | null;
  canAlign: boolean;
  canDistribute: boolean;
}

export type LocalEditorBrowserViewportViewPreset = EditorViewportViewPreset;

export type LocalEditorBrowserViewportProjectionMode = EditorViewportProjectionMode;

export type LocalEditorBrowserViewportUtilityTool = EditorViewportUtilityTool;

export type LocalEditorBrowserViewportOverlaySettings = EditorViewportOverlaySettings;

export type LocalEditorBrowserViewportToolState = EditorViewportToolState;

export type LocalEditorBrowserViewportMeasurementState = EditorViewportGroundMeasurement;

export type LocalEditorBrowserViewportSpatialOverlayState = EditorViewportSpatialOverlayState;

export interface LocalEditorBrowserHistoryEntry {
  id: string;
  label: string;
  commandType: string;
  createdAt: number;
}

export interface LocalEditorBrowserHistoryView {
  entries: LocalEditorBrowserHistoryEntry[];
}

export interface LocalEditorBrowserAuthoringSource {
  ref: {
    sourceId: string;
    sourceType: string;
    revision?: number;
  };
}

export type LocalEditorBrowserRenderingPropertyValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'string-list'
  | 'unknown';

export type LocalEditorBrowserRenderingPropertyControlKind =
  | 'readonly'
  | 'string'
  | 'number'
  | 'boolean'
  | 'color'
  | 'string-list';

export type LocalEditorBrowserRenderingPropertyCommitMode = 'live' | 'blur' | 'change' | 'immediate';

export type LocalEditorBrowserRenderingPropertyEditSource =
  | 'input'
  | 'toggle'
  | 'color'
  | 'list';

export type LocalEditorBrowserRenderingSystemKind =
  | 'planar-shadow'
  | 'csm-shadow'
  | 'legacy-shadow'
  | 'custom';

export interface LocalEditorBrowserRenderingProperty {
  path: string;
  label: string;
  valueType: LocalEditorBrowserRenderingPropertyValueType;
  control: LocalEditorBrowserRenderingPropertyControlKind;
  value: unknown;
  readOnly?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  tooltip?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  commitMode?: LocalEditorBrowserRenderingPropertyCommitMode;
  tags?: readonly string[];
}

export interface LocalEditorBrowserRenderingSystem {
  id: string;
  label: string;
  kind: LocalEditorBrowserRenderingSystemKind;
  active?: boolean;
  readOnly?: boolean;
  summary?: string;
  status?: string;
  properties: LocalEditorBrowserRenderingProperty[];
}

export interface LocalEditorBrowserRenderingSection {
  id: string;
  title: string;
  summary?: string;
  systems: LocalEditorBrowserRenderingSystem[];
}

export interface LocalEditorBrowserRenderingPanelState {
  title?: string;
  summary?: string;
  dirty?: boolean;
  status?: string;
  statusTone?: 'default' | 'success' | 'warning' | 'error';
  actions?: LocalEditorBrowserRenderingPanelAction[];
  sections: LocalEditorBrowserRenderingSection[];
}

export interface LocalEditorBrowserRenderingPanelAction {
  id: string;
  label: string;
  icon?: 'undo' | 'save' | 'world' | 'status';
  disabled?: boolean;
  tooltip?: string;
}

export interface LocalEditorBrowserUiState<TDocument = unknown> {
  mode: 'game' | 'editor';
  busy: boolean;
  label?: string;
  status: string;
  statusTone?: 'default' | 'success' | 'warning' | 'error';
  statusDetails?: string;
  summary?: string;
  assetFilter: string;
  assets: LocalEditorBrowserUiAssetItem[];
  selectedAssetId?: string | null;
  assetCountLabel?: string;
  hierarchy: LocalEditorBrowserUiHierarchyItem[];
  selectedIds: string[];
  activeId: string | null;
  selectionSummary?: {
    count: number;
    activeId: string | null;
  } | null;
  serializedObject: LocalEditorBrowserSerializedObject<TDocument> | null;
  serializedMultiObject?: LocalEditorBrowserSerializedMultiObject<TDocument> | null;
  inspectorObject?: LocalEditorBrowserInspectorObject<TDocument> | null;
  inspectorMultiObject?: LocalEditorBrowserInspectorObject<TDocument> | null;
  renderingPanel?: LocalEditorBrowserRenderingPanelState | null;
  boxSelection?: {
    active: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
  coordinateAxes?: LocalEditorBrowserCoordinateAxesState | null;
  transformTool?: LocalEditorBrowserTransformToolState | null;
  transformOperations?: LocalEditorBrowserTransformOperationState | null;
  viewportTools?: LocalEditorBrowserViewportToolState | null;
  viewportMeasurement?: LocalEditorBrowserViewportMeasurementState | null;
  viewportSpatialOverlay?: LocalEditorBrowserViewportSpatialOverlayState | null;
  sceneFrameStats?: LocalEditorBrowserSceneFrameStats | null;
  sceneCameraPreview?: {
    enabled: boolean;
    available: boolean;
  } | null;
  grid?: {
    visible: boolean;
    available: boolean;
  } | null;
  session?: {
    source?: LocalEditorBrowserAuthoringSource | null;
    dirty: boolean;
    canUndo: boolean;
    canRedo: boolean;
    history?: LocalEditorBrowserHistoryView;
  } | null;
}

export type LocalEditorBrowserCoordinateAxisId = 'x' | 'y' | 'z';

export interface LocalEditorBrowserCoordinateAxis {
  id: LocalEditorBrowserCoordinateAxisId;
  label: string;
  color: string;
  x: number;
  y: number;
  depth: number;
  scale: number;
}

export interface LocalEditorBrowserCoordinateAxesState {
  axes: LocalEditorBrowserCoordinateAxis[];
  projectionMode: LocalEditorBrowserViewportProjectionMode;
  projectionToggleDisabled?: boolean;
}

export interface LocalEditorBrowserSceneFrameStats {
  fps: number | null;
  frameCount: number;
  mode: 'idle' | 'continuous';
  lastFrameMs: number | null;
  activeReasons: string[];
}

export interface LocalEditorBrowserUiPropertyInput {
  targetId: string;
  targetIds?: string[];
  path: string;
  value: number | string | boolean | Record<string, unknown> | null;
  control?: LocalEditorBrowserInspectorControlKind;
  valueType?: LocalEditorBrowserInspectorProperty['valueType'];
  commitMode?: LocalEditorBrowserInspectorCommitMode;
  persistence?: LocalEditorBrowserInspectorPersistenceMode;
  source?: LocalEditorBrowserInspectorEditSource;
}

export interface LocalEditorBrowserRenderingPropertyChangeInput {
  sectionId: string;
  systemId: string;
  path: string;
  value: unknown;
  control?: LocalEditorBrowserRenderingPropertyControlKind;
  valueType?: LocalEditorBrowserRenderingPropertyValueType;
  commitMode?: LocalEditorBrowserRenderingPropertyCommitMode;
  source?: LocalEditorBrowserRenderingPropertyEditSource;
}

export interface LocalEditorBrowserRenderingActionInput {
  actionId: string;
}

export type LocalEditorBrowserInspectorConflictStrategy = 'error' | 'ignore' | 'replace';

export interface LocalEditorBrowserInspectorControlBindingOptions {
  source?: LocalEditorBrowserInspectorEditSource;
}

export interface LocalEditorBrowserInspectorControlRenderContext<TDocument = unknown> {
  doc: Document;
  target: LocalEditorBrowserInspectorObject<TDocument>;
  property: LocalEditorBrowserInspectorProperty<TDocument>;
  bindInput(
    element: HTMLInputElement | HTMLSelectElement,
    options?: LocalEditorBrowserInspectorControlBindingOptions,
  ): void;
}

export type LocalEditorBrowserInspectorControlRenderer<TDocument = unknown> = (
  context: LocalEditorBrowserInspectorControlRenderContext<TDocument>,
) => HTMLElement;

export interface LocalEditorBrowserInspectorControlRegistration<TDocument = unknown> {
  id: string;
  order?: number;
  control?: LocalEditorBrowserInspectorControlKind;
  customControl?: string;
  supports?(context: LocalEditorBrowserInspectorControlRenderContext<TDocument>): boolean;
  render: LocalEditorBrowserInspectorControlRenderer<TDocument>;
}

export interface LocalEditorBrowserInspectorOptions<TDocument = unknown> {
  controls?: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[];
  controlConflict?: LocalEditorBrowserInspectorConflictStrategy;
}

export interface LocalEditorBrowserHierarchySelectionInput {
  id: string;
  additive: boolean;
  toggle: boolean;
}

export type LocalEditorBrowserSceneGraphDropPlacement = 'inside' | 'before' | 'after';

export type LocalEditorBrowserSceneGraphMovePlacement = LocalEditorBrowserSceneGraphDropPlacement | 'root';

export interface LocalEditorBrowserSceneGraphRenameIntent {
  id: string;
  name: string;
}

export interface LocalEditorBrowserSceneGraphCreateGroupIntent {
  parentId?: string | null;
  activeId?: string | null;
  name?: string;
}

export type LocalEditorBrowserPrimitiveShape = SceneGraphPrimitiveShape;

export interface LocalEditorBrowserSceneGraphCreatePrimitiveIntent {
  parentId?: string | null;
  activeId?: string | null;
  shape: LocalEditorBrowserPrimitiveShape;
  name?: string;
}

export interface LocalEditorBrowserSceneGraphDeleteIntent {
  ids: string[];
  activeId?: string | null;
}

export interface LocalEditorBrowserSceneGraphDuplicateIntent {
  targetIds: string[];
  activeId?: string | null;
}

export interface LocalEditorBrowserSceneGraphDropIntent {
  draggedId: string;
  targetId: string;
  placement: LocalEditorBrowserSceneGraphDropPlacement;
  preserveWorldTransform?: boolean;
}

export interface LocalEditorBrowserSceneGraphMoveIntent {
  ids: string[];
  targetId?: string | null;
  placement: LocalEditorBrowserSceneGraphMovePlacement;
  parentId?: string | null;
  beforeId?: string | null;
  afterId?: string | null;
  preserveWorldTransform?: boolean;
}

export interface LocalEditorBrowserSceneGraphGroupSelectionIntent {
  ids: string[];
  parentId?: string | null;
  insertBeforeId?: string | null;
  name?: string;
  pivot?: 'selection-center' | 'active' | 'parent-origin';
  preserveWorldTransform?: boolean;
}

export interface LocalEditorContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  separatorBefore?: boolean;
  children?: LocalEditorContextMenuItem[];
}

export interface LocalEditorBrowserHierarchyContextActionContext<TDocument = unknown> {
  state: LocalEditorBrowserUiState<TDocument>;
  menuKind: 'node' | 'blank';
  node: LocalEditorBrowserUiHierarchyItem | null;
  contextNodeId: string | null;
  targetIds: string[];
  activeId: string | null;
}

export type LocalEditorBrowserHierarchyContextActionPlacement =
  | 'top'
  | 'after-primary'
  | 'after-create'
  | 'after-edit'
  | 'after-clipboard'
  | 'bottom';

export interface LocalEditorBrowserHierarchyContextActionRegistration<TDocument = unknown> {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  placement?: LocalEditorBrowserHierarchyContextActionPlacement;
  separatorBefore?: boolean;
  visible?(context: LocalEditorBrowserHierarchyContextActionContext<TDocument>): boolean;
  disabled?(context: LocalEditorBrowserHierarchyContextActionContext<TDocument>): boolean | string;
  payload?(context: LocalEditorBrowserHierarchyContextActionContext<TDocument>): Record<string, unknown> | undefined;
}

export type LocalEditorContextAction =
  | { region: 'hierarchy'; action: 'focus'; targetIds: string[]; activeId: string | null }
  | { region: 'hierarchy'; action: 'rename'; targetId: string }
  | { region: 'hierarchy'; action: 'create-group'; parentId?: string | null; activeId?: string | null }
  | { region: 'hierarchy'; action: 'create-primitive'; parentId?: string | null; activeId?: string | null; shape: LocalEditorBrowserPrimitiveShape; name?: string }
  | { region: 'hierarchy'; action: 'delete'; targetIds: string[]; activeId?: string | null }
  | { region: 'hierarchy'; action: 'duplicate'; targetIds: string[]; activeId?: string | null }
  | { region: 'hierarchy'; action: 'paste'; sourceIds: string[]; activeId?: string | null }
  | { region: 'hierarchy'; action: 'custom'; id: string; contextNodeId: string | null; targetIds: string[]; activeId: string | null; payload?: Record<string, unknown> };

export interface LocalEditorBrowserAssetActionInput {
  actionId: string;
  assetId: string;
  browserAssetId: string;
  assetKind?: string;
  fieldPath?: string;
  value?: unknown;
}

export interface LocalEditorBrowserUiCallbacks {
  onEnterEditor?: () => void;
  onSaveScene?: () => void;
  onSaveAndRunGame?: () => void;
  onDiscardAndRunGame?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectHierarchyItem?: (input: LocalEditorBrowserHierarchySelectionInput) => void;
  onSelectionCommand?: (command: SelectionCommand) => void;
  onCreateFromAsset?: (assetId: string) => void;
  onSelectAsset?: (assetId: string) => void;
  onAssetAction?: (input: LocalEditorBrowserAssetActionInput) => void;
  onAssetFilterChange?: (value: string) => void;
  onPropertyInput?: (input: LocalEditorBrowserUiPropertyInput) => void;
  onRenderingPropertyChange?: (input: LocalEditorBrowserRenderingPropertyChangeInput) => void;
  onRenderingAction?: (input: LocalEditorBrowserRenderingActionInput) => void;
  onTransformToolChange?: (tool: LocalEditorBrowserTransformTool) => void;
  onTransformSpaceChange?: (space: LocalEditorBrowserTransformSpace) => void;
  onTransformConstraintChange?: (constraint: LocalEditorBrowserTransformConstraint) => void;
  onTransformSnapEnabledChange?: (enabled: boolean) => void;
  onTransformSnapStepChange?: (input: { kind: LocalEditorBrowserTransformSnapStepKind; value: number }) => void;
  onPlacementModeChange?: (mode: LocalEditorBrowserPlacementMode) => void;
  onTransformAction?: (action: LocalEditorBrowserTransformAction) => void;
  onViewportViewPresetChange?: (preset: LocalEditorBrowserViewportViewPreset) => void;
  onViewportProjectionModeChange?: (mode: LocalEditorBrowserViewportProjectionMode) => void;
  onViewportOverlaySettingsChange?: (settings: LocalEditorBrowserViewportOverlaySettings) => void;
  onViewportUtilityToolChange?: (tool: LocalEditorBrowserViewportUtilityTool) => void;
  onViewportMeasurementClear?: () => void;
  onSceneCameraPreviewToggle?: (enabled: boolean) => void;
  onGridVisibleChange?: (visible: boolean) => void;
  onFocusSelection?: () => void;
  onCancelEditorIntent?: () => void;
  onCancelActiveOperation?: () => void;
  onSceneGraphRename?: (intent: LocalEditorBrowserSceneGraphRenameIntent) => void;
  onSceneGraphCreateGroup?: (intent: LocalEditorBrowserSceneGraphCreateGroupIntent) => void;
  onSceneGraphCreatePrimitive?: (intent: LocalEditorBrowserSceneGraphCreatePrimitiveIntent) => void;
  onSceneGraphDelete?: (intent: LocalEditorBrowserSceneGraphDeleteIntent) => void;
  onSceneGraphDuplicate?: (intent: LocalEditorBrowserSceneGraphDuplicateIntent) => void;
  onSceneGraphDrop?: (intent: LocalEditorBrowserSceneGraphDropIntent) => void;
  onSceneGraphMove?: (intent: LocalEditorBrowserSceneGraphMoveIntent) => void;
  onSceneGraphGroupSelection?: (intent: LocalEditorBrowserSceneGraphGroupSelectionIntent) => void;
  onContextAction?: (action: LocalEditorContextAction) => void;
}

export interface LocalEditorBrowserUiOptions<TDocument = unknown> {
  root?: HTMLElement;
  document?: Document;
  theme?: LocalEditorThemeName;
  localTestActions?: boolean;
  input?: {
    isShortcutReserved?: (event: KeyboardEvent) => boolean;
  };
  callbacks?: LocalEditorBrowserUiCallbacks;
  inspector?: LocalEditorBrowserInspectorOptions<TDocument>;
  hierarchy?: {
    contextActions?: readonly LocalEditorBrowserHierarchyContextActionRegistration<TDocument>[];
  };
}

export interface LocalEditorBrowserUi<TDocument = unknown> {
  update(state: LocalEditorBrowserUiState<TDocument>): void;
  updateSceneFrameStats?(stats: LocalEditorBrowserSceneFrameStats | null): void;
  setTheme?(theme: LocalEditorThemeName): void;
  getTheme?(): LocalEditorThemeName;
  dispose(): void;
}

export interface LocalEditorThemeController {
  setTheme(theme: LocalEditorThemeName): void;
  getTheme(): LocalEditorThemeName;
}

export type LocalEditorBottomDockTab = 'assets' | 'history';

export type LocalEditorRightDockTab = 'inspector' | 'rendering';

export type LocalEditorAssetBrowserTab = 'all' | 'models' | 'materials' | 'textures';

export type LocalEditorWorkbenchDockArea = 'left' | 'right' | 'bottom';

export type LocalEditorWorkbenchPanelId = 'hierarchy' | LocalEditorRightDockTab | LocalEditorBottomDockTab;

export type LocalEditorWorkbenchRegionId = 'top-app-bar' | 'left-dock' | 'scene-view' | 'scene-header' | 'right-dock' | 'bottom-dock';

export interface LocalEditorWorkbenchRegionDescriptor {
  id: LocalEditorWorkbenchRegionId;
  label: string;
}

export interface LocalEditorWorkbenchPanelDescriptor {
  id: LocalEditorWorkbenchPanelId;
  title: string;
  area: LocalEditorWorkbenchDockArea;
  contextMenu?: string;
  toolbar?: string;
}

export interface LocalEditorWorkbenchLayout {
  regions: LocalEditorWorkbenchRegionDescriptor[];
  panels: LocalEditorWorkbenchPanelDescriptor[];
  activeTabs: Record<LocalEditorWorkbenchDockArea, LocalEditorWorkbenchPanelId | null>;
}
