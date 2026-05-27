import * as LocalEditorPanels from './local-editor-ui-panels';
import { createLocalEditorHierarchyController } from './local-editor-ui-hierarchy-controller';
import { createLocalEditorContextMenuController } from './local-editor-ui-context-menu';
import { createLocalEditorTooltipController } from './local-editor-ui-tooltip';
import {
  DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
  DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS,
} from '@fps-games/editor-core';
export {
  createLocalEditorHierarchyBlankMenu,
  createLocalEditorHierarchyCopyShortcutAction,
  createLocalEditorHierarchyDeleteShortcutAction,
  createLocalEditorHierarchyDuplicateShortcutAction,
  createLocalEditorHierarchyNodeMenu,
  createLocalEditorHierarchyPasteShortcutAction,
  createLocalEditorHierarchySelectAllShortcutAction,
} from './local-editor-ui-hierarchy-actions';
export {
  createLocalEditorHierarchyController,
} from './local-editor-ui-hierarchy-controller';
export {
  canLocalEditorHierarchyNodeHaveChildren,
  createLocalEditorHierarchyTreeModel,
  isLocalEditorHierarchyNodeMovable,
} from './local-editor-ui-hierarchy-tree';
export {
  createLocalEditorContextMenuController,
  type LocalEditorContextMenuController,
  type LocalEditorContextMenuOpenInput,
} from './local-editor-ui-context-menu';
export {
  createLocalEditorTooltipController,
  type LocalEditorTooltipController,
} from './local-editor-ui-tooltip';
export type {
  LocalEditorHierarchyAction,
  LocalEditorHierarchyActionInput,
  LocalEditorHierarchyMenuDefinition,
} from './local-editor-ui-hierarchy-actions';
export type {
  LocalEditorHierarchyController,
  LocalEditorHierarchyControllerOptions,
} from './local-editor-ui-hierarchy-controller';
export type {
  LocalEditorHierarchyDropPlacement,
  LocalEditorHierarchyDropResolution,
  LocalEditorHierarchyTreeModel,
  LocalEditorHierarchyTreeNode,
  LocalEditorHierarchyTreeOptions,
} from './local-editor-ui-hierarchy-tree';
import { createLocalEditorWorkbenchInputRouter } from './local-editor-ui-input-router';
import { createLocalEditorPanelRegistry } from './local-editor-ui-panel-registry';
import * as LocalEditorShared from './local-editor-ui-shared';
import { createShortcutHelpPanel as createLocalEditorShortcutHelpPanel } from './local-editor-ui-shortcuts';
import {
  applyLocalEditorTheme,
  ensureLocalEditorTheme,
  LOCAL_EDITOR_THEME_CLASS,
  normalizeLocalEditorThemeName,
  type LocalEditorThemeName,
} from './local-editor-ui-theme';
import {
  createDefaultLocalEditorWorkbenchLayout,
  createLocalEditorWorkbenchLayoutController,
  createLocalEditorWorkbench,
  createSceneHeaderToolbar,
  createWorkbenchPanelContent,
} from './local-editor-ui-workbench';
import { createLocalEditorIcon, type LocalEditorIconName } from './local-editor-ui-icons';
import type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserCoordinateAxesState,
  LocalEditorBrowserInspectorCommitMode,
  LocalEditorBrowserInspectorControlKind,
  LocalEditorBrowserInspectorEditSource,
  LocalEditorBrowserInspectorPersistenceMode,
  LocalEditorBrowserInspectorProperty,
  LocalEditorBrowserPlacementMode,
  LocalEditorBrowserSceneFrameStats,
  LocalEditorBrowserTransformAction,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformSnapStepKind,
  LocalEditorBrowserTransformTool,
  LocalEditorBrowserTransformToolDescriptor,
  LocalEditorBrowserViewportProjectionMode,
  LocalEditorBrowserViewportMeasurementState,
  LocalEditorBrowserViewportUtilityTool,
  LocalEditorBrowserViewportViewPreset,
  LocalEditorBrowserViewportSpatialOverlayState,
  LocalEditorBrowserUi,
  LocalEditorBrowserUiOptions,
  LocalEditorBrowserUiPropertyInput,
  LocalEditorBrowserUiState,
  LocalEditorThemeController,
} from './local-editor-ui-types';

export {
  applyLocalEditorBrowserInspectorControlBinding,
  createLocalEditorBrowserInspectorControlRegistry,
  formatLocalEditorBrowserInspectorNumberValue,
  formatLocalEditorBrowserInspectorValue,
  resolveLocalEditorBrowserInspectorSectionStatus,
  resolveLocalEditorBrowserInspectorControlRegistration,
} from './local-editor-ui-panels';
export type {
  LocalEditorBrowserInspectorAccessMode,
  LocalEditorBrowserInspectorRenderOptions,
  LocalEditorBrowserInspectorSectionStatus,
} from './local-editor-ui-panels';

export type {
  LocalEditorThemeName,
} from './local-editor-ui-theme';

export {
  DEFAULT_LOCAL_EDITOR_THEME,
  LOCAL_EDITOR_THEME_CLASS,
  applyLocalEditorTheme,
  normalizeLocalEditorThemeName,
} from './local-editor-ui-theme';

export {
  LOCAL_EDITOR_ICON_NAMES,
  createLocalEditorIcon,
  isLocalEditorIconName,
  resolveLocalEditorIconName,
} from './local-editor-ui-icons';

export type {
  LocalEditorIconName,
  LocalEditorIconOptions,
} from './local-editor-ui-icons';

export type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserAuthoringSource,
  LocalEditorBrowserCoordinateAxis,
  LocalEditorBrowserCoordinateAxesState,
  LocalEditorBrowserCoordinateAxisId,
  LocalEditorBrowserHierarchySelectionInput,
  LocalEditorBrowserHistoryEntry,
  LocalEditorBrowserHistoryView,
  LocalEditorBrowserHierarchyContextActionContext,
  LocalEditorBrowserHierarchyContextActionPlacement,
  LocalEditorBrowserHierarchyContextActionRegistration,
  LocalEditorBrowserInspectorCommitMode,
  LocalEditorBrowserInspectorConflictStrategy,
  LocalEditorBrowserInspectorControlBindingOptions,
  LocalEditorBrowserInspectorControlKind,
  LocalEditorBrowserInspectorControlRegistration,
  LocalEditorBrowserInspectorControlRenderContext,
  LocalEditorBrowserInspectorControlRenderer,
  LocalEditorBrowserInspectorEffectMode,
  LocalEditorBrowserInspectorEditSource,
  LocalEditorBrowserInspectorObject,
  LocalEditorBrowserInspectorOptions,
  LocalEditorBrowserInspectorPersistenceMode,
  LocalEditorBrowserInspectorProperty,
  LocalEditorBrowserInspectorSection,
  LocalEditorBrowserPlacementMode,
  LocalEditorBrowserPrimitiveShape,
  LocalEditorBrowserSceneFrameStats,
  LocalEditorBrowserSceneGraphCreateGroupIntent,
  LocalEditorBrowserSceneGraphCreatePrimitiveIntent,
  LocalEditorBrowserSceneGraphDeleteIntent,
  LocalEditorBrowserSceneGraphDuplicateIntent,
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserSceneGraphDropPlacement,
  LocalEditorBrowserSceneGraphGroupSelectionIntent,
  LocalEditorBrowserSceneGraphMoveIntent,
  LocalEditorBrowserSceneGraphMovePlacement,
  LocalEditorBrowserSceneGraphRenameIntent,
  LocalEditorBrowserSerializedMultiObject,
  LocalEditorBrowserSerializedObject,
  LocalEditorBrowserSerializedProperty,
  LocalEditorBrowserSerializedValueType,
  LocalEditorBrowserTransformConstraint,
  LocalEditorBrowserTransformAction,
  LocalEditorBrowserTransformOperationSettings,
  LocalEditorBrowserTransformOperationState,
  LocalEditorBrowserTransformSnapStepKind,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformTool,
  LocalEditorBrowserTransformToolState,
  LocalEditorBrowserViewportSpatialOverlayState,
  LocalEditorBrowserUi,
  LocalEditorBrowserUiAssetItem,
  LocalEditorBrowserUiCallbacks,
  LocalEditorBrowserUiHierarchyItem,
  LocalEditorBrowserUiOptions,
  LocalEditorBrowserUiPropertyInput,
  LocalEditorBrowserUiState,
  LocalEditorThemeController,
  LocalEditorContextAction,
  LocalEditorContextMenuItem,
} from './local-editor-ui-types';

export type LocalEditorBrowserInspectorNumberParseMode = 'live' | 'final';
const INSPECTOR_INPUT_PENDING = Symbol('inspector-input-pending');

type InspectorInputReadValue =
  | number
  | string
  | boolean
  | Record<string, unknown>
  | null
  | typeof INSPECTOR_INPUT_PENDING;

export function parseLocalEditorBrowserInspectorNumberValue(
  value: string,
  mode: LocalEditorBrowserInspectorNumberParseMode = 'final',
): number | null {
  const normalized = value.trim();
  if (normalized === '') return mode === 'final' ? 0 : null;
  if (
    normalized === '-'
    || normalized === '+'
    || normalized === '.'
    || normalized === '-.'
    || normalized === '+.'
  ) {
    return null;
  }
  if (mode === 'live' && (/[.]$/.test(normalized) || /e[+-]?$/i.test(normalized))) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function readInspectorInputValue(
  input: HTMLInputElement | HTMLSelectElement,
  mode: LocalEditorBrowserInspectorNumberParseMode = 'final',
): InspectorInputReadValue {
  const control = input.dataset.serializedControl;
  const valueType = input.dataset.serializedValueType;
  if ((control === 'vec2' || control === 'vec3') && input instanceof HTMLInputElement) {
    return readInspectorVectorInputValue(input, mode);
  }
  if (control === 'enum' && input instanceof HTMLSelectElement) {
    const option = input.selectedOptions.item(0);
    const encoded = option?.dataset.serializedOptionValue;
    if (encoded != null) {
      try {
        return JSON.parse(encoded) as string | number | boolean | Record<string, unknown> | null;
      } catch {
        return option?.value ?? input.value;
      }
    }
  }
  if (input instanceof HTMLInputElement && input.type === 'checkbox') return input.checked;
  if (control === 'boolean' || valueType === 'boolean') return input.value === 'true';
  if (control === 'number' || valueType === 'number') {
    return parseLocalEditorBrowserInspectorNumberValue(input.value, mode) ?? INSPECTOR_INPUT_PENDING;
  }
  if (control === 'color' && input instanceof HTMLInputElement && input.type === 'color') {
    const value = input.value.replace('#', '');
    const numeric = Number.parseInt(value, 16);
    if (!Number.isFinite(numeric)) return null;
    return {
      r: ((numeric >> 16) & 255) / 255,
      g: ((numeric >> 8) & 255) / 255,
      b: (numeric & 255) / 255,
    };
  }
  return input.value;
}

const TRANSFORM_TOOL_ICONS: Record<LocalEditorBrowserTransformTool, LocalEditorIconName> = {
  select: 'select',
  move: 'move',
  rotate: 'rotate',
  scale: 'scale',
};

const TRANSFORM_SPACE_ICONS: Record<LocalEditorBrowserTransformSpace, LocalEditorIconName> = {
  world: 'world',
  local: 'local',
};

const PLACEMENT_MODE_ICONS: Record<LocalEditorBrowserPlacementMode, LocalEditorIconName> = {
  off: 'place-off',
  ground: 'place-ground',
  surface: 'place-surface',
};

const PLACEMENT_MODE_DESCRIPTIONS: Record<LocalEditorBrowserPlacementMode, string> = {
  off: '关闭放置模式',
  ground: '放置到 XZ 地面',
  surface: '放置到场景表面',
};

const VIEW_PRESET_ICONS: Record<LocalEditorBrowserViewportViewPreset, LocalEditorIconName> = {
  perspective: 'view-perspective',
  top: 'view-top',
  front: 'view-front',
  right: 'view-right',
};

const VIEW_PRESET_TOOLTIPS: Record<LocalEditorBrowserViewportViewPreset, string> = {
  perspective: '透视视图',
  top: '顶视图 · 自动切换正交',
  front: '前视图 · 自动切换正交',
  right: '右视图 · 自动切换正交',
};

const VIEWPORT_OVERLAY_TOGGLE_LABELS = {
  bounds: '包围盒',
  dimensions: '尺寸摘要',
  edgeLengths: '边长标注',
  anchor: '锚点坐标',
} as const;

const VIEWPORT_PROJECTION_LABELS: Record<LocalEditorBrowserViewportProjectionMode, string> = {
  perspective: '透视',
  orthographic: '正交',
};

const TRANSFORM_ACTION_GROUPS = [
  {
    title: '对齐到 Active Object',
    hint: '需要至少 2 个选中对象',
    actions: ['align-x', 'align-y', 'align-z', 'align-all'],
  },
  {
    title: '均匀分布',
    hint: '需要至少 3 个选中对象',
    actions: ['distribute-x', 'distribute-y', 'distribute-z'],
  },
] as const satisfies ReadonlyArray<{
  title: string;
  hint: string;
  actions: ReadonlyArray<LocalEditorBrowserTransformAction>;
}>;

const TRANSFORM_ACTION_LABELS: Record<LocalEditorBrowserTransformAction, string> = {
  'align-x': '对齐 X',
  'align-y': '对齐 Y',
  'align-z': '对齐 Z',
  'align-all': '对齐全',
  'distribute-x': '分布 X',
  'distribute-y': '分布 Y',
  'distribute-z': '分布 Z',
};

function createTransformToolTooltip(
  descriptor: LocalEditorBrowserTransformToolDescriptor,
): string {
  const toolLabel = descriptor.shortcut
    ? `${descriptor.label}工具 (${descriptor.shortcut})`
    : `${descriptor.label}工具`;
  return `${toolLabel} · ${LocalEditorShared.toTransformMouseHint(descriptor.tool)}`;
}

function createToolbarIconButton(
  doc: Document,
  label: string,
  icon: LocalEditorIconName,
  tooltip = label,
  toolbarRole: 'command' | 'toggle' | 'settings' = 'command',
): HTMLButtonElement {
  return LocalEditorShared.createButton(doc, label, {
    icon,
    labelMode: 'icon-only',
    variant: 'toolbar-icon',
    tooltip,
    ariaLabel: tooltip,
    toolbarRole,
  });
}

function setToolbarButtonTooltip(button: HTMLButtonElement, tooltip: string): void {
  button.dataset.editorTooltip = tooltip;
  button.setAttribute('aria-label', tooltip);
}

function setToolbarButtonIcon(
  doc: Document,
  button: HTMLButtonElement,
  icon: LocalEditorIconName,
): void {
  const currentIcon = button.querySelector<HTMLElement>('[data-editor-icon]');
  if (currentIcon?.dataset.editorIcon === icon) return;
  const nextIcon = createLocalEditorIcon(doc, icon);
  if (currentIcon) currentIcon.replaceWith(nextIcon);
  else button.prepend(nextIcon);
}

function readInspectorVectorInputValue(
  input: HTMLInputElement,
  mode: LocalEditorBrowserInspectorNumberParseMode,
): Record<string, number> | typeof INSPECTOR_INPUT_PENDING {
  const wrapper = input.closest<HTMLElement>('[data-inspector-vector-control]');
  const values: Record<string, number> = {};
  const fields = wrapper
    ? Array.from(wrapper.querySelectorAll<HTMLInputElement>('input[data-serialized-vector-axis]'))
    : [input];
  for (const field of fields) {
    const axis = field.dataset.serializedVectorAxis;
    if (!axis) continue;
    const numeric = parseLocalEditorBrowserInspectorNumberValue(field.value, mode);
    if (numeric == null) return INSPECTOR_INPUT_PENDING;
    values[axis] = numeric;
  }
  return values;
}

function createInspectorPropertyInput(
  input: HTMLInputElement | HTMLSelectElement,
  source: LocalEditorBrowserInspectorEditSource,
  numberParseMode: LocalEditorBrowserInspectorNumberParseMode = 'final',
): LocalEditorBrowserUiPropertyInput | null {
  if (!input.dataset.serializedPath || !input.dataset.serializedTargetId) return null;
  const targetIds = input.dataset.serializedTargetIds
    ? input.dataset.serializedTargetIds.split(',').filter(Boolean)
    : undefined;
  const value = readInspectorInputValue(input, numberParseMode);
  if (value === INSPECTOR_INPUT_PENDING) return null;
  return {
    targetId: input.dataset.serializedTargetId,
    targetIds,
    path: input.dataset.serializedPath,
    value,
    control: input.dataset.serializedControl as LocalEditorBrowserInspectorControlKind | undefined,
    valueType: input.dataset.serializedValueType as LocalEditorBrowserInspectorProperty['valueType'] | undefined,
    commitMode: input.dataset.serializedCommitMode as LocalEditorBrowserInspectorCommitMode | undefined,
    persistence: input.dataset.serializedPersistence as LocalEditorBrowserInspectorPersistenceMode | undefined,
    source: (input.dataset.serializedEditSource as LocalEditorBrowserInspectorEditSource | undefined) ?? source,
  };
}

function hasPendingInspectorNumberValue(
  input: HTMLInputElement,
  mode: LocalEditorBrowserInspectorNumberParseMode = 'live',
): boolean {
  const control = input.dataset.serializedControl;
  const valueType = input.dataset.serializedValueType;
  if (control !== 'number' && valueType !== 'number' && control !== 'vec2' && control !== 'vec3') return false;
  return readInspectorInputValue(input, mode) === INSPECTOR_INPUT_PENDING;
}

function readInspectorCommitMode(input: HTMLInputElement | HTMLSelectElement): LocalEditorBrowserInspectorCommitMode {
  return (input.dataset.serializedCommitMode as LocalEditorBrowserInspectorCommitMode | undefined) ?? 'live';
}

function readInspectorImmediateSource(input: HTMLInputElement | HTMLSelectElement): LocalEditorBrowserInspectorEditSource {
  if (input instanceof HTMLSelectElement) return 'select';
  if (input.type === 'checkbox') return 'toggle';
  if (input.type === 'color') return 'color';
  return 'input';
}

interface CoordinateAxesOverlayElements {
  root: HTMLDivElement;
  lineLayer: SVGGElement;
  labelLayer: SVGGElement;
  axisGroups: Map<string, SVGGElement>;
  axisLines: Map<string, SVGLineElement>;
  axisLabels: Map<string, SVGTextElement>;
  axisDiscs: Map<string, SVGCircleElement>;
  centerDot: SVGCircleElement;
  projectionIcon: SVGGElement;
  projectionIconShape: SVGPathElement;
}

interface SceneFrameRateOverlayElements {
  root: HTMLDivElement;
  fpsValue: HTMLSpanElement;
  modeLabel: HTMLSpanElement;
}

function createSceneFrameRateOverlay(doc: Document): SceneFrameRateOverlayElements {
  const root = doc.createElement('div');
  root.classList.add(LOCAL_EDITOR_THEME_CLASS);
  root.dataset.editorSceneFrameRateOverlay = 'true';
  root.style.cssText = [
    'position:absolute',
    'right:14px',
    'bottom:134px',
    'z-index:3',
    'display:none',
    'align-items:center',
    'gap:6px',
    'width:112px',
    'height:30px',
    'padding:0 8px',
    'box-sizing:border-box',
    'border:1px solid color-mix(in srgb, var(--fps-editor-border) 78%, transparent)',
    'border-radius:6px',
    'background:color-mix(in srgb, var(--fps-editor-chrome) 76%, transparent)',
    'box-shadow:var(--fps-editor-shadow-panel)',
    'font-family:var(--fps-editor-font)',
    'font-size:11px',
    'font-weight:900',
    'letter-spacing:0',
    'color:var(--fps-editor-text-strong)',
    'pointer-events:none',
    'backdrop-filter:blur(5px)',
    'overflow:hidden',
  ].join(';');

  const label = doc.createElement('span');
  label.textContent = 'FPS';
  label.style.cssText = [
    'color:var(--fps-editor-muted-strong)',
    'font-size:10px',
    'line-height:1',
  ].join(';');
  const fpsValue = doc.createElement('span');
  fpsValue.textContent = '--';
  fpsValue.style.cssText = [
    'width:26px',
    'flex:0 0 26px',
    'font-variant-numeric:tabular-nums',
    'font-size:13px',
    'line-height:1',
  ].join(';');
  const modeLabel = doc.createElement('span');
  modeLabel.textContent = 'IDLE';
  modeLabel.style.cssText = [
    'margin-left:auto',
    'padding:2px 4px',
    'flex:0 0 auto',
    'border:1px solid var(--fps-editor-border-soft)',
    'border-radius:4px',
    'background:color-mix(in srgb, var(--fps-editor-field) 72%, transparent)',
    'color:var(--fps-editor-muted)',
    'font-size:9px',
    'line-height:1',
  ].join(';');

  root.appendChild(label);
  root.appendChild(fpsValue);
  root.appendChild(modeLabel);
  return { root, fpsValue, modeLabel };
}

function renderSceneFrameRateOverlay(
  overlay: SceneFrameRateOverlayElements,
  stats: LocalEditorBrowserSceneFrameStats | null,
): void {
  if (!stats) {
    overlay.root.style.display = 'none';
    return;
  }
  overlay.root.style.display = 'flex';
  const fps = Number.isFinite(stats.fps) ? Math.round(stats.fps as number) : null;
  const displayFps = stats.mode === 'idle' ? 0 : fps;
  overlay.fpsValue.textContent = displayFps == null ? '--' : String(displayFps);
  overlay.modeLabel.textContent = stats.mode === 'continuous' ? 'LIVE' : 'IDLE';
  overlay.modeLabel.style.color = stats.mode === 'continuous'
    ? 'var(--fps-editor-success)'
    : 'var(--fps-editor-muted)';
  overlay.fpsValue.style.color = displayFps == null || stats.mode === 'idle'
    ? 'var(--fps-editor-muted)'
    : displayFps >= 50
      ? 'var(--fps-editor-success)'
      : displayFps >= 30
        ? 'var(--fps-editor-warn)'
        : 'var(--fps-editor-danger-strong)';
  overlay.root.title = [
    `Scene FPS: ${displayFps == null ? '--' : displayFps}`,
    `mode: ${stats.mode}`,
    stats.lastFrameMs == null ? '' : `frame: ${stats.lastFrameMs.toFixed(1)}ms`,
    stats.activeReasons.length ? `active: ${stats.activeReasons.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
}

function createCoordinateAxesOverlay(doc: Document): CoordinateAxesOverlayElements {
  const root = doc.createElement('div');
  root.dataset.editorCoordinateAxesOverlay = 'true';
  root.style.cssText = [
    'position:absolute',
    'right:14px',
    'bottom:14px',
    'width:112px',
    'height:112px',
    'display:none',
    'z-index:2',
    'box-sizing:border-box',
    'border:1px solid color-mix(in srgb, var(--fps-editor-border) 78%, transparent)',
    'border-radius:8px',
    'background:color-mix(in srgb, var(--fps-editor-chrome) 58%, transparent)',
    'box-shadow:var(--fps-editor-shadow-panel)',
    'pointer-events:none',
    'overflow:hidden',
  ].join(';');

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 112 112');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'display:block;width:100%;height:100%';
  root.appendChild(svg);

  const lineLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  const labelLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(lineLayer);
  svg.appendChild(labelLayer);

  const axisGroups = new Map<string, SVGGElement>();
  const axisLines = new Map<string, SVGLineElement>();
  const axisLabels = new Map<string, SVGTextElement>();
  const axisDiscs = new Map<string, SVGCircleElement>();
  for (const axis of ['x', 'y', 'z']) {
    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke-width', '3.2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('x1', '56');
    line.setAttribute('y1', '56');
    const disc = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    disc.setAttribute('r', '7');
    const label = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('dy', '0.04em');
    label.style.cssText = [
      'fill:#172033',
      'font-size:10px',
      'font-weight:900',
      'font-family:Arial, Helvetica, sans-serif',
      'letter-spacing:0',
    ].join(';');
    group.appendChild(disc);
    group.appendChild(label);
    lineLayer.appendChild(line);
    labelLayer.appendChild(group);
    axisGroups.set(axis, group);
    axisLines.set(axis, line);
    axisLabels.set(axis, label);
    axisDiscs.set(axis, disc);
  }

  const centerDot = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
  centerDot.setAttribute('cx', '56');
  centerDot.setAttribute('cy', '56');
  centerDot.setAttribute('r', '3.2');
  centerDot.setAttribute('fill', 'color-mix(in srgb, var(--fps-editor-text) 82%, transparent)');
  labelLayer.appendChild(centerDot);

  const projectionIcon = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  projectionIcon.setAttribute('transform', 'translate(8 8)');
  projectionIcon.setAttribute('role', 'button');
  projectionIcon.setAttribute('tabindex', '0');
  projectionIcon.dataset.coordinateAxesProjectionToggle = 'true';
  projectionIcon.style.cssText = 'opacity:0.92;pointer-events:auto;cursor:pointer;outline:none';
  const projectionIconFrame = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
  projectionIconFrame.setAttribute('x', '0');
  projectionIconFrame.setAttribute('y', '0');
  projectionIconFrame.setAttribute('width', '18');
  projectionIconFrame.setAttribute('height', '18');
  projectionIconFrame.setAttribute('rx', '4');
  projectionIconFrame.setAttribute('fill', 'color-mix(in srgb, var(--fps-editor-chrome) 78%, transparent)');
  projectionIconFrame.setAttribute('stroke', 'color-mix(in srgb, var(--fps-editor-border) 82%, transparent)');
  projectionIconFrame.setAttribute('stroke-width', '1');
  const projectionIconShape = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  projectionIconShape.setAttribute('fill', 'none');
  projectionIconShape.setAttribute('stroke', 'color-mix(in srgb, var(--fps-editor-accent) 82%, #ffffff)');
  projectionIconShape.setAttribute('stroke-width', '1.6');
  projectionIconShape.setAttribute('stroke-linejoin', 'round');
  projectionIconShape.setAttribute('stroke-linecap', 'round');
  projectionIcon.appendChild(projectionIconFrame);
  projectionIcon.appendChild(projectionIconShape);
  svg.appendChild(projectionIcon);

  return {
    root,
    lineLayer,
    labelLayer,
    axisGroups,
    axisLines,
    axisLabels,
    axisDiscs,
    centerDot,
    projectionIcon,
    projectionIconShape,
  };
}

function renderCoordinateAxesOverlay(
  overlay: CoordinateAxesOverlayElements,
  state: LocalEditorBrowserCoordinateAxesState | null,
): void {
  if (!state?.axes?.length) {
    overlay.root.style.display = 'none';
    return;
  }
  overlay.root.style.display = '';
  renderCoordinateAxesProjectionIcon(overlay, state.projectionMode, state.projectionToggleDisabled === true);
  const center = 56;
  const lineLength = 38;
  const sortedAxes = [...state.axes].sort((left, right) => right.depth - left.depth);
  for (const axis of sortedAxes) {
    const group = overlay.axisGroups.get(axis.id);
    const line = overlay.axisLines.get(axis.id);
    const disc = overlay.axisDiscs.get(axis.id);
    const label = overlay.axisLabels.get(axis.id);
    if (!group || !line || !disc || !label) continue;
    const length = lineLength * axis.scale;
    const endX = center + axis.x * length;
    const endY = center + axis.y * length;
    line.setAttribute('x2', formatSvgNumber(endX));
    line.setAttribute('y2', formatSvgNumber(endY));
    line.setAttribute('stroke', axis.color);
    disc.setAttribute('cx', formatSvgNumber(endX));
    disc.setAttribute('cy', formatSvgNumber(endY));
    disc.setAttribute('fill', axis.color);
    label.setAttribute('x', formatSvgNumber(endX));
    label.setAttribute('y', formatSvgNumber(endY));
    label.textContent = axis.label;
    group.style.opacity = String(0.72 + axis.scale * 0.28);
    overlay.lineLayer.appendChild(line);
    overlay.labelLayer.appendChild(group);
  }
  overlay.labelLayer.appendChild(overlay.centerDot);
}

function renderCoordinateAxesProjectionIcon(
  overlay: CoordinateAxesOverlayElements,
  mode: LocalEditorBrowserViewportProjectionMode,
  disabled: boolean,
): void {
  overlay.projectionIcon.dataset.viewportProjectionMode = mode;
  overlay.projectionIcon.setAttribute(
    'aria-label',
    disabled
      ? `编辑视口投影：${VIEWPORT_PROJECTION_LABELS[mode]}，Main Camera 预览中不可切换`
      : `编辑视口投影：${VIEWPORT_PROJECTION_LABELS[mode]}，点击切换`,
  );
  overlay.projectionIcon.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  overlay.projectionIcon.style.opacity = disabled ? '0.46' : '0.92';
  overlay.projectionIcon.style.cursor = disabled ? 'not-allowed' : 'pointer';
  overlay.projectionIconShape.setAttribute(
    'd',
    mode === 'orthographic'
      ? 'M5 6.5H12.5V14H5ZM7.5 4H15V11.5'
      : 'M4.5 14H13.5L10.5 4H7.5ZM7 10.5H11',
  );
}

interface SpatialOverlayElements {
  root: HTMLDivElement;
  svg: SVGSVGElement;
  lineLayer: SVGGElement;
  markerLayer: SVGGElement;
  labelLayer: HTMLDivElement;
  lines: Map<string, SVGLineElement>;
  markers: Map<string, SVGCircleElement>;
  labels: Map<string, HTMLDivElement>;
}

function createSpatialOverlay(doc: Document): SpatialOverlayElements {
  const root = doc.createElement('div');
  root.classList.add(LOCAL_EDITOR_THEME_CLASS);
  root.dataset.editorSpatialOverlay = 'true';
  root.style.cssText = [
    'position:absolute',
    'top:38px',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:1',
    'display:none',
    'pointer-events:none',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'overflow:hidden',
  ].join(';');

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    'overflow:hidden',
  ].join(';');
  const lineLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  const markerLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(lineLayer);
  svg.appendChild(markerLayer);
  root.appendChild(svg);

  const labelLayer = doc.createElement('div');
  labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  root.appendChild(labelLayer);

  return {
    root,
    svg,
    lineLayer,
    markerLayer,
    labelLayer,
    lines: new Map(),
    markers: new Map(),
    labels: new Map(),
  };
}

function renderSpatialOverlay(
  overlay: SpatialOverlayElements,
  state: LocalEditorBrowserViewportSpatialOverlayState | null,
): void {
  if (!state?.active) {
    overlay.root.style.display = 'none';
    clearSpatialOverlayElements(overlay);
    return;
  }
  overlay.root.style.display = '';
  const rect = overlay.root.getBoundingClientRect();
  overlay.svg.setAttribute('width', formatSvgNumber(rect.width));
  overlay.svg.setAttribute('height', formatSvgNumber(rect.height));
  overlay.svg.setAttribute('viewBox', `0 0 ${formatSvgNumber(rect.width)} ${formatSvgNumber(rect.height)}`);

  const visibleLineIds = new Set<string>();
  for (const lineState of state.lines) {
    const line = ensureSpatialOverlayLine(overlay, lineState.id);
    line.setAttribute('x1', formatSvgNumber(lineState.start.x - rect.left));
    line.setAttribute('y1', formatSvgNumber(lineState.start.y - rect.top));
    line.setAttribute('x2', formatSvgNumber(lineState.end.x - rect.left));
    line.setAttribute('y2', formatSvgNumber(lineState.end.y - rect.top));
    visibleLineIds.add(lineState.id);
  }
  for (const [id, line] of overlay.lines) {
    if (!visibleLineIds.has(id)) {
      line.remove();
      overlay.lines.delete(id);
    }
  }

  const visibleMarkerIds = new Set<string>();
  for (const markerState of state.markers) {
    const marker = ensureSpatialOverlayMarker(overlay, markerState.id);
    marker.setAttribute('cx', formatSvgNumber(markerState.position.x - rect.left));
    marker.setAttribute('cy', formatSvgNumber(markerState.position.y - rect.top));
    visibleMarkerIds.add(markerState.id);
  }
  for (const [id, marker] of overlay.markers) {
    if (!visibleMarkerIds.has(id)) {
      marker.remove();
      overlay.markers.delete(id);
    }
  }

  const visibleLabelIds = new Set<string>();
  for (const labelState of state.labels) {
    const label = ensureSpatialOverlayLabel(overlay, labelState.id, labelState.kind);
    label.textContent = labelState.text;
    label.style.left = `${labelState.x - rect.left}px`;
    label.style.top = `${labelState.y - rect.top}px`;
    visibleLabelIds.add(labelState.id);
  }
  for (const [id, label] of overlay.labels) {
    if (!visibleLabelIds.has(id)) {
      label.remove();
      overlay.labels.delete(id);
    }
  }
}

function clearSpatialOverlayElements(overlay: SpatialOverlayElements): void {
  for (const line of overlay.lines.values()) line.remove();
  for (const marker of overlay.markers.values()) marker.remove();
  for (const label of overlay.labels.values()) label.remove();
  overlay.lines.clear();
  overlay.markers.clear();
  overlay.labels.clear();
}

function ensureSpatialOverlayLine(overlay: SpatialOverlayElements, id: string): SVGLineElement {
  const existing = overlay.lines.get(id);
  if (existing) return existing;
  const line = overlay.root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('stroke', 'color-mix(in srgb, var(--fps-editor-drop-target) 82%, white)');
  line.setAttribute('stroke-width', '1.4');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))';
  overlay.lineLayer.appendChild(line);
  overlay.lines.set(id, line);
  return line;
}

function ensureSpatialOverlayMarker(overlay: SpatialOverlayElements, id: string): SVGCircleElement {
  const existing = overlay.markers.get(id);
  if (existing) return existing;
  const marker = overlay.root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('r', '4.5');
  marker.setAttribute('fill', 'var(--fps-editor-drop-target)');
  marker.setAttribute('stroke', 'var(--fps-editor-panel)');
  marker.setAttribute('stroke-width', '2');
  marker.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))';
  overlay.markerLayer.appendChild(marker);
  overlay.markers.set(id, marker);
  return marker;
}

function ensureSpatialOverlayLabel(
  overlay: SpatialOverlayElements,
  id: string,
  kind: LocalEditorBrowserViewportSpatialOverlayState['labels'][number]['kind'],
): HTMLDivElement {
  const existing = overlay.labels.get(id);
  if (existing) return existing;
  const label = overlay.root.ownerDocument.createElement('div');
  label.dataset.editorSpatialOverlayLabel = kind;
  label.style.cssText = [
    'position:absolute',
    'transform:translate(-50%, -50%)',
    'max-width:220px',
    'padding:2px 5px',
    'border:1px solid color-mix(in srgb, var(--fps-editor-border) 82%, transparent)',
    'border-radius:3px',
    'background:color-mix(in srgb, var(--fps-editor-panel) 88%, transparent)',
    'box-shadow:0 1px 4px rgba(0,0,0,0.22)',
    'color:var(--fps-editor-text-strong)',
    'font-size:10px',
    'font-weight:900',
    'line-height:1.25',
    'letter-spacing:0',
    'white-space:nowrap',
  ].join(';');
  if (kind === 'anchor') label.style.color = 'var(--fps-editor-drop-target)';
  overlay.labelLayer.appendChild(label);
  overlay.labels.set(id, label);
  return label;
}

interface MeasurementOverlayElements {
  root: HTMLDivElement;
  svg: SVGSVGElement;
  line: SVGLineElement;
  startMarker: SVGCircleElement;
  endMarker: SVGCircleElement;
  label: HTMLDivElement;
}

function createMeasurementOverlay(doc: Document): MeasurementOverlayElements {
  const root = doc.createElement('div');
  root.classList.add(LOCAL_EDITOR_THEME_CLASS);
  root.dataset.editorMeasurementOverlay = 'true';
  root.style.cssText = [
    'position:absolute',
    'top:38px',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:2',
    'display:none',
    'pointer-events:none',
    'overflow:hidden',
    'font-family:var(--fps-editor-font)',
  ].join(';');
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden';
  const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('stroke', 'var(--fps-editor-drop-target)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  line.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))';
  const startMarker = createMeasurementMarker(doc);
  const endMarker = createMeasurementMarker(doc);
  svg.appendChild(line);
  svg.appendChild(startMarker);
  svg.appendChild(endMarker);
  root.appendChild(svg);
  const label = doc.createElement('div');
  label.dataset.editorMeasurementLabel = 'true';
  label.style.cssText = [
    'position:absolute',
    'transform:translate(-50%, -50%)',
    'padding:3px 6px',
    'border:1px solid color-mix(in srgb, var(--fps-editor-drop-target) 72%, var(--fps-editor-border))',
    'border-radius:3px',
    'background:color-mix(in srgb, var(--fps-editor-panel) 90%, transparent)',
    'box-shadow:0 1px 4px rgba(0,0,0,0.24)',
    'color:var(--fps-editor-text-strong)',
    'font-size:10px',
    'font-weight:900',
    'line-height:1.25',
    'letter-spacing:0',
    'white-space:nowrap',
  ].join(';');
  root.appendChild(label);
  return { root, svg, line, startMarker, endMarker, label };
}

function createMeasurementMarker(doc: Document): SVGCircleElement {
  const marker = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
  marker.setAttribute('r', '4');
  marker.setAttribute('fill', 'var(--fps-editor-drop-target)');
  marker.setAttribute('stroke', 'var(--fps-editor-panel)');
  marker.setAttribute('stroke-width', '2');
  return marker;
}

function renderMeasurementOverlay(
  overlay: MeasurementOverlayElements,
  state: LocalEditorBrowserViewportMeasurementState | null,
): void {
  const start = state?.screenStart ?? null;
  const end = state?.screenEnd ?? state?.screenPreview ?? null;
  if (!start || !end) {
    overlay.root.style.display = 'none';
    return;
  }
  overlay.root.style.display = '';
  const rect = overlay.root.getBoundingClientRect();
  overlay.svg.setAttribute('width', formatSvgNumber(rect.width));
  overlay.svg.setAttribute('height', formatSvgNumber(rect.height));
  overlay.svg.setAttribute('viewBox', `0 0 ${formatSvgNumber(rect.width)} ${formatSvgNumber(rect.height)}`);
  const startX = start.x - rect.left;
  const startY = start.y - rect.top;
  const endX = end.x - rect.left;
  const endY = end.y - rect.top;
  overlay.line.setAttribute('x1', formatSvgNumber(startX));
  overlay.line.setAttribute('y1', formatSvgNumber(startY));
  overlay.line.setAttribute('x2', formatSvgNumber(endX));
  overlay.line.setAttribute('y2', formatSvgNumber(endY));
  overlay.startMarker.setAttribute('cx', formatSvgNumber(startX));
  overlay.startMarker.setAttribute('cy', formatSvgNumber(startY));
  overlay.endMarker.setAttribute('cx', formatSvgNumber(endX));
  overlay.endMarker.setAttribute('cy', formatSvgNumber(endY));
  overlay.label.textContent = state?.label?.text ?? '';
  overlay.label.style.display = state?.label ? '' : 'none';
  if (state?.label) {
    overlay.label.style.left = `${state.label.x - rect.left}px`;
    overlay.label.style.top = `${state.label.y - rect.top}px`;
  }
}

function formatSvgNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0';
}

export function createLocalEditorBrowserUi<TDocument = unknown>(
  options: LocalEditorBrowserUiOptions<TDocument> = {},
): LocalEditorBrowserUi<TDocument> & LocalEditorThemeController {
  const doc = options.document ?? document;
  const root = options.root ?? doc.body;
  const callbacks = options.callbacks ?? {};
  const localTestActionsEnabled = options.localTestActions === true;
  ensureLocalEditorTheme(doc);
  let activeTheme: LocalEditorThemeName = normalizeLocalEditorThemeName(options.theme);
  const inputRouter = createLocalEditorWorkbenchInputRouter(doc, {
    isShortcutReserved: options.input?.isShortcutReserved,
  });
  const contextMenu = createLocalEditorContextMenuController(doc, (open) => {
    inputRouter.setContextMenuOpen(open);
  }, activeTheme);
  const tooltipSurfaces = new Set<HTMLElement>();
  const tooltipController = createLocalEditorTooltipController(doc, root, activeTheme, {
    scope: () => tooltipSurfaces,
  });
  let currentState: LocalEditorBrowserUiState<TDocument> | null = null;
  let inspectorFilter = '';
  const workbenchLayout = createDefaultLocalEditorWorkbenchLayout();
  const panelRegistry = createLocalEditorPanelRegistry(workbenchLayout);

  const hostChrome = doc.createElement('div');
  hostChrome.dataset.editorWorkbenchRegion = 'top-bar';
  hostChrome.className = LOCAL_EDITOR_THEME_CLASS;
  hostChrome.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:2147483640',
    'display:none',
    'align-items:center',
    'gap:8px',
    'height:34px',
    'padding:0 8px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-chrome)',
    'box-shadow:var(--fps-editor-shadow-panel)',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'pointer-events:auto',
  ].join(';');
  const hostModeLabel = doc.createElement('span');
  hostModeLabel.textContent = '本地宿主 · 游戏模式';
  hostModeLabel.style.cssText = [
    'color:var(--fps-editor-muted-strong)',
    'font-weight:800',
    'white-space:nowrap',
  ].join(';');
  const enterEditorButton = LocalEditorShared.createButton(doc, '进入编辑场景', { icon: 'execute' });
  hostChrome.appendChild(hostModeLabel);
  hostChrome.appendChild(enterEditorButton);
  root.appendChild(hostChrome);
  tooltipSurfaces.add(hostChrome);

  const dirtyBadge = doc.createElement('span');
  dirtyBadge.dataset.editorDirtyBadge = 'true';
  dirtyBadge.dataset.editorTooltip = '有未保存更改';
  dirtyBadge.setAttribute('role', 'status');
  dirtyBadge.setAttribute('aria-label', '有未保存更改');
  dirtyBadge.style.cssText = [
    'display:none',
    'width:8px',
    'height:8px',
    'align-items:center',
    'justify-content:center',
    'padding:0',
    'border-radius:999px',
    'background:var(--fps-editor-danger-strong)',
    'border:1px solid var(--fps-editor-danger-border)',
    'box-shadow:0 0 0 3px var(--fps-editor-danger-soft)',
  ].join(';');

  const saveButton = LocalEditorShared.createButton(doc, '保存场景', { icon: 'save' });
  const saveAndRunButton = LocalEditorShared.createButton(doc, '保存并运行', { icon: 'execute' });
  const discardRunButton = LocalEditorShared.createButton(doc, '放弃并运行', { icon: 'discard' });
  const localTestButton = createToolbarIconButton(doc, '本地测试', 'execute', '打开本地测试操作');
  localTestButton.dataset.editorLocalTestToggle = 'true';
  const localTestMenu = doc.createElement('div');
  localTestMenu.classList.add(LOCAL_EDITOR_THEME_CLASS);
  localTestMenu.dataset.editorLocalTestMenu = 'true';
  localTestMenu.style.cssText = [
    'position:fixed',
    'z-index:2147483641',
    'display:none',
    'flex-direction:column',
    'gap:6px',
    'min-width:150px',
    'padding:8px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'pointer-events:auto',
  ].join(';');
  for (const button of [saveButton, saveAndRunButton, discardRunButton]) {
    button.style.justifyContent = 'flex-start';
    button.style.width = '100%';
    localTestMenu.appendChild(button);
  }
  const localTestGroup = doc.createElement('div');
  localTestGroup.style.cssText = [
    `display:${localTestActionsEnabled ? 'flex' : 'none'}`,
    'align-items:center',
    'gap:4px',
  ].join(';');
  localTestGroup.appendChild(localTestButton);
  const undoButton = createToolbarIconButton(doc, '撤销', 'undo', '撤销');
  const redoButton = createToolbarIconButton(doc, '重做', 'redo', '重做');
  let helpOpen = false;

  const editorStatusButton = createToolbarIconButton(doc, '编辑器状态', 'status', '编辑器状态');
  editorStatusButton.dataset.editorStatusButton = 'true';
  editorStatusButton.style.cursor = 'help';

  const workbench = createLocalEditorWorkbench(doc);
  const hierarchyPanel = createWorkbenchPanelContent(doc);
  const assetPanel = workbench.bottomDock;
  const inspectorPanel = createWorkbenchPanelContent(doc);
  workbench.leftDock.appendChild(hierarchyPanel);
  workbench.rightDock.appendChild(inspectorPanel);
  root.appendChild(workbench.root);
  tooltipSurfaces.add(workbench.root);
  const workbenchLayoutController = createLocalEditorWorkbenchLayoutController(doc, workbench);

  const sceneToolOverlay = createSceneHeaderToolbar(doc);
  const sceneTitle = doc.createElement('div');
  sceneTitle.textContent = 'Preview';
  sceneTitle.style.cssText = [
    'height:100%',
    'display:flex',
    'align-items:center',
    'padding:0 10px 0 2px',
    'margin-right:2px',
    'border-right:1px solid var(--fps-editor-divider)',
    'color:var(--fps-editor-text-strong)',
    'font-size:13px',
    'font-weight:800',
    'white-space:nowrap',
  ].join(';');
  const sceneQuickActions = doc.createElement('div');
  sceneQuickActions.style.cssText = 'display:flex;align-items:center;gap:4px';
  const sceneUtilityActions = doc.createElement('div');
  sceneUtilityActions.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const toolGroup = doc.createElement('div');
  toolGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const toolButtons = new Map<LocalEditorBrowserTransformTool, HTMLButtonElement>();
  const transformToolDescriptors = Object.values(
    DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS,
  ) as LocalEditorBrowserTransformToolDescriptor[];
  for (const descriptor of transformToolDescriptors) {
    const tooltip = createTransformToolTooltip(descriptor);
    const button = LocalEditorShared.createButton(doc, descriptor.label, {
      icon: TRANSFORM_TOOL_ICONS[descriptor.tool],
      labelMode: 'icon-only',
      variant: 'toolbar-icon',
      tooltip,
      ariaLabel: tooltip,
    });
    button.dataset.transformTool = descriptor.tool;
    toolButtons.set(descriptor.tool, button);
    toolGroup.appendChild(button);
  }
  const spaceGroup = doc.createElement('div');
  spaceGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const spaceButtons = {
    world: createToolbarIconButton(doc, '世界', TRANSFORM_SPACE_ICONS.world, '世界坐标空间'),
    local: createToolbarIconButton(doc, '本地', TRANSFORM_SPACE_ICONS.local, '本地坐标空间'),
  } satisfies Record<LocalEditorBrowserTransformSpace, HTMLButtonElement>;
  for (const [space, button] of Object.entries(spaceButtons) as Array<[LocalEditorBrowserTransformSpace, HTMLButtonElement]>) {
    button.dataset.transformSpace = space;
    spaceGroup.appendChild(button);
  }
  const snapGroup = doc.createElement('div');
  snapGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const snapButton = createToolbarIconButton(doc, '吸附设置', 'snap', '吸附设置', 'settings');
  snapButton.dataset.transformSnapToggle = 'true';
  const snapSettingsPopover = doc.createElement('div');
  snapSettingsPopover.classList.add(LOCAL_EDITOR_THEME_CLASS);
  snapSettingsPopover.dataset.transformSnapSettingsPopover = 'true';
  snapSettingsPopover.setAttribute('role', 'dialog');
  snapSettingsPopover.setAttribute('aria-label', '吸附设置');
  snapSettingsPopover.style.cssText = [
    'position:fixed',
    'z-index:2147483641',
    'display:none',
    'flex-direction:column',
    'gap:8px',
    'width:220px',
    'padding:10px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'pointer-events:auto',
  ].join(';');
  const snapSettingsHeader = doc.createElement('label');
  snapSettingsHeader.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'font-weight:900',
  ].join(';');
  const snapSettingsHeaderText = doc.createElement('span');
  snapSettingsHeaderText.textContent = '启用吸附';
  const snapEnabledInput = doc.createElement('input');
  snapEnabledInput.type = 'checkbox';
  snapEnabledInput.dataset.transformSnapEnabled = 'true';
  snapSettingsHeader.appendChild(snapSettingsHeaderText);
  snapSettingsHeader.appendChild(snapEnabledInput);
  snapSettingsPopover.appendChild(snapSettingsHeader);
  const snapStepInputs = new Map<LocalEditorBrowserTransformSnapStepKind, HTMLInputElement>();
  for (const [kind, label, unit] of [
    ['move', '位移', '单位'],
    ['rotate', '旋转', '度'],
    ['scale', '缩放', '倍数'],
  ] as Array<[LocalEditorBrowserTransformSnapStepKind, string, string]>) {
    const row = doc.createElement('label');
    row.style.cssText = [
      'display:grid',
      'grid-template-columns:54px 1fr 34px',
      'align-items:center',
      'gap:8px',
      'color:var(--fps-editor-muted-strong)',
      'font-size:11px',
      'font-weight:800',
    ].join(';');
    const rowLabel = doc.createElement('span');
    rowLabel.textContent = label;
    const input = doc.createElement('input');
    input.type = 'number';
    input.min = '0.0001';
    input.step = kind === 'rotate' ? '1' : '0.1';
    input.dataset.transformSnapStep = kind;
    input.style.cssText = [
      'height:26px',
      'min-width:0',
      'box-sizing:border-box',
      'border:1px solid var(--fps-editor-border)',
      'border-radius:3px',
      'background:var(--fps-editor-field)',
      'color:var(--fps-editor-text)',
      'font-size:11px',
      'font-weight:800',
      'padding:0 4px',
    ].join(';');
    const rowUnit = doc.createElement('span');
    rowUnit.textContent = unit;
    rowUnit.style.cssText = 'color:var(--fps-editor-muted);font-size:10px;font-weight:800';
    row.appendChild(rowLabel);
    row.appendChild(input);
    row.appendChild(rowUnit);
    snapSettingsPopover.appendChild(row);
    snapStepInputs.set(kind, input);
  }
  snapGroup.appendChild(snapButton);
  const placementGroup = doc.createElement('div');
  placementGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const placementButton = createToolbarIconButton(doc, '放置模式', PLACEMENT_MODE_ICONS.off, '放置模式', 'settings');
  placementButton.dataset.placementModeToggle = 'true';
  const placementSettingsPopover = doc.createElement('div');
  placementSettingsPopover.classList.add(LOCAL_EDITOR_THEME_CLASS);
  placementSettingsPopover.dataset.placementSettingsPopover = 'true';
  placementSettingsPopover.setAttribute('role', 'dialog');
  placementSettingsPopover.setAttribute('aria-label', '放置模式');
  placementSettingsPopover.style.cssText = [
    'position:fixed',
    'z-index:2147483641',
    'display:none',
    'flex-direction:column',
    'gap:5px',
    'width:180px',
    'padding:8px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'pointer-events:auto',
  ].join(';');
  const placementButtons = Object.fromEntries(
    (Object.keys(PLACEMENT_MODE_ICONS) as LocalEditorBrowserPlacementMode[]).map((mode) => {
      const button = LocalEditorShared.createButton(doc, PLACEMENT_MODE_DESCRIPTIONS[mode], {
        icon: PLACEMENT_MODE_ICONS[mode],
        tooltip: PLACEMENT_MODE_DESCRIPTIONS[mode],
        ariaLabel: PLACEMENT_MODE_DESCRIPTIONS[mode],
      });
      button.dataset.placementMode = mode;
      button.style.justifyContent = 'flex-start';
      button.style.width = '100%';
      placementSettingsPopover.appendChild(button);
      return [mode, button];
    }),
  ) as Record<LocalEditorBrowserPlacementMode, HTMLButtonElement>;
  placementGroup.appendChild(placementButton);
  const actionGroup = doc.createElement('div');
  actionGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const transformActionButton = createToolbarIconButton(doc, '对齐与分布', 'arrange', '对齐与分布', 'settings');
  transformActionButton.dataset.transformActionToggle = 'true';
  const transformActionPopover = doc.createElement('div');
  transformActionPopover.classList.add(LOCAL_EDITOR_THEME_CLASS);
  transformActionPopover.dataset.transformActionPopover = 'true';
  transformActionPopover.setAttribute('role', 'dialog');
  transformActionPopover.setAttribute('aria-label', '对齐与分布');
  transformActionPopover.style.cssText = [
    'position:fixed',
    'z-index:2147483641',
    'display:none',
    'flex-direction:column',
    'gap:9px',
    'width:236px',
    'padding:10px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'pointer-events:auto',
  ].join(';');
  const transformActionButtons = new Map<LocalEditorBrowserTransformAction, HTMLButtonElement>();
  for (const group of TRANSFORM_ACTION_GROUPS) {
    const section = doc.createElement('section');
    section.style.cssText = 'display:flex;flex-direction:column;gap:5px';
    const heading = doc.createElement('div');
    heading.textContent = group.title;
    heading.style.cssText = [
      'color:var(--fps-editor-text-strong)',
      'font-size:11px',
      'font-weight:900',
    ].join(';');
    const hint = doc.createElement('div');
    hint.textContent = group.hint;
    hint.style.cssText = [
      'color:var(--fps-editor-muted)',
      'font-size:10px',
      'font-weight:700',
      'margin-top:-3px',
    ].join(';');
    section.appendChild(heading);
    section.appendChild(hint);
    for (const action of group.actions) {
      const button = LocalEditorShared.createButton(doc, TRANSFORM_ACTION_LABELS[action], {
        icon: 'arrange',
        tooltip: TRANSFORM_ACTION_LABELS[action],
        ariaLabel: TRANSFORM_ACTION_LABELS[action],
      });
      button.dataset.transformAction = action;
      button.style.justifyContent = 'flex-start';
      button.style.width = '100%';
      transformActionButtons.set(action, button);
      section.appendChild(button);
    }
    transformActionPopover.appendChild(section);
  }
  actionGroup.appendChild(transformActionButton);
  const themeToggleButton = createToolbarIconButton(doc, '主题', 'theme', '切换主题');
  themeToggleButton.dataset.editorThemeToggle = 'true';
  const gridToggleButton = createToolbarIconButton(doc, '网格', 'grid', '显示 / 隐藏 Scene View 网格');
  gridToggleButton.dataset.editorGridToggle = 'true';
  const sceneHelpButton = createToolbarIconButton(doc, '快捷键', 'help', '快捷键与操作说明');
  sceneQuickActions.appendChild(localTestGroup);
  sceneQuickActions.appendChild(undoButton);
  sceneQuickActions.appendChild(redoButton);
  sceneQuickActions.appendChild(dirtyBadge);
  sceneUtilityActions.appendChild(gridToggleButton);
  sceneUtilityActions.appendChild(themeToggleButton);
  sceneUtilityActions.appendChild(sceneHelpButton);
  const mainCameraPreviewGroup = doc.createElement('div');
  mainCameraPreviewGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const mainCameraPreviewButton = createToolbarIconButton(doc, '从 Main Camera 查看场景', 'camera');
  mainCameraPreviewButton.dataset.mainCameraPreviewToggle = 'true';
  mainCameraPreviewGroup.appendChild(mainCameraPreviewButton);
  const viewportToolsGroup = doc.createElement('div');
  viewportToolsGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const viewportPresetButtons = new Map<LocalEditorBrowserViewportViewPreset, HTMLButtonElement>();
  for (const preset of ['perspective', 'top', 'front', 'right'] as LocalEditorBrowserViewportViewPreset[]) {
    const button = createToolbarIconButton(doc, VIEW_PRESET_TOOLTIPS[preset], VIEW_PRESET_ICONS[preset], VIEW_PRESET_TOOLTIPS[preset]);
    button.dataset.viewportViewPreset = preset;
    viewportPresetButtons.set(preset, button);
    viewportToolsGroup.appendChild(button);
  }
  const projectionToggleButton = createToolbarIconButton(doc, '投影模式', 'projection-perspective', '切换投影模式');
  projectionToggleButton.dataset.viewportProjectionToggle = 'true';
  viewportToolsGroup.appendChild(projectionToggleButton);
  const overlaySettingsButton = createToolbarIconButton(doc, '视口信息层设置', 'view-overlay', '视口信息层设置', 'settings');
  overlaySettingsButton.dataset.viewportOverlaySettingsToggle = 'true';
  viewportToolsGroup.appendChild(overlaySettingsButton);
  const measureButton = createToolbarIconButton(doc, '测量距离', 'measure', '测量 XZ 地面距离', 'toggle');
  measureButton.dataset.viewportMeasureToggle = 'true';
  viewportToolsGroup.appendChild(measureButton);
  const clearMeasurementButton = createToolbarIconButton(doc, '清除测量结果', 'discard', '清除测量结果');
  clearMeasurementButton.dataset.viewportMeasurementClear = 'true';
  viewportToolsGroup.appendChild(clearMeasurementButton);
  const overlaySettingsPopover = doc.createElement('div');
  overlaySettingsPopover.classList.add(LOCAL_EDITOR_THEME_CLASS);
  overlaySettingsPopover.dataset.viewportOverlaySettingsPopover = 'true';
  overlaySettingsPopover.setAttribute('role', 'dialog');
  overlaySettingsPopover.setAttribute('aria-label', '视口信息层设置');
  overlaySettingsPopover.style.cssText = [
    'position:fixed',
    'z-index:2147483641',
    'display:none',
    'flex-direction:column',
    'gap:7px',
    'width:190px',
    'padding:8px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'pointer-events:auto',
  ].join(';');
  const overlayInputs = new Map<keyof typeof VIEWPORT_OVERLAY_TOGGLE_LABELS, HTMLInputElement>();
  for (const key of Object.keys(VIEWPORT_OVERLAY_TOGGLE_LABELS) as Array<keyof typeof VIEWPORT_OVERLAY_TOGGLE_LABELS>) {
    const row = doc.createElement('label');
    row.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:10px',
      'color:var(--fps-editor-text)',
      'font-size:11px',
      'font-weight:800',
    ].join(';');
    const text = doc.createElement('span');
    text.textContent = VIEWPORT_OVERLAY_TOGGLE_LABELS[key];
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.dataset.viewportOverlaySetting = key;
    row.appendChild(text);
    row.appendChild(input);
    overlaySettingsPopover.appendChild(row);
    overlayInputs.set(key, input);
  }
  const toolbarOverflowButton = createToolbarIconButton(doc, '更多', 'chevron-down', '显示隐藏的工具栏命令');
  toolbarOverflowButton.dataset.editorToolbarOverflowToggle = 'true';
  toolbarOverflowButton.style.display = 'none';
  const toolbarOverflowMenu = doc.createElement('div');
  toolbarOverflowMenu.classList.add(LOCAL_EDITOR_THEME_CLASS);
  toolbarOverflowMenu.dataset.editorToolbarOverflowMenu = 'true';
  toolbarOverflowMenu.style.cssText = [
    'position:fixed',
    'z-index:2147483641',
    'display:none',
    'flex-direction:column',
    'gap:6px',
    'min-width:220px',
    'max-width:min(420px, calc(100vw - 16px))',
    'max-height:calc(100vh - 72px)',
    'overflow:auto',
    'padding:8px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'pointer-events:auto',
  ].join(';');
  const coordinateAxesOverlay = createCoordinateAxesOverlay(doc);
  const sceneFrameRateOverlay = createSceneFrameRateOverlay(doc);
  const spatialOverlay = createSpatialOverlay(doc);
  const measurementOverlay = createMeasurementOverlay(doc);
  sceneToolOverlay.appendChild(sceneTitle);
  sceneToolOverlay.appendChild(sceneQuickActions);
  sceneToolOverlay.appendChild(toolGroup);
  sceneToolOverlay.appendChild(spaceGroup);
  sceneToolOverlay.appendChild(snapGroup);
  sceneToolOverlay.appendChild(placementGroup);
  sceneToolOverlay.appendChild(actionGroup);
  sceneToolOverlay.appendChild(viewportToolsGroup);
  sceneToolOverlay.appendChild(sceneUtilityActions);
  sceneToolOverlay.appendChild(mainCameraPreviewGroup);
  sceneToolOverlay.appendChild(editorStatusButton);
  sceneToolOverlay.appendChild(toolbarOverflowButton);
  workbench.sceneHeader.appendChild(sceneToolOverlay);
  workbench.sceneFrame.appendChild(spatialOverlay.root);
  workbench.sceneFrame.appendChild(measurementOverlay.root);
  workbench.sceneFrame.appendChild(sceneFrameRateOverlay.root);
  workbench.sceneFrame.appendChild(coordinateAxesOverlay.root);
  root.appendChild(localTestMenu);
  root.appendChild(toolbarOverflowMenu);
  root.appendChild(snapSettingsPopover);
  root.appendChild(placementSettingsPopover);
  root.appendChild(transformActionPopover);
  root.appendChild(overlaySettingsPopover);
  tooltipSurfaces.add(localTestMenu);
  tooltipSurfaces.add(toolbarOverflowMenu);
  tooltipSurfaces.add(snapSettingsPopover);
  tooltipSurfaces.add(placementSettingsPopover);
  tooltipSurfaces.add(transformActionPopover);
  tooltipSurfaces.add(overlaySettingsPopover);

  const boxSelectionOverlay = doc.createElement('div');
  boxSelectionOverlay.classList.add(LOCAL_EDITOR_THEME_CLASS);
  boxSelectionOverlay.style.cssText = [
    'position:fixed',
    'z-index:2147483637',
    'display:none',
    'border:1px solid var(--fps-editor-drop-target)',
    'background:var(--fps-editor-box-select-bg)',
    'box-shadow:var(--fps-editor-box-select-shadow)',
    'pointer-events:none',
  ].join(';');
  root.appendChild(boxSelectionOverlay);
  tooltipSurfaces.add(boxSelectionOverlay);

  const shortcutHelpPanel = createLocalEditorShortcutHelpPanel(doc);
  shortcutHelpPanel.classList.add(LOCAL_EDITOR_THEME_CLASS);
  root.appendChild(shortcutHelpPanel);
  tooltipSurfaces.add(shortcutHelpPanel);

  function applyThemeToSurfaces(): void {
    applyLocalEditorTheme(hostChrome, activeTheme);
    applyLocalEditorTheme(workbench.root, activeTheme);
    applyLocalEditorTheme(spatialOverlay.root, activeTheme);
    applyLocalEditorTheme(measurementOverlay.root, activeTheme);
    applyLocalEditorTheme(sceneFrameRateOverlay.root, activeTheme);
    applyLocalEditorTheme(shortcutHelpPanel, activeTheme);
    applyLocalEditorTheme(boxSelectionOverlay, activeTheme);
    applyLocalEditorTheme(localTestMenu, activeTheme);
    applyLocalEditorTheme(toolbarOverflowMenu, activeTheme);
    applyLocalEditorTheme(snapSettingsPopover, activeTheme);
    applyLocalEditorTheme(placementSettingsPopover, activeTheme);
    applyLocalEditorTheme(transformActionPopover, activeTheme);
    applyLocalEditorTheme(overlaySettingsPopover, activeTheme);
    tooltipController.setTheme(activeTheme);
    contextMenu.setTheme?.(activeTheme);
  }

  function updateThemeToggleButton(): void {
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    themeToggleButton.dataset.editorTheme = activeTheme;
    themeToggleButton.setAttribute('aria-pressed', activeTheme === 'light' ? 'true' : 'false');
    setToolbarButtonTooltip(themeToggleButton, nextTheme === 'light' ? '切换为浅色主题' : '切换为深色主题');
  }

  function setActiveTheme(theme: unknown): void {
    activeTheme = normalizeLocalEditorThemeName(theme);
    applyThemeToSurfaces();
    updateThemeToggleButton();
  }

  let localTestMenuOpen = false;
  let snapSettingsOpen = false;
  let placementSettingsOpen = false;
  let transformActionOpen = false;
  let overlaySettingsOpen = false;

  function closeLocalTestMenu(): void {
    localTestMenuOpen = false;
    localTestMenu.style.display = 'none';
    LocalEditorShared.applyButtonActiveState(localTestButton, false);
  }

  function closeSnapSettingsPopover(): void {
    snapSettingsOpen = false;
    snapSettingsPopover.style.display = 'none';
    snapButton.setAttribute('aria-expanded', 'false');
    const enabled = currentState?.transformOperations?.settings.snap.enabled
      ?? DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS.snap.enabled;
    LocalEditorShared.applyButtonActiveState(snapButton, enabled);
  }

  function closePlacementSettingsPopover(): void {
    placementSettingsOpen = false;
    placementSettingsPopover.style.display = 'none';
    placementButton.setAttribute('aria-expanded', 'false');
    const mode = currentState?.transformOperations?.settings.placementMode
      ?? DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS.placementMode;
    LocalEditorShared.applyButtonActiveState(placementButton, mode !== 'off');
  }

  function closeTransformActionPopover(): void {
    transformActionOpen = false;
    transformActionPopover.style.display = 'none';
    transformActionButton.setAttribute('aria-expanded', 'false');
    LocalEditorShared.applyButtonActiveState(transformActionButton, false);
  }

  function closeOverlaySettingsPopover(): void {
    overlaySettingsOpen = false;
    overlaySettingsPopover.style.display = 'none';
    overlaySettingsButton.setAttribute('aria-expanded', 'false');
    LocalEditorShared.applyButtonActiveState(overlaySettingsButton, false);
  }

  function openLocalTestMenu(): void {
    if (!localTestActionsEnabled || localTestButton.style.display === 'none') return;
    closeToolbarOverflowMenu();
    closeSnapSettingsPopover();
    closePlacementSettingsPopover();
    closeTransformActionPopover();
    closeOverlaySettingsPopover();
    closeOverlaySettingsPopover();
    const win = doc.defaultView;
    const rect = localTestButton.getBoundingClientRect();
    const viewportWidth = win?.innerWidth ?? doc.documentElement.clientWidth;
    localTestMenu.style.top = `${Math.max(8, rect.bottom + 5)}px`;
    localTestMenu.style.right = `${Math.max(8, viewportWidth - rect.right)}px`;
    localTestMenu.style.display = 'flex';
    localTestMenuOpen = true;
    LocalEditorShared.applyButtonActiveState(localTestButton, true);
  }

  function openSnapSettingsPopover(): void {
    if (snapButton.disabled || snapGroup.style.display === 'none') return;
    closeToolbarOverflowMenu();
    closeLocalTestMenu();
    closePlacementSettingsPopover();
    closeTransformActionPopover();
    closeOverlaySettingsPopover();
    const win = doc.defaultView;
    const rect = snapButton.getBoundingClientRect();
    const viewportWidth = win?.innerWidth ?? doc.documentElement.clientWidth;
    snapSettingsPopover.style.display = 'flex';
    const popoverWidth = snapSettingsPopover.offsetWidth || 220;
    snapSettingsPopover.style.top = `${Math.max(8, rect.bottom + 5)}px`;
    snapSettingsPopover.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - popoverWidth - 8))}px`;
    snapSettingsOpen = true;
    snapButton.setAttribute('aria-expanded', 'true');
    LocalEditorShared.applyButtonActiveState(snapButton, true);
  }

  function toggleSnapSettingsPopover(): void {
    if (snapSettingsOpen) closeSnapSettingsPopover();
    else openSnapSettingsPopover();
  }

  function openPlacementSettingsPopover(): void {
    if (placementButton.disabled || placementGroup.style.display === 'none') return;
    closeToolbarOverflowMenu();
    closeLocalTestMenu();
    closeSnapSettingsPopover();
    closeTransformActionPopover();
    closeOverlaySettingsPopover();
    const win = doc.defaultView;
    const rect = placementButton.getBoundingClientRect();
    const viewportWidth = win?.innerWidth ?? doc.documentElement.clientWidth;
    placementSettingsPopover.style.display = 'flex';
    const popoverWidth = placementSettingsPopover.offsetWidth || 180;
    placementSettingsPopover.style.top = `${Math.max(8, rect.bottom + 5)}px`;
    placementSettingsPopover.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - popoverWidth - 8))}px`;
    placementSettingsOpen = true;
    placementButton.setAttribute('aria-expanded', 'true');
    LocalEditorShared.applyButtonActiveState(placementButton, true);
  }

  function togglePlacementSettingsPopover(): void {
    if (placementSettingsOpen) closePlacementSettingsPopover();
    else openPlacementSettingsPopover();
  }

  function openTransformActionPopover(): void {
    if (transformActionButton.disabled || actionGroup.style.display === 'none') return;
    closeToolbarOverflowMenu();
    closeLocalTestMenu();
    closeSnapSettingsPopover();
    closePlacementSettingsPopover();
    closeOverlaySettingsPopover();
    const win = doc.defaultView;
    const rect = transformActionButton.getBoundingClientRect();
    const viewportWidth = win?.innerWidth ?? doc.documentElement.clientWidth;
    transformActionPopover.style.display = 'flex';
    const popoverWidth = transformActionPopover.offsetWidth || 236;
    transformActionPopover.style.top = `${Math.max(8, rect.bottom + 5)}px`;
    transformActionPopover.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - popoverWidth - 8))}px`;
    transformActionOpen = true;
    transformActionButton.setAttribute('aria-expanded', 'true');
    LocalEditorShared.applyButtonActiveState(transformActionButton, true);
  }

  function toggleTransformActionPopover(): void {
    if (transformActionOpen) closeTransformActionPopover();
    else openTransformActionPopover();
  }

  function openOverlaySettingsPopover(): void {
    if (overlaySettingsButton.disabled || viewportToolsGroup.style.display === 'none') return;
    const win = doc.defaultView;
    const rect = overlaySettingsButton.getBoundingClientRect();
    const viewportWidth = win?.innerWidth ?? doc.documentElement.clientWidth;
    closeLocalTestMenu();
    closeSnapSettingsPopover();
    closePlacementSettingsPopover();
    closeTransformActionPopover();
    closeToolbarOverflowMenu();
    overlaySettingsPopover.style.display = 'flex';
    const popoverWidth = overlaySettingsPopover.offsetWidth || 190;
    overlaySettingsPopover.style.top = `${Math.max(8, rect.bottom + 5)}px`;
    overlaySettingsPopover.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - popoverWidth - 8))}px`;
    overlaySettingsOpen = true;
    overlaySettingsButton.setAttribute('aria-expanded', 'true');
    LocalEditorShared.applyButtonActiveState(overlaySettingsButton, true);
  }

  function toggleOverlaySettingsPopover(): void {
    if (overlaySettingsOpen) closeOverlaySettingsPopover();
    else openOverlaySettingsPopover();
  }

  const onLocalTestButtonClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (localTestMenuOpen) closeLocalTestMenu();
    else openLocalTestMenu();
  };

  type ToolbarOverflowItemKind = 'group' | 'text';
  interface ToolbarOverflowItem {
    id: string;
    element: HTMLElement;
    kind: ToolbarOverflowItemKind;
  }

  type ToolbarOverflowStyleProperty =
    | 'alignSelf'
    | 'borderLeft'
    | 'display'
    | 'flex'
    | 'height'
    | 'maxWidth'
    | 'minHeight'
    | 'minWidth'
    | 'overflow'
    | 'paddingLeft'
    | 'textOverflow'
    | 'whiteSpace'
    | 'width';

  const toolbarOverflowStyleProperties: ToolbarOverflowStyleProperty[] = [
    'alignSelf',
    'borderLeft',
    'display',
    'flex',
    'height',
    'maxWidth',
    'minHeight',
    'minWidth',
    'overflow',
    'paddingLeft',
    'textOverflow',
    'whiteSpace',
    'width',
  ];
  const toolbarButtonOriginalPadding = new WeakMap<HTMLButtonElement, string>();
  const toolbarOverflowOriginalStyles = new WeakMap<HTMLElement, Partial<Record<ToolbarOverflowStyleProperty, string>>>();
  const toolbarOrder: HTMLElement[] = [
    sceneTitle,
    sceneQuickActions,
    toolGroup,
    spaceGroup,
    snapGroup,
    placementGroup,
    actionGroup,
    viewportToolsGroup,
    sceneUtilityActions,
    mainCameraPreviewGroup,
    editorStatusButton,
    toolbarOverflowButton,
  ];
  const toolbarOverflowItems: ToolbarOverflowItem[] = [
    { id: 'editor-status', element: editorStatusButton, kind: 'group' },
    { id: 'scene-utilities', element: sceneUtilityActions, kind: 'group' },
    { id: 'main-camera-preview', element: mainCameraPreviewGroup, kind: 'group' },
    { id: 'viewport-tools', element: viewportToolsGroup, kind: 'group' },
    { id: 'transform-actions', element: actionGroup, kind: 'group' },
    { id: 'placement', element: placementGroup, kind: 'group' },
    { id: 'snap', element: snapGroup, kind: 'group' },
    { id: 'space', element: spaceGroup, kind: 'group' },
  ];
  let toolbarOverflowOpen = false;
  let toolbarOverflowRaf: number | null = null;

  function restoreToolbarOverflowItemStyle(item: ToolbarOverflowItem): void {
    const original = toolbarOverflowOriginalStyles.get(item.element);
    if (!original) return;
    for (const property of toolbarOverflowStyleProperties) {
      item.element.style[property] = original[property] ?? '';
    }
    toolbarOverflowOriginalStyles.delete(item.element);
    item.element.dataset.editorToolbarOverflowPlacement = 'toolbar';
  }

  function applyToolbarOverflowMenuStyle(item: ToolbarOverflowItem): void {
    if (!toolbarOverflowOriginalStyles.has(item.element)) {
      const original: Partial<Record<ToolbarOverflowStyleProperty, string>> = {};
      for (const property of toolbarOverflowStyleProperties) {
        original[property] = item.element.style[property];
      }
      toolbarOverflowOriginalStyles.set(item.element, original);
    }
    item.element.dataset.editorToolbarOverflowPlacement = 'menu';
    item.element.style.alignSelf = 'stretch';
    item.element.style.borderLeft = '0';
    item.element.style.display = item.kind === 'group' ? 'flex' : 'block';
    item.element.style.flex = '0 0 auto';
    item.element.style.height = '';
    item.element.style.maxWidth = 'none';
    item.element.style.minHeight = '0';
    item.element.style.minWidth = '0';
    item.element.style.overflow = item.kind === 'group' ? 'visible' : 'hidden';
    item.element.style.paddingLeft = '0';
    item.element.style.textOverflow = item.kind === 'text' ? 'ellipsis' : '';
    item.element.style.whiteSpace = item.kind === 'text' ? 'nowrap' : '';
    item.element.style.width = '100%';
  }

  function setToolbarButtonCompact(button: HTMLButtonElement, compact: boolean): void {
    if (button.dataset.editorButtonLabelMode === 'icon-only') return;
    const label = button.querySelector<HTMLElement>('[data-editor-button-label]');
    if (!label) return;
    if (!toolbarButtonOriginalPadding.has(button)) {
      toolbarButtonOriginalPadding.set(button, button.style.padding);
    }
    const accessibleLabel = button.dataset.editorToolbarLabel || label.textContent || button.title;
    button.dataset.editorToolbarLabel = accessibleLabel;
    button.setAttribute('aria-label', accessibleLabel);
    if (!button.title) button.title = accessibleLabel;
    button.style.padding = compact ? '4px 6px' : toolbarButtonOriginalPadding.get(button) ?? '';
    label.style.display = compact ? 'inline-block' : '';
    label.style.width = compact ? '0' : '';
    label.style.maxWidth = compact ? '0' : '';
    label.style.opacity = compact ? '0' : '';
    label.style.marginLeft = compact ? '-5px' : '';
  }

  function setToolbarCompact(compact: boolean): void {
    for (const button of Array.from(sceneToolOverlay.querySelectorAll<HTMLButtonElement>('button'))) {
      setToolbarButtonCompact(button, compact);
    }
  }

  function closeToolbarOverflowMenu(): void {
    toolbarOverflowOpen = false;
    toolbarOverflowMenu.style.display = 'none';
    LocalEditorShared.applyButtonActiveState(toolbarOverflowButton, false);
  }

  function openToolbarOverflowMenu(): void {
    if (toolbarOverflowMenu.childElementCount === 0) return;
    closeLocalTestMenu();
    closeSnapSettingsPopover();
    closePlacementSettingsPopover();
    closeTransformActionPopover();
    closeOverlaySettingsPopover();
    const win = doc.defaultView;
    const rect = toolbarOverflowButton.getBoundingClientRect();
    const viewportWidth = win?.innerWidth ?? doc.documentElement.clientWidth;
    toolbarOverflowMenu.style.top = `${Math.max(8, rect.bottom + 5)}px`;
    toolbarOverflowMenu.style.right = `${Math.max(8, viewportWidth - rect.right)}px`;
    toolbarOverflowMenu.style.display = 'flex';
    toolbarOverflowOpen = true;
    LocalEditorShared.applyButtonActiveState(toolbarOverflowButton, true);
  }

  function resetToolbarOverflowLayout(): void {
    setToolbarCompact(false);
    for (const item of toolbarOverflowItems) restoreToolbarOverflowItemStyle(item);
    for (const item of toolbarOrder) {
      item.dataset.editorToolbarOverflowed = 'false';
      sceneToolOverlay.appendChild(item);
    }
    LocalEditorShared.clearElement(toolbarOverflowMenu);
    toolbarOverflowButton.style.display = 'none';
    sceneToolOverlay.style.overflowX = 'hidden';
    closeToolbarOverflowMenu();
  }

  function layoutToolbarOverflow(): void {
    toolbarOverflowRaf = null;
    resetToolbarOverflowLayout();
    if (sceneToolOverlay.style.display === 'none') return;
    const availableWidth = sceneToolOverlay.clientWidth;
    if (availableWidth <= 0) return;
    const isOverflowing = (): boolean => sceneToolOverlay.scrollWidth > availableWidth + 1;
    if (!isOverflowing()) return;

    toolbarOverflowButton.style.display = 'inline-flex';
    for (const item of toolbarOverflowItems) {
      if (!isOverflowing()) break;
      if (item.element.style.display === 'none') continue;
      item.element.dataset.editorToolbarOverflowed = 'true';
      applyToolbarOverflowMenuStyle(item);
      toolbarOverflowMenu.appendChild(item.element);
    }

    if (toolbarOverflowMenu.childElementCount === 0) {
      toolbarOverflowButton.style.display = 'none';
    }
    if (isOverflowing()) {
      setToolbarCompact(true);
    }
    sceneToolOverlay.style.overflowX = isOverflowing() ? 'auto' : 'hidden';
  }

  function scheduleToolbarOverflowLayout(): void {
    const win = doc.defaultView;
    if (!win) {
      layoutToolbarOverflow();
      return;
    }
    if (toolbarOverflowRaf != null) win.cancelAnimationFrame(toolbarOverflowRaf);
    toolbarOverflowRaf = win.requestAnimationFrame(layoutToolbarOverflow);
  }

  const onToolbarOverflowButtonClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (toolbarOverflowOpen) closeToolbarOverflowMenu();
    else openToolbarOverflowMenu();
  };
  const onToolbarOverflowPointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (target.closest('[data-editor-local-test-menu]') || target.closest('[data-editor-local-test-toggle]')) return;
    if (target.closest('[data-editor-toolbar-overflow-menu]') || target.closest('[data-editor-toolbar-overflow-toggle]')) return;
    if (target.closest('[data-transform-snap-settings-popover]') || target.closest('[data-transform-snap-toggle]')) return;
    if (target.closest('[data-placement-settings-popover]') || target.closest('[data-placement-mode-toggle]')) return;
    if (target.closest('[data-transform-action-popover]') || target.closest('[data-transform-action-toggle]')) return;
    if (target.closest('[data-viewport-overlay-settings-popover]') || target.closest('[data-viewport-overlay-settings-toggle]')) return;
    closeLocalTestMenu();
    closeToolbarOverflowMenu();
    closeSnapSettingsPopover();
    closePlacementSettingsPopover();
    closeTransformActionPopover();
    closeOverlaySettingsPopover();
  };
  const ResizeObserverCtor = doc.defaultView?.ResizeObserver;
  const toolbarResizeObserver = ResizeObserverCtor
    ? new ResizeObserverCtor(() => scheduleToolbarOverflowLayout())
    : null;
  toolbarOverflowButton.addEventListener('click', onToolbarOverflowButtonClick);
  localTestButton.addEventListener('click', onLocalTestButtonClick);
  doc.addEventListener('pointerdown', onToolbarOverflowPointerDown);
  toolbarResizeObserver?.observe(sceneToolOverlay);
  doc.defaultView?.addEventListener('resize', scheduleToolbarOverflowLayout);

  applyThemeToSurfaces();
  updateThemeToggleButton();

  enterEditorButton.addEventListener('click', () => callbacks.onEnterEditor?.());
  saveButton.addEventListener('click', () => {
    closeLocalTestMenu();
    if (localTestActionsEnabled) callbacks.onSaveScene?.();
  });
  saveAndRunButton.addEventListener('click', () => {
    closeLocalTestMenu();
    if (localTestActionsEnabled) callbacks.onSaveAndRunGame?.();
  });
  discardRunButton.addEventListener('click', () => {
    closeLocalTestMenu();
    if (localTestActionsEnabled) callbacks.onDiscardAndRunGame?.();
  });
  undoButton.addEventListener('click', () => callbacks.onUndo?.());
  redoButton.addEventListener('click', () => callbacks.onRedo?.());
  gridToggleButton.addEventListener('click', () => {
    const visible = currentState?.grid?.visible ?? true;
    callbacks.onGridVisibleChange?.(!visible);
  });
  mainCameraPreviewButton.addEventListener('click', () => {
    const enabled = currentState?.mainCameraPreview?.enabled ?? false;
    callbacks.onMainCameraPreviewToggle?.(!enabled);
  });
  const toggleCoordinateAxesProjection = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    const axesState = currentState?.coordinateAxes ?? null;
    if (!axesState || axesState.projectionToggleDisabled || currentState?.busy) return;
    const currentMode = axesState.projectionMode;
    const nextMode: LocalEditorBrowserViewportProjectionMode = currentMode === 'orthographic' ? 'perspective' : 'orthographic';
    callbacks.onViewportProjectionModeChange?.(nextMode);
    if (event.type === 'click') coordinateAxesOverlay.projectionIcon.blur();
  };
  coordinateAxesOverlay.projectionIcon.addEventListener('pointerdown', (event) => {
    event.preventDefault();
  });
  coordinateAxesOverlay.projectionIcon.addEventListener('click', toggleCoordinateAxesProjection);
  coordinateAxesOverlay.projectionIcon.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    toggleCoordinateAxesProjection(event);
  });
  viewportToolsGroup.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const preset = target?.closest<HTMLButtonElement>('[data-viewport-view-preset]')?.dataset.viewportViewPreset as LocalEditorBrowserViewportViewPreset | undefined;
    if (preset) {
      callbacks.onViewportViewPresetChange?.(preset);
      return;
    }
    const projectionToggle = target?.closest<HTMLButtonElement>('[data-viewport-projection-toggle]');
    if (projectionToggle) {
      const currentMode = currentState?.viewportTools?.projectionMode ?? 'perspective';
      const nextMode: LocalEditorBrowserViewportProjectionMode = currentMode === 'orthographic' ? 'perspective' : 'orthographic';
      callbacks.onViewportProjectionModeChange?.(nextMode);
      return;
    }
    const overlayToggle = target?.closest<HTMLButtonElement>('[data-viewport-overlay-settings-toggle]');
    if (overlayToggle) {
      event.stopPropagation();
      toggleOverlaySettingsPopover();
      return;
    }
    const measureToggle = target?.closest<HTMLButtonElement>('[data-viewport-measure-toggle]');
    if (measureToggle) {
      const currentTool = currentState?.viewportTools?.activeUtilityTool ?? 'none';
      const nextTool: LocalEditorBrowserViewportUtilityTool = currentTool === 'measure-distance' ? 'none' : 'measure-distance';
      callbacks.onViewportUtilityToolChange?.(nextTool);
      return;
    }
    const clearMeasurement = target?.closest<HTMLButtonElement>('[data-viewport-measurement-clear]');
    if (clearMeasurement) {
      callbacks.onViewportMeasurementClear?.();
    }
  });
  const setShortcutHelpOpen = (open: boolean): void => {
    if (open) contextMenu.close();
    helpOpen = open;
    inputRouter.setModalOpen(open);
    shortcutHelpPanel.style.display = helpOpen ? '' : 'none';
    LocalEditorShared.applyButtonActiveState(sceneHelpButton, helpOpen);
  };

  sceneHelpButton.addEventListener('click', () => {
    setShortcutHelpOpen(!helpOpen);
  });
  themeToggleButton.addEventListener('click', () => {
    setActiveTheme(activeTheme === 'dark' ? 'light' : 'dark');
  });
  shortcutHelpPanel.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest('[data-editor-shortcut-help-close]')) return;
    setShortcutHelpOpen(false);
  });
  toolGroup.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const tool = target?.closest<HTMLButtonElement>('[data-transform-tool]')?.dataset.transformTool as LocalEditorBrowserTransformTool | undefined;
    if (tool) callbacks.onTransformToolChange?.(tool);
  });
  spaceGroup.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const space = target?.closest<HTMLButtonElement>('[data-transform-space]')?.dataset.transformSpace as LocalEditorBrowserTransformSpace | undefined;
    if (space) callbacks.onTransformSpaceChange?.(space);
  });
  snapButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSnapSettingsPopover();
  });
  snapSettingsPopover.addEventListener('change', (event) => {
    const enabledInput = event.target instanceof HTMLInputElement
      ? event.target.closest<HTMLInputElement>('[data-transform-snap-enabled]')
      : null;
    if (enabledInput) {
      callbacks.onTransformSnapEnabledChange?.(enabledInput.checked);
      return;
    }
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const kind = input?.dataset.transformSnapStep as LocalEditorBrowserTransformSnapStepKind | undefined;
    if (!input || !kind) return;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) {
      const settings = currentState?.transformOperations?.settings ?? DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS;
      input.value = formatSnapStepInputValue(settings.snap, kind);
      return;
    }
    callbacks.onTransformSnapStepChange?.({ kind, value });
  });
  placementGroup.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePlacementSettingsPopover();
  });
  placementSettingsPopover.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const mode = target?.closest<HTMLButtonElement>('[data-placement-mode]')?.dataset.placementMode as LocalEditorBrowserPlacementMode | undefined;
    if (!mode) return;
    callbacks.onPlacementModeChange?.(mode);
    closePlacementSettingsPopover();
  });
  actionGroup.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleTransformActionPopover();
  });
  transformActionPopover.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const action = target?.closest<HTMLButtonElement>('[data-transform-action]')?.dataset.transformAction as LocalEditorBrowserTransformAction | undefined;
    if (!action) return;
    const transformOperations = currentState?.transformOperations;
    if (!transformOperations || !isTransformActionEnabled(action, transformOperations)) return;
    callbacks.onTransformAction?.(action);
    closeTransformActionPopover();
  });
  overlaySettingsPopover.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement
      ? event.target.closest<HTMLInputElement>('[data-viewport-overlay-setting]')
      : null;
    const key = input?.dataset.viewportOverlaySetting as keyof typeof VIEWPORT_OVERLAY_TOGGLE_LABELS | undefined;
    if (!input || !key) return;
    const currentOverlay = currentState?.viewportTools?.overlay;
    callbacks.onViewportOverlaySettingsChange?.({
      bounds: currentOverlay?.bounds ?? false,
      dimensions: currentOverlay?.dimensions ?? false,
      edgeLengths: currentOverlay?.edgeLengths ?? false,
      anchor: currentOverlay?.anchor ?? false,
      [key]: input.checked,
    });
  });
  assetPanel.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const tabButton = target?.closest<HTMLButtonElement>('[data-editor-dock-tab]');
    const tab = tabButton?.dataset.editorDockTab as LocalEditorBottomDockTab | undefined;
    if (tab === 'assets' || tab === 'history') {
      panelRegistry.setBottomDockTab(tab);
      if (currentState) render(currentState);
      return;
    }
    const assetButton = target?.closest<HTMLButtonElement>('[data-editor-asset-id]');
    if (assetButton?.dataset.editorAssetId) {
      callbacks.onCreateFromAsset?.(assetButton.dataset.editorAssetId);
      return;
    }
  });

  const hierarchyController = createLocalEditorHierarchyController<TDocument>({
    doc,
    panel: hierarchyPanel,
    callbacks,
    inputRouter,
    contextMenu,
    getState: () => currentState,
    contextActions: options.hierarchy?.contextActions,
    requestRender: () => {
      if (currentState) render(currentState);
    },
    onBeforeOpenContextMenu: () => {
      if (helpOpen) setShortcutHelpOpen(false);
    },
  });

  assetPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorAssetFilter == null) return;
    callbacks.onAssetFilterChange?.(input.value);
  });

  inspectorPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorInspectorSearch != null) {
      inspectorFilter = input.value;
      if (currentState) render(currentState);
      return;
    }
    if (input?.type === 'checkbox' || input?.type === 'color') return;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    if (readInspectorCommitMode(input) !== 'live') return;
    const propertyInput = createInspectorPropertyInput(input, 'input', 'live');
    if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
  });

  inspectorPanel.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
      ? event.target
      : null;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    if (input instanceof HTMLInputElement && (input.type === 'text' || input.type === 'number')) {
      if (readInspectorCommitMode(input) !== 'change') return;
    }
    const propertyInput = createInspectorPropertyInput(input, readInspectorImmediateSource(input), 'final');
    if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
  });

  inspectorPanel.addEventListener('focusout', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    if (hasPendingInspectorNumberValue(input, 'final')) {
      if (currentState) render(currentState);
      return;
    }
    const commitMode = readInspectorCommitMode(input);
    if (commitMode === 'live' && hasPendingInspectorNumberValue(input, 'live')) {
      const propertyInput = createInspectorPropertyInput(input, 'input', 'final');
      if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
      else if (currentState) render(currentState);
      return;
    }
    if (commitMode !== 'blur') return;
    const propertyInput = createInspectorPropertyInput(input, 'input', 'final');
    if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
    else if (currentState) render(currentState);
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    if (currentState?.mode !== 'editor' || currentState.busy) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' && snapSettingsOpen) {
      event.preventDefault();
      closeSnapSettingsPopover();
      return;
    }
    if (key === 'escape' && placementSettingsOpen) {
      event.preventDefault();
      closePlacementSettingsPopover();
      return;
    }
    if (key === 'escape' && transformActionOpen) {
      event.preventDefault();
      closeTransformActionPopover();
      return;
    }
    if (key === 'escape' && overlaySettingsOpen) {
      event.preventDefault();
      closeOverlaySettingsPopover();
      return;
    }
    const primaryModifier = event.metaKey || event.ctrlKey;
    const handleDocumentShortcut = inputRouter.shouldHandleDocumentShortcut(event);
    const handleGlobalShortcut = inputRouter.shouldHandleGlobalShortcut(event);

    if (handleDocumentShortcut && localTestActionsEnabled && primaryModifier && key === 's') {
      event.preventDefault();
      callbacks.onSaveScene?.();
      return;
    }
    if (handleGlobalShortcut && primaryModifier && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) callbacks.onRedo?.();
      else callbacks.onUndo?.();
      return;
    }
    if (handleGlobalShortcut && event.ctrlKey && key === 'y') {
      event.preventDefault();
      callbacks.onRedo?.();
      return;
    }
    if (handleGlobalShortcut && hierarchyController.handleEditShortcut(event)) {
      return;
    }
    if (!handleGlobalShortcut || event.metaKey || event.ctrlKey || event.altKey) return;

    const toolByKey: Partial<Record<string, LocalEditorBrowserTransformTool>> = {
      q: 'select',
      w: 'move',
      e: 'rotate',
      r: 'scale',
    };
    const tool = toolByKey[key];
    if (tool) {
      event.preventDefault();
      callbacks.onTransformToolChange?.(tool);
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      callbacks.onFocusSelection?.();
      return;
    }
    if (key === 'escape') {
      event.preventDefault();
      if (callbacks.onCancelEditorIntent) callbacks.onCancelEditorIntent();
      else callbacks.onCancelActiveOperation?.();
    }
  };
  doc.addEventListener('keydown', onKeyDown);

  function captureEditableFocus(doc: Document): { selector: string; value: string | null; preserveValue?: boolean } | null {
    const active = doc.activeElement instanceof HTMLInputElement ? doc.activeElement : null;
    if (!active) return null;
    if (active.dataset.editorHierarchyRenameInput) {
      return {
        selector: `[data-editor-hierarchy-rename-input="${cssEscape(active.dataset.editorHierarchyRenameInput)}"]`,
        value: active.value,
      };
    }
    if (active.dataset.serializedPath && active.dataset.serializedTargetId) {
      return {
        selector: [
          `input[data-serialized-path="${cssEscape(active.dataset.serializedPath)}"]`,
          `[data-serialized-target-id="${cssEscape(active.dataset.serializedTargetId)}"]`,
        ].join(''),
        value: active.value,
        preserveValue: hasPendingInspectorNumberValue(active),
      };
    }
    if (active.dataset.editorInspectorSearch != null) {
      return { selector: 'input[data-editor-inspector-search]', value: active.value };
    }
    if (active.dataset.editorAssetFilter != null) {
      return { selector: 'input[data-editor-asset-filter]', value: active.value };
    }
    return null;
  }

  function restoreEditableFocus(
    doc: Document,
    snapshot: { selector: string; value: string | null; preserveValue?: boolean } | null,
  ): void {
    if (!snapshot) return;
    const input = doc.querySelector<HTMLInputElement>(snapshot.selector);
    if (!input) return;
    input.focus({ preventScroll: true });
    if (snapshot.value != null && snapshot.preserveValue) input.value = snapshot.value;
    if (snapshot.value != null && input.value === snapshot.value) {
      const position = input.value.length;
      try {
        input.setSelectionRange(position, position);
      } catch {
        // Number/search inputs may reject text selection APIs.
      }
    }
  }

  function cssEscape(value: string): string {
    return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/["\\]/g, '\\$&');
  }

  function formatSnapStepInputValue(
    snap: { moveStep: number; rotateStepDegrees: number; scaleStep: number },
    kind: LocalEditorBrowserTransformSnapStepKind,
  ): string {
    const value = kind === 'move'
      ? snap.moveStep
      : kind === 'rotate'
        ? snap.rotateStepDegrees
        : snap.scaleStep;
    return Number.isFinite(value) ? String(value) : '';
  }

  function isTransformActionEnabled(
    action: LocalEditorBrowserTransformAction,
    operationState: NonNullable<LocalEditorBrowserUiState<TDocument>['transformOperations']>,
  ): boolean {
    return action.startsWith('align-')
      ? operationState.canAlign
      : operationState.canDistribute;
  }

  const render = (state: LocalEditorBrowserUiState<TDocument>): void => {
    currentState = state;
    const focusSnapshot = captureEditableFocus(doc);
    const inEditor = state.mode === 'editor';
    const disabled = state.busy;
    if (!inEditor || disabled) contextMenu.close();
    hostChrome.style.display = !inEditor && localTestActionsEnabled ? 'flex' : 'none';
    enterEditorButton.disabled = disabled;
    for (const button of [saveButton, saveAndRunButton, discardRunButton, undoButton, redoButton, sceneHelpButton, mainCameraPreviewButton, gridToggleButton]) {
      button.style.display = 'inline-flex';
      button.disabled = disabled;
    }
    localTestGroup.style.display = inEditor && localTestActionsEnabled ? 'flex' : 'none';
    localTestButton.disabled = disabled;
    if (!inEditor || !localTestActionsEnabled) closeLocalTestMenu();
    if (!inEditor) helpOpen = false;
    inputRouter.setModalOpen(inEditor && helpOpen);
    const transformTool = state.transformTool ?? null;
    workbench.root.style.display = inEditor ? '' : 'none';
    if (inEditor) workbenchLayoutController.refresh();
    sceneToolOverlay.style.display = inEditor ? 'flex' : 'none';
    if (!inEditor) closeSnapSettingsPopover();
    if (!inEditor) closePlacementSettingsPopover();
    if (!inEditor) closeTransformActionPopover();
    if (!inEditor) closeOverlaySettingsPopover();
    const mainCameraPreview = state.mainCameraPreview ?? { enabled: false, available: false };
    mainCameraPreviewGroup.style.display = inEditor ? 'flex' : 'none';
    mainCameraPreviewButton.disabled = disabled || !mainCameraPreview.available;
    const mainCameraPreviewTooltip = mainCameraPreview.available
      ? '从 Main Camera 查看当前场景'
      : '当前场景没有可预览的 Main Camera';
    setToolbarButtonTooltip(mainCameraPreviewButton, mainCameraPreviewTooltip);
    LocalEditorShared.applyButtonActiveState(mainCameraPreviewButton, mainCameraPreview.enabled);
    const viewportTools = state.viewportTools ?? null;
    const viewportControlsDisabled = disabled || mainCameraPreview.enabled;
    const viewportControlsTooltip = mainCameraPreview.enabled
      ? '当前为 Main Camera 预览，请关闭后再使用视口工具'
      : '';
    const viewportProjectionTooltip = mainCameraPreview.enabled
      ? '当前为 Main Camera 预览，投影由 Main Camera 决定；关闭预览后可切换编辑视口投影'
      : '';
    viewportToolsGroup.style.display = inEditor ? 'flex' : 'none';
    for (const [preset, button] of viewportPresetButtons) {
      button.disabled = viewportControlsDisabled;
      setToolbarButtonTooltip(button, viewportControlsTooltip || VIEW_PRESET_TOOLTIPS[preset]);
      LocalEditorShared.applyButtonActiveState(button, viewportTools?.viewPreset === preset);
    }
    projectionToggleButton.disabled = viewportControlsDisabled;
    const projectionMode = viewportTools?.projectionMode ?? 'perspective';
    const nextProjectionMode: LocalEditorBrowserViewportProjectionMode = projectionMode === 'orthographic' ? 'perspective' : 'orthographic';
    setToolbarButtonIcon(doc, projectionToggleButton, projectionMode === 'orthographic' ? 'projection-ortho' : 'projection-perspective');
    setToolbarButtonTooltip(
      projectionToggleButton,
      viewportProjectionTooltip || `投影模式：${VIEWPORT_PROJECTION_LABELS[projectionMode]}。切换为${VIEWPORT_PROJECTION_LABELS[nextProjectionMode]}`,
    );
    LocalEditorShared.applyButtonActiveState(projectionToggleButton, projectionMode === 'orthographic');
    overlaySettingsButton.disabled = disabled;
    setToolbarButtonTooltip(overlaySettingsButton, '视口信息层设置');
    LocalEditorShared.applyButtonActiveState(overlaySettingsButton, overlaySettingsOpen);
    const overlaySettings = viewportTools?.overlay;
    for (const [key, input] of overlayInputs) {
      input.disabled = disabled;
      input.checked = overlaySettings?.[key] ?? false;
    }
    measureButton.disabled = viewportControlsDisabled;
    setToolbarButtonTooltip(
      measureButton,
      viewportControlsTooltip || '测量 XZ 地面距离',
    );
    LocalEditorShared.applyButtonActiveState(measureButton, viewportTools?.activeUtilityTool === 'measure-distance');
    const hasMeasurement = !!(
      state.viewportMeasurement?.start
      || state.viewportMeasurement?.end
      || state.viewportMeasurement?.preview
    );
    clearMeasurementButton.style.display = hasMeasurement ? 'inline-flex' : 'none';
    clearMeasurementButton.disabled = disabled || !hasMeasurement;
    setToolbarButtonTooltip(clearMeasurementButton, '清除测量结果');
    LocalEditorShared.applyButtonActiveState(clearMeasurementButton, false);
    if (!inEditor || disabled || viewportToolsGroup.style.display === 'none') closeOverlaySettingsPopover();
    const gridState = state.grid ?? { visible: false, available: false };
    gridToggleButton.disabled = disabled || !gridState.available;
    setToolbarButtonTooltip(gridToggleButton, gridState.visible ? '隐藏 Scene View 网格' : '显示 Scene View 网格');
    LocalEditorShared.applyButtonActiveState(gridToggleButton, gridState.visible);
    for (const [tool, button] of toolButtons) {
      button.disabled = disabled;
      LocalEditorShared.applyButtonActiveState(button, transformTool?.activeTool === tool);
    }
    for (const [space, button] of Object.entries(spaceButtons) as Array<[LocalEditorBrowserTransformSpace, HTMLButtonElement]>) {
      button.disabled = disabled;
      LocalEditorShared.applyButtonActiveState(button, transformTool?.activeSpace === space);
    }
    sceneHelpButton.disabled = disabled;
    const transformOperations = state.transformOperations ?? {
      settings: DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
      selectedCount: state.selectedIds.length,
      activeId: state.activeId,
      canAlign: false,
      canDistribute: false,
    };
    const operationSettings = transformOperations.settings;
    snapGroup.style.display = inEditor ? 'flex' : 'none';
    snapButton.disabled = disabled;
    snapEnabledInput.disabled = disabled;
    snapEnabledInput.checked = operationSettings.snap.enabled;
    LocalEditorShared.applyButtonActiveState(snapButton, operationSettings.snap.enabled || snapSettingsOpen);
    setToolbarButtonTooltip(
      snapButton,
      `吸附设置 · 位移 ${formatSnapStepInputValue(operationSettings.snap, 'move')} · 旋转 ${formatSnapStepInputValue(operationSettings.snap, 'rotate')}° · 缩放 ${formatSnapStepInputValue(operationSettings.snap, 'scale')}`,
    );
    for (const [kind, input] of snapStepInputs) {
      input.disabled = disabled;
      if (doc.activeElement !== input) input.value = formatSnapStepInputValue(operationSettings.snap, kind);
    }
    if (!inEditor || disabled || snapGroup.style.display === 'none') closeSnapSettingsPopover();
    placementGroup.style.display = inEditor ? 'flex' : 'none';
    placementButton.disabled = disabled;
    setToolbarButtonIcon(doc, placementButton, PLACEMENT_MODE_ICONS[operationSettings.placementMode]);
    setToolbarButtonTooltip(placementButton, `放置模式 · ${PLACEMENT_MODE_DESCRIPTIONS[operationSettings.placementMode]}`);
    LocalEditorShared.applyButtonActiveState(placementButton, operationSettings.placementMode !== 'off' || placementSettingsOpen);
    for (const [mode, button] of Object.entries(placementButtons) as Array<[LocalEditorBrowserPlacementMode, HTMLButtonElement]>) {
      button.disabled = disabled;
      LocalEditorShared.applyButtonActiveState(button, operationSettings.placementMode === mode);
    }
    if (!inEditor || disabled || placementGroup.style.display === 'none') closePlacementSettingsPopover();
    actionGroup.style.display = inEditor ? 'flex' : 'none';
    const hasTransformAction = transformOperations.canAlign || transformOperations.canDistribute;
    transformActionButton.disabled = disabled || !hasTransformAction;
    setToolbarButtonTooltip(
      transformActionButton,
      hasTransformAction ? '对齐与分布' : '选择至少 2 个对象后可用',
    );
    LocalEditorShared.applyButtonActiveState(transformActionButton, transformActionOpen);
    for (const [action, button] of transformActionButtons) {
      const enabled = isTransformActionEnabled(action, transformOperations);
      button.disabled = disabled || !enabled;
      button.style.opacity = button.disabled ? '0.45' : '1';
      button.style.cursor = button.disabled ? 'not-allowed' : 'pointer';
    }
    if (!inEditor || disabled || !hasTransformAction || actionGroup.style.display === 'none') closeTransformActionPopover();
    undoButton.disabled = disabled || !state.session?.canUndo;
    redoButton.disabled = disabled || !state.session?.canRedo;
    LocalEditorShared.applyButtonActiveState(sceneHelpButton, inEditor && helpOpen);
    shortcutHelpPanel.style.display = inEditor && helpOpen ? '' : 'none';
    dirtyBadge.style.display = inEditor && state.session?.dirty ? 'inline-flex' : 'none';
    const editorStatusText = [
      state.status,
      state.session?.dirty ? '有未保存更改' : '',
      LocalEditorShared.formatAuthoringSourceLabel(state.session?.source),
      state.summary,
    ].filter(Boolean).join(' | ');
    const transformStatusText = transformTool?.dragPhase === 'dragging'
      ? `正在拖拽 ${transformTool.draggingNodeId ?? '选择对象'}`
      : LocalEditorShared.toTransformToolStatusLabel(
          transformTool?.activeTool ?? 'select',
          transformTool?.activeSpace ?? 'world',
        );
    const statusToneColor = state.statusTone === 'error'
      ? 'var(--fps-editor-danger-strong)'
      : state.statusTone === 'warning'
        ? 'var(--fps-editor-warn)'
        : state.statusTone === 'success'
          ? 'var(--fps-editor-success)'
          : 'var(--fps-editor-muted)';
    setToolbarButtonTooltip(editorStatusButton, [
      `编辑器状态：${editorStatusText}`,
      state.statusDetails && state.statusDetails !== state.status ? state.statusDetails : '',
      transformStatusText,
      LocalEditorShared.toTransformOperationStatusLabel(operationSettings),
    ].filter(Boolean).join(' · '));
    editorStatusButton.style.color = statusToneColor;
    editorStatusButton.style.borderColor = state.statusTone == null || state.statusTone === 'default'
      ? 'var(--fps-editor-border)'
      : statusToneColor;
    renderCoordinateAxesOverlay(coordinateAxesOverlay, inEditor ? state.coordinateAxes ?? null : null);
    renderSceneFrameRateOverlay(sceneFrameRateOverlay, inEditor ? state.sceneFrameStats ?? null : null);
    renderSpatialOverlay(spatialOverlay, inEditor ? state.viewportSpatialOverlay ?? null : null);
    renderMeasurementOverlay(measurementOverlay, inEditor ? state.viewportMeasurement ?? null : null);
    const boxSelection = state.boxSelection;
    if (inEditor && boxSelection?.active) {
      boxSelectionOverlay.style.display = '';
      boxSelectionOverlay.style.left = `${boxSelection.left}px`;
      boxSelectionOverlay.style.top = `${boxSelection.top}px`;
      boxSelectionOverlay.style.width = `${boxSelection.width}px`;
      boxSelectionOverlay.style.height = `${boxSelection.height}px`;
    } else {
      boxSelectionOverlay.style.display = 'none';
    }

    scheduleToolbarOverflowLayout();
    if (!inEditor) return;
    const hierarchyDescriptor = panelRegistry.getActivePanel('left');
    const inspectorDescriptor = panelRegistry.getActivePanel('right');
    hierarchyPanel.dataset.editorPanelId = hierarchyDescriptor?.id ?? 'hierarchy';
    inspectorPanel.dataset.editorPanelId = inspectorDescriptor?.id ?? 'inspector';
    hierarchyController.render(state);
    LocalEditorPanels.renderWorkbenchBottomDockPanel(doc, assetPanel, state, panelRegistry.getBottomDockTab(), panelRegistry.getPanels('bottom'));
    LocalEditorPanels.renderInspectorPanel(doc, inspectorPanel, state, inspectorFilter, options.inspector);
    restoreEditableFocus(doc, focusSnapshot);
  };

  return {
    update(state) {
      render(state);
    },
    updateSceneFrameStats(stats) {
      renderSceneFrameRateOverlay(
        sceneFrameRateOverlay,
        currentState?.mode === 'editor' ? stats : null,
      );
    },
    setTheme(theme) {
      setActiveTheme(theme);
    },
    getTheme() {
      return activeTheme;
    },
    dispose() {
      if (toolbarOverflowRaf != null) {
        doc.defaultView?.cancelAnimationFrame(toolbarOverflowRaf);
        toolbarOverflowRaf = null;
      }
      toolbarResizeObserver?.disconnect();
      toolbarOverflowButton.removeEventListener('click', onToolbarOverflowButtonClick);
      localTestButton.removeEventListener('click', onLocalTestButtonClick);
      doc.removeEventListener('pointerdown', onToolbarOverflowPointerDown);
      doc.defaultView?.removeEventListener('resize', scheduleToolbarOverflowLayout);
      hostChrome.remove();
      workbench.root.remove();
      localTestMenu.remove();
      toolbarOverflowMenu.remove();
      snapSettingsPopover.remove();
      placementSettingsPopover.remove();
      transformActionPopover.remove();
      overlaySettingsPopover.remove();
      spatialOverlay.root.remove();
      measurementOverlay.root.remove();
      boxSelectionOverlay.remove();
      shortcutHelpPanel.remove();
      hierarchyController.dispose();
      workbenchLayoutController.dispose();
      tooltipController.dispose();
      contextMenu.dispose();
      inputRouter.dispose();
      doc.removeEventListener('keydown', onKeyDown);
    },
  };
}
