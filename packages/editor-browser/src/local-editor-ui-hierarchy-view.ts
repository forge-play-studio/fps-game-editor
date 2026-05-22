import {
  createPanelHeader,
  createToolbarButton,
  createTreeView,
  createTreeViewItem,
} from './local-editor-ui-primitives';
import { clearElement } from './local-editor-ui-shared';
import type { LocalEditorBrowserSceneGraphDropIntent } from './local-editor-ui-types';
import { canLocalEditorHierarchyNodeHaveChildren } from './local-editor-ui-hierarchy-tree';
import type {
  LocalEditorHierarchyTreeModel,
  LocalEditorHierarchyTreeNode,
} from './local-editor-ui-hierarchy-tree';

export interface LocalEditorHierarchyViewInput {
  model: LocalEditorHierarchyTreeModel;
  rename: { id: string; value: string } | null;
  drop: LocalEditorBrowserSceneGraphDropIntent | null;
  rootDrop: boolean;
}

export function renderLocalEditorHierarchyPanel(
  doc: Document,
  panel: HTMLElement,
  input: LocalEditorHierarchyViewInput,
): void {
  clearElement(panel);
  const createGroupButton = createToolbarButton(doc, '+ Group');
  createGroupButton.dataset.editorHierarchyCreateGroup = 'true';
  createGroupButton.style.padding = '3px 7px';
  createGroupButton.style.fontSize = '11px';
  panel.appendChild(createPanelHeader(doc, 'Graph', [createGroupButton]));

  const list = createTreeView(doc);
  list.dataset.editorHierarchyRootDrop = input.rootDrop ? 'active' : 'ready';
  if (input.rootDrop) {
    list.style.boxShadow = 'inset 0 -2px 0 rgba(248,196,79,0.95)';
    list.style.background = 'rgba(248,196,79,0.08)';
  }
  if (input.model.visibleRows.length === 0) {
    const empty = doc.createElement('div');
    empty.textContent = 'No hierarchy nodes.';
    empty.style.cssText = 'padding:8px;color:var(--fps-editor-muted);font-size:11px';
    list.appendChild(empty);
  } else {
    for (const node of input.model.visibleRows) {
      list.appendChild(renderHierarchyRow(doc, node, input.rename, input.drop));
    }
  }
  panel.appendChild(list);
}

function renderHierarchyRow(
  doc: Document,
  node: LocalEditorHierarchyTreeNode,
  rename: { id: string; value: string } | null,
  drop: LocalEditorBrowserSceneGraphDropIntent | null,
): HTMLButtonElement {
  const isRenaming = rename?.id === node.id;
  const dropPlacement = drop?.targetId === node.id ? drop.placement : null;
  const canHaveChildren = canLocalEditorHierarchyNodeHaveChildren(node);
  const button = createTreeViewItem(doc, {
    id: node.id,
    label: node.label,
    depth: node.depth,
    role: node.role,
    selected: node.selected,
    active: node.active,
    locked: node.item.locked,
    protected: node.protected,
    selectable: node.item.selectable,
    draggable: node.item.draggable,
    dropPlacement,
  });
  button.dataset.editorHierarchyCanHaveChildren = canHaveChildren ? 'true' : 'false';
  button.title = node.protected ? `${node.label} (protected)` : node.label;
  appendDisclosure(doc, button, node);
  appendRoleBadge(doc, button, node);
  if (isRenaming) appendRenameInput(doc, button, node, rename.value);
  else appendLabel(doc, button, node);
  if (node.protected) appendProtectedBadge(doc, button);
  return button;
}

function appendDisclosure(doc: Document, parent: HTMLElement, node: LocalEditorHierarchyTreeNode): void {
  const disclosure = doc.createElement('span');
  if (node.childIds.length > 0) disclosure.dataset.editorHierarchyToggle = node.id;
  disclosure.textContent = node.childIds.length > 0 ? (node.expanded ? '▾' : '▸') : '';
  disclosure.style.cssText = [
    'width:12px',
    'flex:0 0 12px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'color:var(--fps-editor-muted)',
    'font-size:10px',
  ].join(';');
  parent.appendChild(disclosure);
}

function appendRoleBadge(doc: Document, parent: HTMLElement, node: LocalEditorHierarchyTreeNode): void {
  const badge = doc.createElement('span');
  badge.textContent = node.role === 'root' ? 'R' : node.role === 'group' ? 'G' : 'O';
  badge.style.cssText = [
    'width:15px',
    'height:15px',
    'flex:0 0 15px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:2px',
    `background:${node.role === 'root' ? '#3a2f18' : node.role === 'group' ? '#243426' : '#252b34'}`,
    'color:var(--fps-editor-muted-strong)',
    'font-size:9px',
    'font-weight:900',
  ].join(';');
  parent.appendChild(badge);
}

function appendLabel(doc: Document, parent: HTMLElement, node: LocalEditorHierarchyTreeNode): void {
  const label = doc.createElement('span');
  label.textContent = node.item.locked && !node.protected ? `${node.label}  [locked]` : node.label;
  label.style.cssText = 'min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  parent.appendChild(label);
}

function appendProtectedBadge(doc: Document, parent: HTMLElement): void {
  const badge = doc.createElement('span');
  badge.textContent = 'protected';
  badge.style.cssText = [
    'flex:0 0 auto',
    'padding:1px 4px',
    'border:1px solid rgba(229,180,84,0.45)',
    'border-radius:2px',
    'color:var(--fps-editor-warn)',
    'font-size:9px',
    'font-weight:900',
  ].join(';');
  parent.appendChild(badge);
}

function appendRenameInput(
  doc: Document,
  parent: HTMLElement,
  node: LocalEditorHierarchyTreeNode,
  value: string,
): void {
  const input = doc.createElement('input');
  input.dataset.editorHierarchyRenameInput = node.id;
  input.value = value;
  input.style.cssText = [
    'min-width:0',
    'flex:1',
    'height:22px',
    'box-sizing:border-box',
    'border:1px solid var(--fps-editor-accent-strong)',
    'border-radius:2px',
    'background:var(--fps-editor-field)',
    'color:#fff',
    'font-size:12px',
    'font-weight:700',
    'padding:2px 5px',
    'outline:none',
  ].join(';');
  parent.appendChild(input);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
}
