import {
  DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
  DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS,
} from '@fps-games/editor-core';
import { createLocalEditorIcon, type LocalEditorIconName } from './local-editor-ui-icons';
import type {
  LocalEditorBrowserAuthoringSource,
  LocalEditorBrowserPlacementMode,
  LocalEditorBrowserTransformConstraint,
  LocalEditorBrowserTransformAction,
  LocalEditorBrowserTransformHandleDescriptor,
  LocalEditorBrowserTransformOperationSettings,
  LocalEditorBrowserSceneGraphDropPlacement,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformTool,
} from './local-editor-ui-types';

export interface LocalEditorButtonOptions {
  icon?: LocalEditorIconName;
  labelMode?: 'visible' | 'icon-only';
  tooltip?: string;
  ariaLabel?: string;
  variant?: 'default' | 'toolbar-icon';
  toolbarRole?: 'command' | 'toggle' | 'settings';
}

export function applyButtonActiveState(button: HTMLButtonElement, active: boolean): void {
  button.dataset.active = active ? 'true' : 'false';
  button.style.background = active ? 'var(--fps-editor-button-active)' : 'var(--fps-editor-button)';
  button.style.borderColor = active ? 'var(--fps-editor-accent-strong)' : 'var(--fps-editor-border)';
  button.style.color = active ? 'var(--fps-editor-text-inverse)' : 'var(--fps-editor-text)';
}

export function createButton(doc: Document, text: string, options: LocalEditorButtonOptions = {}): HTMLButtonElement {
  const labelMode = options.labelMode ?? 'visible';
  const variant = options.variant ?? 'default';
  const accessibleLabel = options.ariaLabel ?? text;
  const tooltip = options.tooltip ?? (labelMode === 'icon-only' ? accessibleLabel : undefined);
  const button = doc.createElement('button');
  button.type = 'button';
  button.dataset.editorButtonLabelMode = labelMode;
  button.dataset.editorButtonVariant = variant;
  button.dataset.editorToolbarRole = options.toolbarRole ?? 'command';
  if (options.toolbarRole === 'settings') {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
  }
  if (accessibleLabel) button.setAttribute('aria-label', accessibleLabel);
  if (tooltip) button.dataset.editorTooltip = tooltip;
  button.style.cssText = [
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-button)',
    'color:var(--fps-editor-text)',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    `gap:${labelMode === 'icon-only' ? 0 : 5}px`,
    'font-size:12px',
    'font-weight:700',
    `padding:${variant === 'toolbar-icon' ? '0' : '4px 8px'}`,
    'cursor:pointer',
    'white-space:nowrap',
    `width:${variant === 'toolbar-icon' ? '32px' : 'auto'}`,
    `min-width:${variant === 'toolbar-icon' ? '32px' : '0'}`,
    `height:${variant === 'toolbar-icon' ? '28px' : '26px'}`,
    `flex:${variant === 'toolbar-icon' ? '0 0 32px' : '0 0 auto'}`,
    'line-height:16px',
  ].join(';');
  if (options.icon) button.appendChild(createLocalEditorIcon(doc, options.icon));
  if (labelMode === 'visible') {
    const label = doc.createElement('span');
    label.dataset.editorButtonLabel = 'true';
    label.textContent = text;
    label.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    button.appendChild(label);
  }
  button.addEventListener('mouseenter', () => {
    if (!button.disabled) button.style.background = button.dataset.active === 'true'
      ? 'var(--fps-editor-button-active)'
      : 'var(--fps-editor-button-hover)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = button.dataset.active === 'true'
      ? 'var(--fps-editor-button-active)'
      : 'var(--fps-editor-button)';
  });
  return button;
}

export function readHierarchyDropPlacement(
  event: DragEvent,
  target: HTMLElement,
): LocalEditorBrowserSceneGraphDropPlacement {
  const rect = target.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  if (offsetY < rect.height * 0.25) return 'before';
  if (offsetY > rect.height * 0.75) return 'after';
  return 'inside';
}

export function createEditorPanel(doc: Document, side: 'left-top' | 'left-bottom' | 'right'): HTMLDivElement {
  const panel = doc.createElement('div');
  const placement = side === 'right'
    ? 'top:56px;right:12px;bottom:14px;width:330px'
    : side === 'left-top'
      ? 'top:56px;left:12px;height:42vh;width:280px'
      : 'left:12px;bottom:14px;height:calc(58vh - 84px);width:280px';
  panel.style.cssText = [
    'position:fixed',
    placement,
    'z-index:2147483639',
    'display:none',
    'overflow:auto',
    'padding:12px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'pointer-events:auto',
  ].join(';');
  return panel;
}

export function createDockTabButton(
  doc: Document,
  text: string,
  active: boolean,
  options: LocalEditorButtonOptions = {},
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.style.cssText = [
    'height:30px',
    'border:0',
    'border-right:1px solid var(--fps-editor-divider)',
    `border-top:${active ? '2px solid var(--fps-editor-accent)' : '2px solid transparent'}`,
    `background:${active ? 'var(--fps-editor-panel)' : 'var(--fps-editor-chrome-dark)'}`,
    `color:${active ? 'var(--fps-editor-text-strong)' : 'var(--fps-editor-muted)'}`,
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'gap:5px',
    'font-size:12px',
    'font-weight:900',
    'padding:0 10px',
    'cursor:pointer',
    'white-space:nowrap',
  ].join(';');
  if (options.icon) button.appendChild(createLocalEditorIcon(doc, options.icon));
  const label = doc.createElement('span');
  label.dataset.editorButtonLabel = 'true';
  label.textContent = text;
  label.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  button.appendChild(label);
  return button;
}

export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.firstChild.remove();
  }
}

export function toTitle(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function formatAuthoringSourceLabel(source: LocalEditorBrowserAuthoringSource | null | undefined): string {
  if (!source) return '';
  const revision = source.ref.revision != null ? `@${source.ref.revision}` : '';
  return `${source.ref.sourceId}${revision}`;
}

export function toTransformToolLabel(tool: LocalEditorBrowserTransformTool): string {
  return DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS[tool].label;
}

export function toTransformSpaceLabel(space: LocalEditorBrowserTransformSpace): string {
  const labels: Record<LocalEditorBrowserTransformSpace, string> = {
    world: '世界',
    local: '本地',
  };
  return labels[space];
}

export function toTransformConstraintLabel(
  constraint: LocalEditorBrowserTransformConstraint | undefined,
): string {
  const labels: Record<LocalEditorBrowserTransformConstraint, string> = {
    axis: '轴向',
    plane: '平面',
    free: '自由',
    uniform: '统一',
    'view-plane': '自由',
  };
  return labels[constraint ?? 'axis'];
}

export function toTransformHandleListLabel(tool: LocalEditorBrowserTransformTool): string {
  const handles = DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS[tool].handles as readonly LocalEditorBrowserTransformHandleDescriptor[];
  return handles.map(handle => handle.label).join(' / ');
}

export function toTransformToolStatusLabel(
  tool: LocalEditorBrowserTransformTool,
  space: LocalEditorBrowserTransformSpace,
): string {
  const handleLabel = toTransformHandleListLabel(tool);
  return [
    toTransformToolLabel(tool),
    toTransformSpaceLabel(space),
    handleLabel,
  ].filter(Boolean).join(' · ');
}

export function toPlacementModeLabel(mode: LocalEditorBrowserPlacementMode): string {
  const labels: Record<LocalEditorBrowserPlacementMode, string> = {
    off: '放置关',
    ground: '地面',
    surface: '表面',
  };
  return labels[mode];
}

export function toTransformActionLabel(action: LocalEditorBrowserTransformAction): string {
  const labels: Record<LocalEditorBrowserTransformAction, string> = {
    'align-x': '对齐 X',
    'align-y': '对齐 Y',
    'align-z': '对齐 Z',
    'align-all': '对齐 XYZ',
    'distribute-x': '分布 X',
    'distribute-y': '分布 Y',
    'distribute-z': '分布 Z',
  };
  return labels[action];
}

export function toTransformSnapStatusLabel(
  settings: LocalEditorBrowserTransformOperationSettings = DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
): string {
  const snap = settings.snap;
  const state = snap.enabled ? '吸附开' : '吸附关';
  return [
    state,
    `移动 ${formatOperationNumber(snap.moveStep)}`,
    `旋转 ${formatOperationNumber(snap.rotateStepDegrees)}°`,
    `缩放 ${formatOperationNumber(snap.scaleStep)}`,
  ].join(' · ');
}

export function toTransformOperationStatusLabel(
  settings: LocalEditorBrowserTransformOperationSettings = DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
): string {
  const placement = settings.placementMode === 'off'
    ? toPlacementModeLabel(settings.placementMode)
    : `放置${toPlacementModeLabel(settings.placementMode)}`;
  return [
    toTransformSnapStatusLabel(settings),
    placement,
  ].join(' · ');
}

export function toTransformMouseHint(tool: LocalEditorBrowserTransformTool): string {
  if (tool === 'move') return '移动手柄 · 轴向箭头 / 平面方块 / 中心自由拖拽 · Esc 取消';
  if (tool === 'rotate') return '旋转手柄 · 轴向圆环拖拽 · Esc 取消';
  if (tool === 'scale') return '缩放手柄 · 轴向方块 / 中心统一缩放 · Esc 取消';
  return '左键选择 · 空白拖拽框选 · 中键平移 · Alt+左键环绕 · 右键飞行 · 滚轮缩放';
}

function formatOperationNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}
