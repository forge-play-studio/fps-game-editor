import type { SelectionCommand } from '@fps-games/editor-core';
import type {
  LocalEditorBrowserHierarchyContextActionContext,
  LocalEditorBrowserHierarchyContextActionPlacement,
  LocalEditorBrowserHierarchyContextActionRegistration,
  LocalEditorBrowserPrimitiveShape,
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

const HIERARCHY_PRIMITIVE_SHAPES: Array<{ shape: LocalEditorBrowserPrimitiveShape; label: string }> = [
  { shape: 'cube', label: 'Cube' },
  { shape: 'sphere', label: 'Sphere' },
  { shape: 'plane', label: 'Plane' },
  { shape: 'capsule', label: 'Capsule' },
];

export type LocalEditorHierarchyAction =
  | { kind: 'context-action'; action: LocalEditorContextAction }
  | { kind: 'begin-rename'; targetId: string }
  | { kind: 'copy-selection'; targetIds: string[]; activeId: string | null }
  | { kind: 'group-selection'; intent: LocalEditorBrowserSceneGraphGroupSelectionIntent }
  | { kind: 'selection-command'; command: SelectionCommand };

export interface LocalEditorHierarchyMenuDefinition {
  items: LocalEditorContextMenuItem[];
  actions: ReadonlyMap<string, LocalEditorHierarchyAction>;
}

export interface LocalEditorHierarchyActionInput<TDocument = unknown> {
  state: LocalEditorBrowserUiState<TDocument>;
  model: LocalEditorHierarchyTreeModel;
  node?: LocalEditorHierarchyTreeNode | null;
  clipboardIds?: readonly string[] | null;
  clipboardActiveId?: string | null;
  hasDuplicateHandler?: boolean;
  hasGroupSelectionHandler?: boolean;
  contextActions?: readonly LocalEditorBrowserHierarchyContextActionRegistration<TDocument>[];
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
  const duplicateDisabledReason = getDuplicateDisabledReason(input, targetIds);
  const pasteDisabledReason = getPasteDisabledReason(input);
  const deleteDisabledReason = getDeleteDisabledReason(model, targetIds);
  const groupSelection = createGroupSelectionAction(input, topLevelSelection);
  const actions = new Map<string, LocalEditorHierarchyAction>();
  const context = createContextActionContext(input, 'node', node.item, targetIds, activeId);

  actions.set('hierarchy.focus', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'focus', targetIds, activeId },
  });
  actions.set('hierarchy.rename', { kind: 'begin-rename', targetId: node.id });
  actions.set('hierarchy.create-child-group', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'create-group', parentId: node.id, activeId },
  });
  addPrimitiveActions(actions, 'hierarchy.create-child-primitive', node.id, activeId);
  if (groupSelection.action) actions.set('hierarchy.group-selection', groupSelection.action);
  actions.set('hierarchy.delete', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'delete', targetIds, activeId },
  });
  actions.set('hierarchy.duplicate', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'duplicate', targetIds, activeId },
  });
  actions.set('hierarchy.copy', {
    kind: 'copy-selection',
    targetIds,
    activeId,
  });
  actions.set('hierarchy.paste', {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'paste',
      sourceIds: normalizeActionIds(input.clipboardIds ?? []),
      activeId: resolveActionActiveId(input.clipboardIds ?? [], input.clipboardActiveId),
    },
  });
  const customItems = addCustomContextActions(actions, input.contextActions, context);

  return {
    actions,
    items: composeMenuItems({
      top: customItems.top,
      primary: [
        menuItem('hierarchy.focus', 'Focus in Preview', { shortcut: 'F', disabled: !selectable, disabledReason: 'Protected or locked nodes cannot be focused from Hierarchy.' }),
      ],
      afterPrimary: customItems.afterPrimary,
      create: [
        menuItem('hierarchy.rename', 'Rename', { disabled: !canRename, disabledReason: 'This node is protected or read-only.' }),
        menuItem('hierarchy.create-child-group', 'Add Empty', {
          disabled: !canCreateChildGroup,
          disabledReason: 'This node cannot contain children.',
        }),
        primitiveItemGroup('hierarchy.create-child-primitive', 'Add', {
          disabled: !canCreateChildGroup,
          disabledReason: 'This node cannot contain children.',
        }),
      ],
      afterCreate: customItems.afterCreate,
      edit: [
        menuItem('hierarchy.group-selection', 'Parent Selection', {
          disabled: groupSelection.disabled,
          disabledReason: groupSelection.disabledReason,
        }),
        menuItem('hierarchy.delete', 'Delete', {
          shortcut: 'Delete',
          danger: true,
          disabled: !!deleteDisabledReason,
          disabledReason: deleteDisabledReason,
        }),
      ],
      afterEdit: customItems.afterEdit,
      clipboard: clipboardItems(duplicateDisabledReason, pasteDisabledReason),
      afterClipboard: customItems.afterClipboard,
      bottom: [
        ...customItems.bottom,
        ...placeholderItems(),
      ],
    }),
  };
}

export function createLocalEditorHierarchyBlankMenu<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyMenuDefinition {
  const groupSelection = createGroupSelectionAction(input, input.model.getTopLevelSelection(input.state.selectedIds));
  const targetIds = input.state.selectedIds;
  const activeId = input.state.activeId && targetIds.includes(input.state.activeId)
    ? input.state.activeId
    : targetIds[targetIds.length - 1] ?? null;
  const duplicateDisabledReason = getDuplicateDisabledReason(input, targetIds);
  const pasteDisabledReason = getPasteDisabledReason(input);
  const actions = new Map<string, LocalEditorHierarchyAction>();
  const context = createContextActionContext(input, 'blank', null, targetIds, activeId);
  actions.set('hierarchy.create-group', {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'create-group',
      parentId: null,
      activeId: input.state.activeId,
    },
  });
  addPrimitiveActions(actions, 'hierarchy.create-primitive', null, input.state.activeId);
  if (groupSelection.action) actions.set('hierarchy.group-selection', groupSelection.action);
  actions.set('hierarchy.duplicate', {
    kind: 'context-action',
    action: { region: 'hierarchy', action: 'duplicate', targetIds, activeId },
  });
  actions.set('hierarchy.copy', {
    kind: 'copy-selection',
    targetIds,
    activeId,
  });
  actions.set('hierarchy.paste', {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'paste',
      sourceIds: normalizeActionIds(input.clipboardIds ?? []),
      activeId: resolveActionActiveId(input.clipboardIds ?? [], input.clipboardActiveId),
    },
  });
  const customItems = addCustomContextActions(actions, input.contextActions, context);
  return {
    actions,
    items: composeMenuItems({
      top: customItems.top,
      primary: [],
      afterPrimary: customItems.afterPrimary,
      create: [
        menuItem('hierarchy.create-group', 'Create Empty'),
        primitiveItemGroup('hierarchy.create-primitive', 'Create'),
      ],
      afterCreate: customItems.afterCreate,
      edit: [
        menuItem('hierarchy.group-selection', 'Parent Selection', {
          disabled: groupSelection.disabled,
          disabledReason: groupSelection.disabledReason,
        }),
      ],
      afterEdit: customItems.afterEdit,
      clipboard: clipboardItems(duplicateDisabledReason, pasteDisabledReason),
      afterClipboard: customItems.afterClipboard,
      bottom: [
        ...customItems.bottom,
        ...placeholderItems(),
      ],
    }),
  };
}

export function createLocalEditorHierarchyDuplicateShortcutAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyAction | null {
  const targetIds = input.state.selectedIds;
  const disabledReason = getDuplicateDisabledReason(input, targetIds);
  if (disabledReason) return null;
  return {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'duplicate',
      targetIds: normalizeActionIds(targetIds),
      activeId: resolveActionActiveId(targetIds, input.state.activeId),
    },
  };
}

export function createLocalEditorHierarchyCopyShortcutAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyAction | null {
  const targetIds = input.state.selectedIds;
  const disabledReason = getDuplicateDisabledReason(input, targetIds);
  if (disabledReason) return null;
  return {
    kind: 'copy-selection',
    targetIds: normalizeActionIds(targetIds),
    activeId: resolveActionActiveId(targetIds, input.state.activeId),
  };
}

export function createLocalEditorHierarchyPasteShortcutAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyAction | null {
  const disabledReason = getPasteDisabledReason(input);
  if (disabledReason) return null;
  const sourceIds = normalizeActionIds(input.clipboardIds ?? []);
  return {
    kind: 'context-action',
    action: {
      region: 'hierarchy',
      action: 'paste',
      sourceIds,
      activeId: resolveActionActiveId(sourceIds, input.clipboardActiveId),
    },
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

export function createLocalEditorHierarchySelectAllShortcutAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
): LocalEditorHierarchyAction | null {
  const selectedIds = input.model.visibleRows
    .filter(isNodeSelectable)
    .map(node => node.id);
  if (selectedIds.length === 0) return null;
  return {
    kind: 'selection-command',
    command: {
      type: 'selection.replace',
      label: 'Select All Visible Hierarchy Nodes',
      selectedIds,
      activeId: resolveActionActiveId(selectedIds, input.state.activeId),
    },
  };
}

type LocalEditorHierarchyMenuItemSlots = Record<
  'top' | 'primary' | 'afterPrimary' | 'create' | 'afterCreate' | 'edit' | 'afterEdit' | 'clipboard' | 'afterClipboard' | 'bottom',
  LocalEditorContextMenuItem[]
>;

function createContextActionContext<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
  menuKind: 'node' | 'blank',
  node: LocalEditorBrowserHierarchyContextActionContext<TDocument>['node'],
  targetIds: string[],
  activeId: string | null,
): LocalEditorBrowserHierarchyContextActionContext<TDocument> {
  return {
    state: input.state,
    menuKind,
    node,
    contextNodeId: node?.id ?? null,
    targetIds,
    activeId,
  };
}

function addCustomContextActions<TDocument>(
  actions: Map<string, LocalEditorHierarchyAction>,
  registrations: readonly LocalEditorBrowserHierarchyContextActionRegistration<TDocument>[] | undefined,
  context: LocalEditorBrowserHierarchyContextActionContext<TDocument>,
): Omit<LocalEditorHierarchyMenuItemSlots, 'primary' | 'create' | 'edit' | 'clipboard'> {
  const slots = {
    top: [] as LocalEditorContextMenuItem[],
    afterPrimary: [] as LocalEditorContextMenuItem[],
    afterCreate: [] as LocalEditorContextMenuItem[],
    afterEdit: [] as LocalEditorContextMenuItem[],
    afterClipboard: [] as LocalEditorContextMenuItem[],
    bottom: [] as LocalEditorContextMenuItem[],
  };
  for (const registration of registrations ?? []) {
    if (!registration.id || registration.visible?.(context) === false) continue;
    const actionId = `hierarchy.custom.${registration.id}`;
    const disabled = registration.disabled?.(context);
    actions.set(actionId, {
      kind: 'context-action',
      action: {
        region: 'hierarchy',
        action: 'custom',
        id: registration.id,
        contextNodeId: context.contextNodeId,
        targetIds: normalizeActionIds(context.targetIds),
        activeId: context.activeId,
        payload: registration.payload?.(context),
      },
    });
    const item = menuItem(actionId, registration.label, {
      shortcut: registration.shortcut,
      danger: registration.danger,
      disabled: disabled === true || typeof disabled === 'string',
      disabledReason: typeof disabled === 'string' ? disabled : undefined,
      separatorBefore: registration.separatorBefore,
    });
    getCustomContextActionSlot(slots, registration.placement).push(item);
  }
  return slots;
}

function getCustomContextActionSlot(
  slots: Omit<LocalEditorHierarchyMenuItemSlots, 'primary' | 'create' | 'edit' | 'clipboard'>,
  placement: LocalEditorBrowserHierarchyContextActionPlacement | undefined,
): LocalEditorContextMenuItem[] {
  if (placement === 'top') return slots.top;
  if (placement === 'after-primary') return slots.afterPrimary;
  if (placement === 'after-create') return slots.afterCreate;
  if (placement === 'after-edit') return slots.afterEdit;
  if (placement === 'after-clipboard') return slots.afterClipboard;
  return slots.bottom;
}

function composeMenuItems(slots: LocalEditorHierarchyMenuItemSlots): LocalEditorContextMenuItem[] {
  return [
    ...slots.top,
    ...slots.primary,
    ...slots.afterPrimary,
    ...slots.create,
    ...slots.afterCreate,
    ...slots.edit,
    ...slots.afterEdit,
    ...slots.clipboard,
    ...slots.afterClipboard,
    ...slots.bottom,
  ];
}

function getDuplicateDisabledReason<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
  ids: readonly string[],
): string | undefined {
  if (!input.hasDuplicateHandler) return 'Duplicate pipeline is not connected yet.';
  const targetIds = normalizeActionIds(ids);
  if (targetIds.length === 0) return 'Select one or more movable nodes first.';
  for (const id of targetIds) {
    const node = input.model.getNode(id);
    if (!node) return 'The selected node no longer exists.';
    if (!isLocalEditorHierarchyNodeMovable(node)) return getNodeMutationDisabledReason(node, 'duplicated');
  }
  return undefined;
}

function getPasteDisabledReason<TDocument>(input: LocalEditorHierarchyActionInput<TDocument>): string | undefined {
  const ids = input.clipboardIds ?? [];
  if (normalizeActionIds(ids).length === 0) return 'Copy one or more movable nodes first.';
  return getDuplicateDisabledReason(input, ids);
}

function createGroupSelectionAction<TDocument>(
  input: LocalEditorHierarchyActionInput<TDocument>,
  ids: string[],
): { disabled: boolean; disabledReason?: string; action?: LocalEditorHierarchyAction } {
  if (!input.hasGroupSelectionHandler) {
    return { disabled: true, disabledReason: 'Parent Selection pipeline is not connected yet.' };
  }
  if (ids.length === 0) return { disabled: true, disabledReason: 'Select one or more movable nodes first.' };
  if (ids.some(id => !isLocalEditorHierarchyNodeMovable(input.model.getNode(id)))) {
    return { disabled: true, disabledReason: 'Protected or locked nodes cannot be parented.' };
  }
  const parentId = resolveCommonParentId(input.model, ids);
  return {
    disabled: false,
    action: {
      kind: 'group-selection',
      intent: {
        ids,
        parentId,
        name: 'Parent',
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

function getNodeMutationDisabledReason(node: LocalEditorHierarchyTreeNode, verb: string): string {
  if (node.protected) return `Protected nodes cannot be ${verb}.`;
  if (node.item.locked) return `Locked nodes cannot be ${verb}.`;
  return 'This node is read-only.';
}

function normalizeActionIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function resolveActionActiveId(ids: readonly string[], activeId: string | null | undefined): string | null {
  const normalized = normalizeActionIds(ids);
  return activeId && normalized.includes(activeId) ? activeId : normalized[normalized.length - 1] ?? null;
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

function addPrimitiveActions(
  actions: Map<string, LocalEditorHierarchyAction>,
  prefix: string,
  parentId: string | null,
  activeId: string | null,
): void {
  for (const primitive of HIERARCHY_PRIMITIVE_SHAPES) {
    actions.set(`${prefix}.${primitive.shape}`, {
      kind: 'context-action',
      action: {
        region: 'hierarchy',
        action: 'create-primitive',
        parentId,
        activeId,
        shape: primitive.shape,
        name: primitive.label,
      },
    });
  }
}

function primitiveItemGroup(
  prefix: string,
  verb: 'Add' | 'Create',
  options: Partial<LocalEditorContextMenuItem> = {},
): LocalEditorContextMenuItem {
  return menuItem(`${prefix}.group`, `${verb} Primitive`, {
    separatorBefore: true,
    children: HIERARCHY_PRIMITIVE_SHAPES.map((primitive) => menuItem(
      `${prefix}.${primitive.shape}`,
      primitive.label,
      options,
    )),
  });
}

function clipboardItems(
  duplicateDisabledReason: string | undefined,
  pasteDisabledReason: string | undefined,
): LocalEditorContextMenuItem[] {
  return [
    menuItem('hierarchy.duplicate', 'Duplicate', {
      shortcut: 'Cmd/Ctrl+D',
      disabled: !!duplicateDisabledReason,
      disabledReason: duplicateDisabledReason,
      separatorBefore: true,
    }),
    menuItem('hierarchy.copy', 'Copy', {
      shortcut: 'Cmd/Ctrl+C',
      disabled: !!duplicateDisabledReason,
      disabledReason: duplicateDisabledReason,
    }),
    menuItem('hierarchy.paste', 'Paste', {
      shortcut: 'Cmd/Ctrl+V',
      disabled: !!pasteDisabledReason,
      disabledReason: pasteDisabledReason,
    }),
  ];
}

function placeholderItems(): LocalEditorContextMenuItem[] {
  return [
    menuItem('hierarchy.copy-transform', 'Copy Transform', { disabled: true, disabledReason: 'Copy Transform is not implemented yet.', separatorBefore: true }),
    menuItem('hierarchy.paste-transform', 'Paste Transform', { disabled: true, disabledReason: 'Paste Transform is not implemented yet.' }),
    menuItem('hierarchy.locked', 'Locked', { disabled: true, disabledReason: 'Lock editing is not implemented yet.', separatorBefore: true }),
    menuItem('hierarchy.do-not-serialize', 'Do Not Serialize', { disabled: true, disabledReason: 'Serialization flags are not implemented yet.' }),
  ];
}
