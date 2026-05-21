export type SceneGraphNodeId = string;

export type SceneGraphDropPlacement = 'inside' | 'before' | 'after';

export interface SceneGraphTreeItem {
  id: SceneGraphNodeId;
  label: string;
  parentId?: SceneGraphNodeId | null;
  depth?: number;
  selectable?: boolean;
  locked?: boolean;
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
  if (dragged.locked) return invalidSceneGraphIntent('dragged-node-locked');
  if (dragged.draggable === false) return invalidSceneGraphIntent('dragged-node-readonly');
  const target = findSceneGraphItem(items, intent.targetId);
  if (!target) return invalidSceneGraphIntent('missing-target-node');
  if (target.locked) return invalidSceneGraphIntent('target-node-locked');
  if (intent.draggedId === intent.targetId) return invalidSceneGraphIntent('cannot-parent-to-self');
  if (intent.placement === 'inside' && target.canHaveChildren === false) {
    return invalidSceneGraphIntent('target-cannot-have-children');
  }
  if (isSceneGraphDescendant(items, intent.targetId, intent.draggedId)) {
    return invalidSceneGraphIntent('cannot-parent-to-descendant');
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

function validSceneGraphIntent(): SceneGraphValidationResult {
  return { ok: true };
}

function invalidSceneGraphIntent(reason: string): SceneGraphValidationResult {
  return { ok: false, reason };
}
