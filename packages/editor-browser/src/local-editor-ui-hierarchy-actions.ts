import type {
  LocalEditorBrowserSceneGraphGroupSelectionIntent,
  LocalEditorBrowserUiState,
  LocalEditorContextAction,
  LocalEditorContextMenuItem,
} from './local-editor-ui-types';
import {
  canLocalEditorHierarchyNodeHaveChildren,
  isLocalEditorHierarchyNodeMovable,
  type LocalEditorHierarchyTreeModel,
  type LocalEditorHierarchyTreeNode,
} from './local-editor-ui-hierarchy-tree';

export type LocalEditorHierarchyAction =
  | { kind: 'context-action'; action: LocalEditorContextAction }
  | { kind: 'begin-rename'; targetId: string }
  | { kind: 'group-selection'; intent: LocalEditorBrowserSceneGraphGroupSelectionIntent };

export interface LocalEditorHierarchyMenuDefinition {
  items: LocalEditorContextMenuItem[];
  actions: ReadonlyMap<string, LocalEditorHierarchyAction>;
}

export interface LocalEditorHierarchyActionInput<TDocument = unknown> {
  state: LocalEditorBrowserUiState<TDocument>;
  model: LocalEditorHierarchyTreeModel;
  node?: LocalEditorHierarchyTreeNode | null;
  hasGroupSelectionHandler?: boolean;
}

export function createLocalEditorHierarchyNodeMenu<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument> & { node: LocalEditorHierarchyTreeNode },
): LocalEditorHierarchyMenuDefinition {
  const { state, model, node } = input;
  const selected = state.selectedIds.includes(node.id);
  const selectable = isNodeSelectable(node);
  const targetIds = selected ? state.selectedIds : [node.id];
  const activeId = selected ? state.activeId ?? node.id : node.id;
  const topLevelSelection = model.getTopLevelSelection(targetIds);
  const canRename = canRenameNode(node);
  const canCreateChildGroup = canLocalEditorHierarchyNodeHaveChildren(node);
  const deleteDisabledReason = getDeleteDisabledReason(model, targetIds);
  const groupSelection = createGroupSelectionAction(input, topLevelSelection);
  const actions = new Map<string, LocalEditorHierarchyAction>();

  actions.set('hierarchy.focus', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'focus', targetIds, activeId },
  });
  actions.set('hierarchy.rename', { kind: 'begin-rename', targetId: node.id });
  actions.set('hierarchy.create-child-group', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'create-group', parentId: node.id, activeId },
  });
  if (groupSelection.action) actions.set('hierarchy.group-selection', groupSelection.action);
  actions.set('hierarchy.delete', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'delete', targetIds, activeId },
  });

  return {
    actions,
    items: [
      menuItem('hierarchy.focus', 'Focus in Preview', { shortcut: 'F', disabled: !selectable, disabledReason: 'Protected or locked nodes cannot be focused from Hierarchy.' }),
      menuItem('hierarchy.rename', 'Rename', { disabled: !canRename, disabledReason: 'This node is protected or read-only.' }),
      menuItem('hierarchy.create-child-group', 'Add Empty Group', {
        disabled: !canCreateChildGroup,
        disabledReason: 'This node cannot contain children.',
      }),
      menuItem('hierarchy.group-selection', 'Group Selection', {
        disabled: groupSelection.disabled,
        disabledReason: groupSelection.disabledReason,
      }),
      menuItem('hierarchy.delete', 'Delete', {
        shortcut: 'Delete',
        danger: true,
        disabled: !!deleteDisabledReason,
        disabledReason: deleteDisabledReason,
      }),
      ...placeholderItems(),
    ],
  };
}

export function createLocalEditorHierarchyBlankMenu<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyMenuDefinition {
  const groupSelection = createGroupSelectionAction(input, input.model.getTopLevelSelection(input.state.selectedIds));
  const actions = new Map<string, LocalEditorHierarchyAction>();
  actions.set('hierarchy.create-group', {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'create-group',
      parentId: null,
      activeId: input.state.activeId,
    },
  });
  if (groupSelection.action) actions.set('hierarchy.group-selection', groupSelection.action);
  return {
    actions,
    items: [
      menuItem('hierarchy.create-group', 'Create Empty Group'),
      menuItem('hierarchy.group-selection', 'Group Selection', {
        disabled: groupSelection.disabled,
        disabledReason: groupSelection.disabledReason,
      }),
      ...placeholderItems(),
    ],
  };
}

export function createLocalEditorHierarchyDeleteShortcutAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyAction | null {
  const targetIds = input.state.selectedIds.filter((id) => {
    const node = input.model.getNode(id);
    return node && !getDeleteDisabledReason(input.model, [id]);
  });
  if (targetIds.length === 0) return null;
  return {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'delete',
      targetIds,
      activeId: input.state.activeId,
    },
  };
}

function createGroupSelectionAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
  ids: string[],
): { disabled: boolean; disabledReason?: string; action?: LocalEditorHierarchyAction } {
  if (!input.hasGroupSelectionHandler) {
    return { disabled: true, disabledReason: 'Group Selection pipeline is not connected yet.' };
  }
  if (ids.length === 0) return { disabled: true, disabledReason: 'Select one or more movable nodes first.' };
  if (ids.some(id => !isLocalEditorHierarchyNodeMovable(input.model.getNode(id)))) {
    return { disabled: true, disabledReason: 'Protected or locked nodes cannot be grouped.' };
  }
  const parentId = resolveCommonParentId(input.model, ids);
  return {
    disabled: false,
    action: {
      kind: 'group-selection',
      intent: {
        ids,
        parentId,
        name: 'Group',
        pivot: 'selection-center',
        preserveWorldTransform: true,
      },
    },
  };
}

function resolveCommonParentId(model: LocalEditorHierarchyTreeModel, ids: readonly string[]): string | null {
  const parents = ids.map(id => model.getNode(id)?.parentId ?? null);
  const first = parents[0] ?? null;
  return parents.every(parentId => parentId === first) ? first : null;
}

function isNodeSelectable(node: LocalEditorHierarchyTreeNode): boolean {
  return node.item.selectable !== false && node.item.locked !== true && node.protected !== true;
}

function canRenameNode(node: LocalEditorHierarchyTreeNode): boolean {
  return node.protected !== true && node.item.locked !== true && node.item.renamable !== false;
}

function getDeleteDisabledReason(model: LocalEditorHierarchyTreeModel, ids: readonly string[]): string | undefined {
  if (ids.length === 0) return 'Select a node first.';
  for (const id of ids) {
    const node = model.getNode(id);
    if (!node) return 'The selected node no longer exists.';
    if (node.protected) return 'Protected nodes cannot be deleted.';
    if (node.item.locked) return 'Locked nodes cannot be deleted.';
    if (node.item.deletable === false) return 'This node is read-only.';
  }
  return undefined;
}

function menuItem(
  id: string,
  label: string,
  options: Partial<LocalEditorContextMenuItem> = {},
): LocalEditorContextMenuItem {
  return {
    id,
    label,
    ...options,
  };
}

function placeholderItems(): LocalEditorContextMenuItem[] {
  return [
    menuItem('hierarchy.duplicate', 'Duplicate', { shortcut: 'Cmd/Ctrl+D', disabled: true, disabledReason: 'Duplicate is not implemented yet.', separatorBefore: true }),
    menuItem('hierarchy.copy', 'Copy', { shortcut: 'Cmd/Ctrl+C', disabled: true, disabledReason: 'Copy is not implemented yet.' }),
    menuItem('hierarchy.paste', 'Paste', { shortcut: 'Cmd/Ctrl+V', disabled: true, disabledReason: 'Paste is not implemented yet.' }),
    menuItem('hierarchy.copy-transform', 'Copy Transform', { disabled: true, disabledReason: 'Copy Transform is not implemented yet.', separatorBefore: true }),
    menuItem('hierarchy.paste-transform', 'Paste Transform', { disabled: true, disabledReason: 'Paste Transform is not implemented yet.' }),
    menuItem('hierarchy.locked', 'Locked', { disabled: true, disabledReason: 'Lock editing is not implemented yet.', separatorBefore: true }),
    menuItem('hierarchy.do-not-serialize', 'Do Not Serialize', { disabled: true, disabledReason: 'Serialization flags are not implemented yet.' }),
  ];
}
