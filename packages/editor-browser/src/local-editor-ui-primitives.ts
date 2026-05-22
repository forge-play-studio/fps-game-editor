import { createLocalEditorIcon, type LocalEditorIconName } from './local-editor-ui-icons';
import { createButton, createDockTabButton } from './local-editor-ui-shared';

export interface TreeViewItemRenderInput {
  id: string;
  label: string;
  depth?: number;
  role?: 'root' | 'group' | 'object';
  selected?: boolean;
  active?: boolean;
  locked?: boolean;
  protected?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  dropPlacement?: 'inside' | 'before' | 'after' | null;
}

export function createPanelHeader(
  doc: Document,
  title: string,
  actions: HTMLElement[] = [],
  icon?: LocalEditorIconName,
): HTMLDivElement {
  const header = doc.createElement('div');
  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'min-height:30px',
    'margin:-8px -8px 8px',
    'padding:0 8px',
    'border-bottom:1px solid var(--fps-editor-divider)',
    'background:var(--fps-editor-chrome-dark)',
  ].join(';');
  const heading = doc.createElement('h2');
  heading.style.cssText = 'font-size:13px;margin:0;font-weight:800;color:var(--fps-editor-text-strong);flex:1;display:flex;align-items:center;gap:6px;min-width:0';
  if (icon) heading.appendChild(createLocalEditorIcon(doc, icon));
  const label = doc.createElement('span');
  label.textContent = title;
  label.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  heading.appendChild(label);
  header.appendChild(heading);
  for (const action of actions) header.appendChild(action);
  return header;
}

export function createToolbarButton(doc: Document, text: string, icon?: LocalEditorIconName): HTMLButtonElement {
  return createButton(doc, text, { icon });
}

export function createDockTab(doc: Document, text: string, active: boolean, icon?: LocalEditorIconName): HTMLButtonElement {
  return createDockTabButton(doc, text, active, { icon });
}

export function createTreeView(doc: Document): HTMLDivElement {
  const list = doc.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:1px';
  return list;
}

export function createTreeViewItem(doc: Document, input: TreeViewItemRenderInput): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.dataset.editorHierarchyId = input.id;
  const protectedNode = input.protected === true;
  button.draggable = !protectedNode && input.locked !== true && input.draggable !== false;
  const selectable = input.selectable !== false && !protectedNode && input.locked !== true;
  const depth = input.depth ?? 0;
  const dropColor = input.dropPlacement === 'inside'
    ? 'var(--fps-editor-drop-target)'
    : input.dropPlacement
      ? 'var(--fps-editor-warn-strong)'
      : null;
  button.style.cssText = [
    'width:100%',
    'min-height:24px',
    'display:flex',
    'align-items:center',
    'gap:5px',
    'text-align:left',
    `padding:3px 8px 3px ${8 + depth * 16}px`,
    `border:1px solid ${dropColor ?? (input.active ? 'var(--fps-editor-accent-strong)' : input.selected ? 'var(--fps-editor-accent)' : 'transparent')}`,
    'border-radius:0',
    `background:${input.dropPlacement === 'inside' ? 'var(--fps-editor-accent-soft)' : input.active ? 'var(--fps-editor-row-active)' : input.selected ? 'var(--fps-editor-row-selected)' : input.locked ? 'var(--fps-editor-locked-bg)' : 'transparent'}`,
    `color:${input.locked && !protectedNode ? 'var(--fps-editor-locked-text)' : input.selected ? 'var(--fps-editor-row-selected-text)' : 'var(--fps-editor-text)'}`,
    'font-size:12px',
    'font-weight:700',
    `cursor:${selectable ? 'pointer' : 'not-allowed'}`,
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
    dropColor && input.dropPlacement === 'before' ? 'box-shadow:0 -2px 0 var(--fps-editor-warn-strong)' : '',
    dropColor && input.dropPlacement === 'after' ? 'box-shadow:0 2px 0 var(--fps-editor-warn-strong)' : '',
  ].join(';');
  return button;
}

export function createPropertyGrid(doc: Document): HTMLDivElement {
  const grid = doc.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  return grid;
}

export function createPropertyRow(doc: Document, label: string, value: HTMLElement): HTMLDivElement {
  const row = doc.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:center;min-height:24px';
  const labelElement = doc.createElement('div');
  labelElement.textContent = label;
  labelElement.style.cssText = 'color:var(--fps-editor-muted);font-weight:700';
  row.appendChild(labelElement);
  row.appendChild(value);
  return row;
}

export interface LocalEditorBadgeOptions {
  tone?: 'default' | 'warning' | 'danger' | 'success';
  compact?: boolean;
  icon?: LocalEditorIconName;
}

export function createBadge(doc: Document, text: string, options: LocalEditorBadgeOptions = {}): HTMLSpanElement {
  const badge = doc.createElement('span');
  const tone = options.tone ?? 'default';
  const color = tone === 'warning'
    ? 'var(--fps-editor-warn)'
    : tone === 'danger'
      ? 'var(--fps-editor-danger-text)'
      : tone === 'success'
        ? 'var(--fps-editor-success)'
        : 'var(--fps-editor-muted-strong)';
  const background = tone === 'warning'
    ? 'var(--fps-editor-warn-soft)'
    : tone === 'danger'
      ? 'var(--fps-editor-danger-soft)'
      : tone === 'success'
        ? 'var(--fps-editor-accent-soft)'
        : 'var(--fps-editor-field)';
  const border = tone === 'warning'
    ? 'var(--fps-editor-warn-border)'
    : tone === 'danger'
      ? 'var(--fps-editor-danger-border)'
      : 'var(--fps-editor-border)';
  badge.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'gap:3px',
    `padding:${options.compact ? '1px 4px' : '2px 6px'}`,
    `border:1px solid ${border}`,
    'border-radius:2px',
    `background:${background}`,
    `color:${color}`,
    'font-size:9px',
    'font-weight:900',
    'line-height:1.2',
    'white-space:nowrap',
  ].join(';');
  if (options.icon) badge.appendChild(createIconBadgeIcon(doc, options.icon));
  const label = doc.createElement('span');
  label.textContent = text;
  label.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  badge.appendChild(label);
  return badge;
}

function createIconBadgeIcon(doc: Document, icon: LocalEditorIconName): HTMLSpanElement {
  const wrapper = createLocalEditorIcon(doc, icon, { size: 10, strokeWidth: 2.2 });
  wrapper.dataset.editorBadgeIcon = icon;
  return wrapper;
}

export function createEmptyState(doc: Document, text: string): HTMLDivElement {
  const empty = doc.createElement('div');
  empty.textContent = text;
  empty.style.cssText = [
    'padding:8px',
    'border:1px solid var(--fps-editor-border-soft)',
    'border-radius:3px',
    'background:var(--fps-editor-field)',
    'color:var(--fps-editor-muted)',
    'font-size:11px',
    'line-height:1.45',
  ].join(';');
  return empty;
}

export function createListItemBlock(doc: Document): HTMLDivElement {
  const item = doc.createElement('div');
  item.style.cssText = [
    'padding:7px 8px',
    'border:1px solid var(--fps-editor-border-soft)',
    'border-radius:3px',
    'background:var(--fps-editor-panel-soft)',
  ].join(';');
  return item;
}

export function createEditorInputStyle(): string {
  return [
    'min-width:0',
    'height:28px',
    'box-sizing:border-box',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-field)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'padding:0 8px',
  ].join(';');
}

export function createAssetList(doc: Document, grid = false): HTMLDivElement {
  const list = doc.createElement('div');
  list.style.cssText = grid
    ? 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;overflow:auto;padding-right:2px'
    : 'display:flex;flex-direction:column;gap:2px;max-height:220px;overflow:auto;padding-right:2px';
  return list;
}

export function createContextMenu(doc: Document): HTMLDivElement {
  const menu = doc.createElement('div');
  menu.dataset.editorContextMenu = 'true';
  menu.style.cssText = [
    'position:fixed',
    'display:none',
    'min-width:160px',
    'padding:4px',
    'border:1px solid var(--fps-editor-border)',
    'background:var(--fps-editor-bg)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'z-index:2147483641',
    'pointer-events:auto',
  ].join(';');
  return menu;
}
