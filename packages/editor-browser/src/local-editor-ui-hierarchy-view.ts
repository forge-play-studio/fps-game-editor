import {
  createBadge,
  createPanelHeader,
  createToolbarButton,
  createTreeView,
  createTreeViewItem,
} from './local-editor-ui-primitives';
import { createLocalEditorIcon, type LocalEditorIconName } from './local-editor-ui-icons';
import { clearElement } from './local-editor-ui-shared';
import type { LocalEditorBrowserSceneGraphDropIntent } from './local-editor-ui-types';
import { canLocalEditorHierarchyNodeHaveChildren } from './local-editor-ui-hierarchy-tree';
import type {
  LocalEditorHierarchyTreeModel,
  LocalEditorHierarchyTreeNode,
} from './local-editor-ui-hierarchy-tree';

const HIERARCHY_ROLE_ICONS: Record<LocalEditorHierarchyTreeNode['role'], LocalEditorIconName> = {
  root: 'root',
  group: 'group',
  object: 'object',
};

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
  const createGroupButton = createToolbarButton(doc, '+ Group', 'group');
  createGroupButton.dataset.editorHierarchyCreateGroup = 'true';
  createGroupButton.style.padding = '3px 7px';
  createGroupButton.style.fontSize = '11px';
  panel.appendChild(createPanelHeader(doc, 'Hierarchy', [createGroupButton], 'hierarchy'));

  const list = createTreeView(doc);
  list.dataset.editorHierarchyRootDrop = input.rootDrop ? 'active' : 'ready';
  if (input.rootDrop) {
    list.style.boxShadow = 'inset 0 -2px 0 var(--fps-editor-warn-strong)';
    list.style.background = 'var(--fps-editor-warn-soft)';
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
  disclosure.style.cssText = [
    'width:12px',
    'flex:0 0 12px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'color:var(--fps-editor-muted)',
    'font-size:10px',
  ].join(';');
  if (node.childIds.length > 0) {
    disclosure.appendChild(createLocalEditorIcon(doc, node.expanded ? 'chevron-down' : 'chevron-right', {
      size: 12,
      strokeWidth: 2.4,
    }));
  }
  parent.appendChild(disclosure);
}

function appendRoleBadge(doc: Document, parent: HTMLElement, node: LocalEditorHierarchyTreeNode): void {
  const badge = doc.createElement('span');
  badge.title = node.role;
  badge.style.cssText = [
    'width:15px',
    'height:15px',
    'flex:0 0 15px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:2px',
    `background:${node.role === 'root' ? 'var(--fps-editor-role-root-bg)' : node.role === 'group' ? 'var(--fps-editor-role-group-bg)' : 'var(--fps-editor-role-object-bg)'}`,
    'color:var(--fps-editor-muted-strong)',
    'font-size:9px',
    'font-weight:900',
  ].join(';');
  badge.appendChild(createLocalEditorIcon(doc, HIERARCHY_ROLE_ICONS[node.role], { size: 11, strokeWidth: 2.3 }));
  parent.appendChild(badge);
}

function appendLabel(doc: Document, parent: HTMLElement, node: LocalEditorHierarchyTreeNode): void {
  const label = doc.createElement('span');
  label.textContent = node.item.locked && !node.protected ? `${node.label}  [locked]` : node.label;
  label.style.cssText = 'min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  parent.appendChild(label);
}

function appendProtectedBadge(doc: Document, parent: HTMLElement): void {
  const badge = createBadge(doc, 'protected', { compact: true, tone: 'warning', icon: 'lock' });
  badge.style.flex = '0 0 auto';
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
    'color:var(--fps-editor-text-strong)',
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
