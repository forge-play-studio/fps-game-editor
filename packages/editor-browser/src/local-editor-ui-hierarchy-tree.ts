import type { LocalEditorBrowserUiHierarchyItem } from './local-editor-ui-types';

export type LocalEditorHierarchyNodeRole = 'root' | 'group' | 'object';
export type LocalEditorHierarchyDropPlacement = 'inside' | 'before' | 'after' | 'root';

export interface LocalEditorHierarchyTreeOptions {
  expandedIds?: ReadonlySet<string> | readonly string[];
  collapsedIds?: ReadonlySet<string> | readonly string[];
  defaultExpanded?: boolean;
}

export interface LocalEditorHierarchyTreeNode {
  id: string;
  label: string;
  item: LocalEditorBrowserUiHierarchyItem;
  parentId: string | null;
  childIds: string[];
  depth: number;
  siblingIndex: number;
  inputIndex: number;
  role: LocalEditorHierarchyNodeRole;
  protected: boolean;
  selected: boolean;
  active: boolean;
  expanded: boolean;
  visible: boolean;
}

export interface LocalEditorHierarchyDropResolution {
  ok: boolean;
  reason?: string;
  placement: LocalEditorHierarchyDropPlacement;
  draggedIds: string[];
  targetId: string | null;
  parentId: string | null;
  beforeId: string | null;
  afterId: string | null;
}

export interface LocalEditorHierarchyDropInput {
  draggedIds: readonly string[];
  targetId?: string | null;
  placement: LocalEditorHierarchyDropPlacement;
}

export interface LocalEditorHierarchyTreeModel {
  readonly nodes: LocalEditorHierarchyTreeNode[];
  readonly visibleRows: LocalEditorHierarchyTreeNode[];
  readonly rootIds: string[];
  readonly byId: ReadonlyMap<string, LocalEditorHierarchyTreeNode>;
  readonly childrenByParentId: ReadonlyMap<string | null, string[]>;
  getNode(id: string | null | undefined): LocalEditorHierarchyTreeNode | null;
  getChildren(parentId: string | null | undefined): LocalEditorHierarchyTreeNode[];
  getAncestors(id: string | null | undefined): LocalEditorHierarchyTreeNode[];
  isDescendant(candidateId: string, ancestorId: string): boolean;
  getTopLevelSelection(ids: readonly string[]): string[];
  resolveDrop(input: LocalEditorHierarchyDropInput): LocalEditorHierarchyDropResolution;
}

export function createLocalEditorHierarchyTreeModel(
  items: readonly LocalEditorBrowserUiHierarchyItem[],
  selectedIds: readonly string[] = [],
  activeId: string | null = null,
  options: LocalEditorHierarchyTreeOptions = {},
): LocalEditorHierarchyTreeModel {
  const selected = new Set(selectedIds);
  const byRawId = new Map(items.map((item, inputIndex) => [item.id, { item, inputIndex }]));
  const childrenByParentId = new Map<string | null, string[]>();
  const provisionalNodes = new Map<string, Omit<LocalEditorHierarchyTreeNode, 'childIds' | 'depth' | 'siblingIndex' | 'expanded' | 'visible'>>();

  for (const { item, inputIndex } of byRawId.values()) {
    const parentId = item.parentId && byRawId.has(item.parentId) ? item.parentId : null;
    const role = resolveHierarchyNodeRole(item);
    provisionalNodes.set(item.id, {
      id: item.id,
      label: item.label,
      item,
      parentId,
      inputIndex,
      role,
      protected: item.protected === true,
      selected: selected.has(item.id),
      active: activeId === item.id,
    });
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(item.id);
    childrenByParentId.set(parentId, children);
  }

  for (const childIds of childrenByParentId.values()) {
    childIds.sort((a, b) => {
      const left = provisionalNodes.get(a);
      const right = provisionalNodes.get(b);
      return (left?.inputIndex ?? 0) - (right?.inputIndex ?? 0);
    });
  }

  const expanded = normalizeIdSet(options.expandedIds);
  const collapsed = normalizeIdSet(options.collapsedIds);
  const defaultExpanded = options.defaultExpanded ?? true;
  const nodesById = new Map<string, LocalEditorHierarchyTreeNode>();
  const visibleRows: LocalEditorHierarchyTreeNode[] = [];
  const visited = new Set<string>();

  const appendNode = (id: string, depth: number, visible: boolean): void => {
    if (visited.has(id)) return;
    const provisional = provisionalNodes.get(id);
    if (!provisional) return;
    visited.add(id);
    const childIds = childrenByParentId.get(id) ?? [];
    const parentChildren = childrenByParentId.get(provisional.parentId) ?? [];
    const nodeExpanded = childIds.length > 0 && (expanded.has(id) || (defaultExpanded && !collapsed.has(id)));
    const node: LocalEditorHierarchyTreeNode = {
      ...provisional,
      childIds: [...childIds],
      depth,
      siblingIndex: Math.max(0, parentChildren.indexOf(id)),
      expanded: nodeExpanded,
      visible,
    };
    nodesById.set(id, node);
    if (visible) visibleRows.push(node);
    for (const childId of childIds) appendNode(childId, depth + 1, visible && nodeExpanded);
  };

  const rootIds = [...(childrenByParentId.get(null) ?? [])];
  for (const rootId of rootIds) appendNode(rootId, 0, true);
  for (const id of provisionalNodes.keys()) {
    if (visited.has(id)) continue;
    rootIds.push(id);
    appendNode(id, 0, true);
  }

  const nodes = [...nodesById.values()].sort((a, b) => a.inputIndex - b.inputIndex);
  return {
    nodes,
    visibleRows,
    rootIds,
    byId: nodesById,
    childrenByParentId,
    getNode(id) {
      return id ? nodesById.get(id) ?? null : null;
    },
    getChildren(parentId) {
      return (childrenByParentId.get(parentId ?? null) ?? [])
        .map(id => nodesById.get(id) ?? null)
        .filter((node): node is LocalEditorHierarchyTreeNode => !!node);
    },
    getAncestors(id) {
      const ancestors: LocalEditorHierarchyTreeNode[] = [];
      const seen = new Set<string>();
      let cursor = id ? nodesById.get(id) ?? null : null;
      while (cursor?.parentId && !seen.has(cursor.parentId)) {
        seen.add(cursor.parentId);
        cursor = nodesById.get(cursor.parentId) ?? null;
        if (cursor) ancestors.push(cursor);
      }
      return ancestors;
    },
    isDescendant(candidateId, ancestorId) {
      if (candidateId === ancestorId) return false;
      return this.getAncestors(candidateId).some(ancestor => ancestor.id === ancestorId);
    },
    getTopLevelSelection(ids) {
      const selectedIds = new Set(ids.filter(id => nodesById.has(id)));
      return ids.filter((id, index) => {
        if (!selectedIds.has(id) || ids.indexOf(id) !== index) return false;
        return !this.getAncestors(id).some(ancestor => selectedIds.has(ancestor.id));
      });
    },
    resolveDrop(input) {
      return resolveHierarchyDrop(nodesById, childrenByParentId, input, this.getTopLevelSelection.bind(this), this.isDescendant.bind(this));
    },
  };
}

export function isLocalEditorHierarchyNodeMovable(node: LocalEditorHierarchyTreeNode | null): boolean {
  return !!node
    && node.protected !== true
    && node.item.locked !== true
    && node.item.draggable !== false;
}

export function canLocalEditorHierarchyNodeHaveChildren(node: LocalEditorHierarchyTreeNode | null): boolean {
  if (!node) return false;
  if (node.item.locked === true && node.protected !== true) return false;
  return node.item.canHaveChildren === true;
}

function resolveHierarchyNodeRole(item: LocalEditorBrowserUiHierarchyItem): LocalEditorHierarchyNodeRole {
  if (item.role) return item.role;
  if (item.parentId == null && item.selectable === false) return 'root';
  if (item.canHaveChildren === true) return 'group';
  return 'object';
}

function normalizeIdSet(value: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  if (!value) return new Set<string>();
  return value instanceof Set ? value : new Set(value);
}

function resolveHierarchyDrop(
  nodesById: ReadonlyMap<string, LocalEditorHierarchyTreeNode>,
  childrenByParentId: ReadonlyMap<string | null, string[]>,
  input: LocalEditorHierarchyDropInput,
  getTopLevelSelection: (ids: readonly string[]) => string[],
  isDescendant: (candidateId: string, ancestorId: string) => boolean,
): LocalEditorHierarchyDropResolution {
  const draggedIds = getTopLevelSelection(input.draggedIds);
  if (draggedIds.length === 0) return invalidDrop(input, 'empty-drag');
  for (const id of draggedIds) {
    if (!isLocalEditorHierarchyNodeMovable(nodesById.get(id) ?? null)) return invalidDrop(input, 'dragged-node-protected');
  }
  if (input.placement === 'root') {
    return {
      ok: true,
      placement: 'root',
      draggedIds,
      targetId: null,
      parentId: null,
      beforeId: null,
      afterId: null,
    };
  }

  const targetId = input.targetId ?? null;
  const target = targetId ? nodesById.get(targetId) ?? null : null;
  if (!target) return invalidDrop(input, 'missing-target');
  if (draggedIds.includes(target.id)) return invalidDrop(input, 'cannot-drop-on-self');
  if (draggedIds.some(id => isDescendant(target.id, id))) return invalidDrop(input, 'cannot-drop-on-descendant');

  if (input.placement === 'inside') {
    if (!canLocalEditorHierarchyNodeHaveChildren(target)) return invalidDrop(input, 'target-cannot-have-children');
    const draggedSet = new Set(draggedIds);
    const children = (childrenByParentId.get(target.id) ?? []).filter(id => !draggedSet.has(id));
    return {
      ok: true,
      placement: 'inside',
      draggedIds,
      targetId: target.id,
      parentId: target.id,
      beforeId: null,
      afterId: children[children.length - 1] ?? null,
    };
  }

  if (target.role === 'root' || target.protected) return invalidDrop(input, 'cannot-reorder-root');
  if (target.item.locked === true) return invalidDrop(input, 'target-node-locked');
  const parent = target.parentId ? nodesById.get(target.parentId) ?? null : null;
  if (parent?.item.locked === true && parent.protected !== true) return invalidDrop(input, 'target-parent-locked');
  const draggedSet = new Set(draggedIds);
  const siblings = (childrenByParentId.get(target.parentId) ?? []).filter(id => !draggedSet.has(id));
  const targetIndex = siblings.indexOf(target.id);
  return {
    ok: true,
    placement: input.placement,
    draggedIds,
    targetId: target.id,
    parentId: target.parentId,
    beforeId: input.placement === 'before' ? target.id : siblings[targetIndex + 1] ?? null,
    afterId: input.placement === 'after' ? target.id : siblings[targetIndex - 1] ?? null,
  };
}

function invalidDrop(
  input: LocalEditorHierarchyDropInput,
  reason: string,
): LocalEditorHierarchyDropResolution {
  return {
    ok: false,
    reason,
    placement: input.placement,
    draggedIds: [],
    targetId: input.targetId ?? null,
    parentId: null,
    beforeId: null,
    afterId: null,
  };
}
