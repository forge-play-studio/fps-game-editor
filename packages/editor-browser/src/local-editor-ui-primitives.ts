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

export function createPanelHeader(doc: Document, title: string, actions: HTMLElement[] = []): HTMLDivElement {
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
  heading.textContent = title;
  heading.style.cssText = 'font-size:13px;margin:0;font-weight:800;color:var(--fps-editor-text-strong);flex:1';
  header.appendChild(heading);
  for (const action of actions) header.appendChild(action);
  return header;
}

export function createToolbarButton(doc: Document, text: string): HTMLButtonElement {
  return createButton(doc, text);
}

export function createDockTab(doc: Document, text: string, active: boolean): HTMLButtonElement {
  return createDockTabButton(doc, text, active);
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
    ? 'rgba(88,166,255,0.95)'
    : input.dropPlacement
      ? 'rgba(248,196,79,0.95)'
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
    `background:${input.dropPlacement === 'inside' ? 'var(--fps-editor-accent-soft)' : input.active ? 'rgba(45,117,214,0.50)' : input.selected ? 'rgba(45,117,214,0.30)' : input.locked ? '#262626' : 'transparent'}`,
    `color:${input.locked && !protectedNode ? '#777' : input.selected ? '#ffffff' : 'var(--fps-editor-text)'}`,
    'font-size:12px',
    'font-weight:700',
    `cursor:${selectable ? 'pointer' : 'not-allowed'}`,
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
    dropColor && input.dropPlacement === 'before' ? 'box-shadow:0 -2px 0 rgba(248,196,79,0.95)' : '',
    dropColor && input.dropPlacement === 'after' ? 'box-shadow:0 2px 0 rgba(248,196,79,0.95)' : '',
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
    'box-shadow:0 12px 32px rgba(0,0,0,0.35)',
    'z-index:2147483641',
    'pointer-events:auto',
  ].join(';');
  return menu;
}
