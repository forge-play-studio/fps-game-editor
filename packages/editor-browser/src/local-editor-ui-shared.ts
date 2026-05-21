import type {
  LocalEditorBrowserAuthoringSource,
  LocalEditorBrowserSceneGraphDropPlacement,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformTool,
} from './local-editor-ui-types';

export function applyButtonActiveState(button: HTMLButtonElement, active: boolean): void {
  button.dataset.active = active ? 'true' : 'false';
  button.style.background = active ? 'var(--fps-editor-button-active)' : 'var(--fps-editor-button)';
  button.style.borderColor = active ? 'var(--fps-editor-accent-strong)' : 'var(--fps-editor-border)';
  button.style.color = active ? '#fff' : 'var(--fps-editor-text)';
}

export function createButton(doc: Document, text: string): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText = [
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-button)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'font-weight:700',
    'padding:4px 8px',
    'cursor:pointer',
    'white-space:nowrap',
    'height:26px',
    'line-height:16px',
  ].join(';');
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
    'box-shadow:0 12px 32px rgba(0,0,0,0.28)',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'pointer-events:auto',
  ].join(';');
  return panel;
}

export function createDockTabButton(doc: Document, text: string, active: boolean): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText = [
    'height:30px',
    'border:0',
    'border-right:1px solid var(--fps-editor-divider)',
    `border-top:${active ? '2px solid var(--fps-editor-accent)' : '2px solid transparent'}`,
    `background:${active ? 'var(--fps-editor-panel)' : 'var(--fps-editor-chrome-dark)'}`,
    `color:${active ? 'var(--fps-editor-text-strong)' : 'var(--fps-editor-muted)'}`,
    'font-size:12px',
    'font-weight:900',
    'padding:0 10px',
    'cursor:pointer',
    'white-space:nowrap',
  ].join(';');
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
  const labels: Record<LocalEditorBrowserTransformTool, string> = {
    select: '选择',
    move: '移动',
    rotate: '旋转',
    scale: '缩放',
  };
  return labels[tool];
}

export function toTransformSpaceLabel(space: LocalEditorBrowserTransformSpace): string {
  const labels: Record<LocalEditorBrowserTransformSpace, string> = {
    world: '世界',
    local: '本地',
  };
  return labels[space];
}
