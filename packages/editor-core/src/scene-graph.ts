export type SceneGraphNodeId = string;

export type SceneGraphNodeRole = 'root' | 'group' | 'object';

export type SceneGraphDropPlacement = 'inside' | 'before' | 'after';

export type SceneGraphMovePlacement = SceneGraphDropPlacement | 'root';

export type SceneGraphGroupPivot = 'selection-center' | 'active' | 'parent-origin';

export interface SceneGraphTreeItem {
  id: SceneGraphNodeId;
  label: string;
  parentId?: SceneGraphNodeId | null;
  depth?: number;
  role?: SceneGraphNodeRole;
  selectable?: boolean;
  locked?: boolean;
  protected?: boolean;
  canHaveChildren?: boolean;
  renamable?: boolean;
  deletable?: boolean;
  draggable?: boolean;
}

export interface SceneGraphDropIntent {
  draggedId: SceneGraphNodeId;
  targetId: SceneGraphNodeId;
  placement: SceneGraphDropPlacement;
  preserveWorldTransform?: boolean;
}

export interface SceneGraphMoveIntent {
  ids: SceneGraphNodeId[];
  targetId?: SceneGraphNodeId | null;
  placement: SceneGraphMovePlacement;
  parentId?: SceneGraphNodeId | null;
  beforeId?: SceneGraphNodeId | null;
  afterId?: SceneGraphNodeId | null;
  preserveWorldTransform?: boolean;
}

export interface SceneGraphGroupSelectionIntent {
  ids: SceneGraphNodeId[];
  parentId?: SceneGraphNodeId | null;
  insertBeforeId?: SceneGraphNodeId | null;
  name?: string;
  pivot?: SceneGraphGroupPivot;
  preserveWorldTransform?: boolean;
}

export interface SceneGraphRenameIntent {
  id: SceneGraphNodeId;
  name: string;
}

export interface SceneGraphCreateGroupIntent {
  parentId?: SceneGraphNodeId | null;
  activeId?: SceneGraphNodeId | null;
  name?: string;
}

export interface SceneGraphDeleteIntent {
  ids: SceneGraphNodeId[];
  activeId?: SceneGraphNodeId | null;
}

export interface SceneGraphValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateSceneGraphRename(
  items: readonly SceneGraphTreeItem[],
  intent: SceneGraphRenameIntent,
): SceneGraphValidationResult {
  const item = findSceneGraphItem(items, intent.id);
  if (!item) return invalidSceneGraphIntent('missing-node');
  if (item.protected) return invalidSceneGraphIntent('node-protected');
  if (item.locked) return invalidSceneGraphIntent('node-locked');
  if (item.renamable === false) return invalidSceneGraphIntent('node-readonly');
  if (!intent.name.trim()) return invalidSceneGraphIntent('empty-name');
  return validSceneGraphIntent();
}

export function validateSceneGraphDelete(
  items: readonly SceneGraphTreeItem[],
  intent: SceneGraphDeleteIntent,
): SceneGraphValidationResult {
  if (intent.ids.length === 0) return invalidSceneGraphIntent('empty-selection');
  for (const id of uniqueSceneGraphNodeIds(intent.ids)) {
    const item = findSceneGraphItem(items, id);
    if (!item) return invalidSceneGraphIntent('missing-node');
    if (item.protected) return invalidSceneGraphIntent('node-protected');
    if (item.locked) return invalidSceneGraphIntent('node-locked');
    if (item.deletable === false) return invalidSceneGraphIntent('node-readonly');
  }
  return validSceneGraphIntent();
}

export function validateSceneGraphDrop(
  items: readonly SceneGraphTreeItem[],
  intent: SceneGraphDropIntent,
): SceneGraphValidationResult {
  const dragged = findSceneGraphItem(items, intent.draggedId);
  if (!dragged) return invalidSceneGraphIntent('missing-dragged-node');
  if (dragged.protected) return invalidSceneGraphIntent('dragged-node-protected');
  if (dragged.locked) return invalidSceneGraphIntent('dragged-node-locked');
  if (dragged.draggable === false) return invalidSceneGraphIntent('dragged-node-readonly');
  const target = findSceneGraphItem(items, intent.targetId);
  if (!target) return invalidSceneGraphIntent('missing-target-node');
  if (target.locked && !target.protected) return invalidSceneGraphIntent('target-node-locked');
  if (intent.draggedId === intent.targetId) return invalidSceneGraphIntent('cannot-parent-to-self');
  if (intent.placement === 'inside' && !canSceneGraphItemHaveChildren(target)) {
    return invalidSceneGraphIntent('target-cannot-have-children');
  }
  if (intent.placement !== 'inside') {
    if (target.protected) return invalidSceneGraphIntent('cannot-reorder-root');
    const parent = findSceneGraphItem(items, target.parentId);
    if (parent?.locked && !parent.protected) return invalidSceneGraphIntent('target-parent-locked');
  }
  if (isSceneGraphDescendant(items, intent.targetId, intent.draggedId)) {
    return invalidSceneGraphIntent('cannot-parent-to-descendant');
  }
  return validSceneGraphIntent();
}

export function validateSceneGraphMove(
  items: readonly SceneGraphTreeItem[],
  intent: SceneGraphMoveIntent,
): SceneGraphValidationResult {
  const uniqueIds = uniqueSceneGraphNodeIds(intent.ids);
  if (uniqueIds.length === 0) return invalidSceneGraphIntent('empty-selection');
  for (const id of uniqueIds) {
    if (!findSceneGraphItem(items, id)) return invalidSceneGraphIntent('missing-node');
  }
  const ids = getTopLevelSceneGraphNodeIds(items, intent.ids);
  if (ids.length === 0) return invalidSceneGraphIntent('empty-selection');
  for (const id of ids) {
    const item = findSceneGraphItem(items, id);
    if (!item) return invalidSceneGraphIntent('missing-node');
    if (!isSceneGraphItemMovable(item)) return invalidSceneGraphIntent(item.protected ? 'node-protected' : item.locked ? 'node-locked' : 'node-readonly');
  }
  if (intent.placement === 'root') {
    if (intent.parentId != null || intent.beforeId != null || intent.afterId != null) return invalidSceneGraphIntent('invalid-root-anchors');
    return validSceneGraphIntent();
  }
  const target = findSceneGraphItem(items, intent.targetId);
  if (!target) return invalidSceneGraphIntent('missing-target-node');
  if (ids.includes(target.id)) return invalidSceneGraphIntent('cannot-parent-to-self');
  if (ids.some(id => isSceneGraphDescendant(items, target.id, id))) return invalidSceneGraphIntent('cannot-parent-to-descendant');
  if (intent.placement === 'inside') {
    if (!canSceneGraphItemHaveChildren(target)) return invalidSceneGraphIntent('target-cannot-have-children');
    if (intent.parentId != null && intent.parentId !== target.id) return invalidSceneGraphIntent('invalid-parent-anchor');
    const parentChildren = getSceneGraphChildIds(items, target.id).filter(id => !ids.includes(id));
    if (intent.beforeId && !parentChildren.includes(intent.beforeId)) return invalidSceneGraphIntent('invalid-before-anchor');
    if (intent.afterId && !parentChildren.includes(intent.afterId)) return invalidSceneGraphIntent('invalid-after-anchor');
    return validSceneGraphIntent();
  }
  if (target.locked && !target.protected) return invalidSceneGraphIntent('target-node-locked');
  if (target.protected) return invalidSceneGraphIntent('cannot-reorder-root');
  const parent = findSceneGraphItem(items, target.parentId);
  if (parent?.locked && !parent.protected) return invalidSceneGraphIntent('target-parent-locked');
  if ((intent.parentId ?? null) !== (target.parentId ?? null)) return invalidSceneGraphIntent('invalid-parent-anchor');
  const siblings = getSceneGraphChildIds(items, target.parentId ?? null).filter(id => !ids.includes(id));
  if (intent.beforeId && !siblings.includes(intent.beforeId)) return invalidSceneGraphIntent('invalid-before-anchor');
  if (intent.afterId && !siblings.includes(intent.afterId)) return invalidSceneGraphIntent('invalid-after-anchor');
  if (intent.placement === 'before' && intent.beforeId !== target.id) return invalidSceneGraphIntent('invalid-before-anchor');
  if (intent.placement === 'after' && intent.afterId !== target.id) return invalidSceneGraphIntent('invalid-after-anchor');
  return validSceneGraphIntent();
}

export function validateSceneGraphGroupSelection(
  items: readonly SceneGraphTreeItem[],
  intent: SceneGraphGroupSelectionIntent,
): SceneGraphValidationResult {
  const uniqueIds = uniqueSceneGraphNodeIds(intent.ids);
  if (uniqueIds.length === 0) return invalidSceneGraphIntent('empty-selection');
  for (const id of uniqueIds) {
    if (!findSceneGraphItem(items, id)) return invalidSceneGraphIntent('missing-node');
  }
  const ids = getTopLevelSceneGraphNodeIds(items, intent.ids);
  if (ids.length === 0) return invalidSceneGraphIntent('empty-selection');
  for (const id of ids) {
    const item = findSceneGraphItem(items, id);
    if (!item) return invalidSceneGraphIntent('missing-node');
    if (!isSceneGraphItemMovable(item)) return invalidSceneGraphIntent(item.protected ? 'node-protected' : item.locked ? 'node-locked' : 'node-readonly');
  }
  const parent = findSceneGraphItem(items, intent.parentId);
  if (intent.parentId && !parent) return invalidSceneGraphIntent('missing-parent-node');
  if (parent && !canSceneGraphItemHaveChildren(parent)) return invalidSceneGraphIntent('parent-cannot-have-children');
  if (parent && ids.some(id => parent.id === id || isSceneGraphDescendant(items, parent.id, id))) {
    return invalidSceneGraphIntent('cannot-parent-to-descendant');
  }
  const siblings = getSceneGraphChildIds(items, intent.parentId ?? null).filter(id => !ids.includes(id));
  if (intent.insertBeforeId) {
    const before = findSceneGraphItem(items, intent.insertBeforeId);
    if (!siblings.includes(intent.insertBeforeId) || before?.protected) return invalidSceneGraphIntent('invalid-before-anchor');
  }
  return validSceneGraphIntent();
}

export function findSceneGraphItem(
  items: readonly SceneGraphTreeItem[],
  id: SceneGraphNodeId | null | undefined,
): SceneGraphTreeItem | null {
  if (!id) return null;
  return items.find(item => item.id === id) ?? null;
}

export function uniqueSceneGraphNodeIds(ids: readonly SceneGraphNodeId[]): SceneGraphNodeId[] {
  const result: SceneGraphNodeId[] = [];
  const seen = new Set<SceneGraphNodeId>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function getTopLevelSceneGraphNodeIds(
  items: readonly SceneGraphTreeItem[],
  ids: readonly SceneGraphNodeId[],
): SceneGraphNodeId[] {
  const uniqueIds = uniqueSceneGraphNodeIds(ids).filter(id => !!findSceneGraphItem(items, id));
  const selected = new Set(uniqueIds);
  return uniqueIds.filter(id => !collectSceneGraphAncestorIds(items, id).some(ancestorId => selected.has(ancestorId)));
}

export function getSceneGraphChildIds(
  items: readonly SceneGraphTreeItem[],
  parentId: SceneGraphNodeId | null | undefined,
): SceneGraphNodeId[] {
  return items
    .filter(item => (item.parentId ?? null) === (parentId ?? null))
    .map(item => item.id);
}

export function isSceneGraphDescendant(
  items: readonly SceneGraphTreeItem[],
  candidateId: SceneGraphNodeId,
  ancestorId: SceneGraphNodeId,
): boolean {
  const byId = new Map(items.map(item => [item.id, item]));
  let cursor = byId.get(candidateId) ?? null;
  const visited = new Set<SceneGraphNodeId>();
  while (cursor?.parentId) {
    if (cursor.parentId === ancestorId) return true;
    if (visited.has(cursor.parentId)) return false;
    visited.add(cursor.parentId);
    cursor = byId.get(cursor.parentId) ?? null;
  }
  return false;
}

export function canSceneGraphItemHaveChildren(item: SceneGraphTreeItem | null | undefined): boolean {
  if (!item) return false;
  if (item.locked && !item.protected) return false;
  return item.canHaveChildren === true;
}

export function isSceneGraphItemMovable(item: SceneGraphTreeItem | null | undefined): boolean {
  return !!item && item.protected !== true && item.locked !== true && item.draggable !== false;
}

function collectSceneGraphAncestorIds(
  items: readonly SceneGraphTreeItem[],
  id: SceneGraphNodeId,
): SceneGraphNodeId[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const ancestors: SceneGraphNodeId[] = [];
  const visited = new Set<SceneGraphNodeId>();
  let cursor = byId.get(id) ?? null;
  while (cursor?.parentId && !visited.has(cursor.parentId)) {
    visited.add(cursor.parentId);
    ancestors.push(cursor.parentId);
    cursor = byId.get(cursor.parentId) ?? null;
  }
  return ancestors;
}

function validSceneGraphIntent(): SceneGraphValidationResult {
  return { ok: true };
}

function invalidSceneGraphIntent(reason: string): SceneGraphValidationResult {
  return { ok: false, reason };
}
