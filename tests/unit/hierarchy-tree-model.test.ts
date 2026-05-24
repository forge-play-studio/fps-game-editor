import { describe, expect, it } from 'vitest';
import {
  createLocalEditorHierarchyBlankMenu,
  createLocalEditorHierarchyCopyShortcutAction,
  createLocalEditorHierarchyNodeMenu,
  createLocalEditorHierarchyPasteShortcutAction,
  canLocalEditorHierarchyNodeHaveChildren,
  createLocalEditorHierarchyTreeModel,
  isLocalEditorHierarchyNodeMovable,
} from '@fps-games/editor-browser';
import {
  validateSceneGraphDelete,
  validateSceneGraphDrop,
  validateSceneGraphGroupSelection,
  validateSceneGraphMove,
  validateSceneGraphRename,
  type SceneGraphTreeItem,
} from '@fps-games/editor-core';

const hierarchy: SceneGraphTreeItem[] = [
  { id: 'root', label: 'Root', role: 'root', protected: true, selectable: false, canHaveChildren: true, renamable: false, deletable: false, draggable: false },
  { id: 'visual_root_peer', label: 'Visual Root Peer', role: 'root', parentId: null, protected: false, canHaveChildren: true },
  { id: 'group_a', label: 'Group A', parentId: 'root', role: 'group', canHaveChildren: true },
  { id: 'box', label: 'Box', parentId: 'group_a', role: 'object', canHaveChildren: false },
  { id: 'sphere', label: 'Sphere', parentId: 'group_a', role: 'object', canHaveChildren: false },
  { id: 'socket', label: 'Socket Object', parentId: 'group_a', role: 'object', canHaveChildren: true },
  { id: 'socket_child', label: 'Socket Child', parentId: 'socket', role: 'object', canHaveChildren: false },
  { id: 'group_b', label: 'Group B', parentId: 'root', role: 'group', canHaveChildren: true },
  { id: 'label_group', label: 'Visual Group Label', parentId: 'root', role: 'group', canHaveChildren: false },
  { id: 'locked_group', label: 'Locked Group', parentId: 'root', role: 'group', locked: true, canHaveChildren: true },
  { id: 'locked_child', label: 'Locked Child', parentId: 'locked_group', role: 'object' },
];

describe('local editor hierarchy tree model', () => {
  it('normalizes flat hierarchy items into indexed visible tree rows', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy, ['box'], 'box');

    expect(model.rootIds).toEqual(['root', 'visual_root_peer']);
    expect(model.visibleRows.map(row => [row.id, row.depth])).toEqual([
      ['root', 0],
      ['group_a', 1],
      ['box', 2],
      ['sphere', 2],
      ['socket', 2],
      ['socket_child', 3],
      ['group_b', 1],
      ['label_group', 1],
      ['locked_group', 1],
      ['locked_child', 2],
      ['visual_root_peer', 0],
    ]);
    expect(model.getChildren('group_a').map(node => node.id)).toEqual(['box', 'sphere', 'socket']);
    expect(model.getAncestors('box').map(node => node.id)).toEqual(['group_a', 'root']);
    expect(model.isDescendant('box', 'root')).toBe(true);
    expect(model.getNode('root')).toMatchObject({ role: 'root', protected: true, selected: false });
    expect(model.getNode('box')).toMatchObject({ role: 'object', selected: true, active: true });
  });

  it('supports collapsed visible rows without mutating the normalized tree', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy, [], null, { collapsedIds: ['group_a'] });

    expect(model.nodes.map(node => node.id)).toContain('box');
    expect(model.visibleRows.map(row => row.id)).toEqual(['root', 'group_a', 'group_b', 'label_group', 'locked_group', 'locked_child', 'visual_root_peer']);
    expect(model.getNode('group_a')).toMatchObject({ expanded: false });
  });

  it('uses explicit canHaveChildren capability instead of role to decide container behavior', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy);
    const root = model.getNode('root');
    const group = model.getNode('group_a');
    const box = model.getNode('box');
    const socket = model.getNode('socket');
    const labelGroup = model.getNode('label_group');

    expect(canLocalEditorHierarchyNodeHaveChildren(root)).toBe(true);
    expect(isLocalEditorHierarchyNodeMovable(root)).toBe(false);
    expect(canLocalEditorHierarchyNodeHaveChildren(group)).toBe(true);
    expect(isLocalEditorHierarchyNodeMovable(group)).toBe(true);
    expect(canLocalEditorHierarchyNodeHaveChildren(box)).toBe(false);
    expect(canLocalEditorHierarchyNodeHaveChildren(socket)).toBe(true);
    expect(socket).toMatchObject({ role: 'object' });
    expect(canLocalEditorHierarchyNodeHaveChildren(labelGroup)).toBe(false);
    expect(labelGroup).toMatchObject({ role: 'group' });
  });

  it('filters top-level selection and resolves complete drop targets', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy);

    expect(model.getTopLevelSelection(['group_a', 'box', 'sphere'])).toEqual(['group_a']);
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'group_b', placement: 'inside' })).toMatchObject({
      ok: true,
      draggedIds: ['box'],
      parentId: 'group_b',
      beforeId: null,
      afterId: null,
    });
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'sphere', placement: 'after' })).toMatchObject({
      ok: true,
      parentId: 'group_a',
      beforeId: 'socket',
      afterId: 'sphere',
    });
    expect(model.resolveDrop({ draggedIds: ['box', 'sphere'], targetId: 'group_b', placement: 'inside' })).toMatchObject({
      ok: true,
      parentId: 'group_b',
      beforeId: null,
      afterId: null,
    });
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'socket', placement: 'inside' })).toMatchObject({
      ok: true,
      parentId: 'socket',
      beforeId: null,
      afterId: 'socket_child',
    });
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'label_group', placement: 'inside' })).toMatchObject({
      ok: false,
      reason: 'target-cannot-have-children',
    });
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'locked_group', placement: 'inside' })).toMatchObject({
      ok: false,
      reason: 'target-cannot-have-children',
    });
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'locked_child', placement: 'before' })).toMatchObject({
      ok: false,
      reason: 'target-parent-locked',
    });
    expect(model.resolveDrop({ draggedIds: ['root'], targetId: 'group_b', placement: 'inside' })).toMatchObject({
      ok: false,
      reason: 'dragged-node-protected',
    });
    expect(model.resolveDrop({ draggedIds: ['group_a'], targetId: 'box', placement: 'inside' })).toMatchObject({
      ok: false,
      reason: 'cannot-drop-on-descendant',
    });
    expect(model.resolveDrop({ draggedIds: ['box'], targetId: 'root', placement: 'before' })).toMatchObject({
      ok: false,
      reason: 'cannot-reorder-root',
    });
  });
});

describe('local editor hierarchy action registry', () => {
  it('centralizes protected root menu capability decisions', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy);
    const root = model.getNode('root')!;
    const menu = createLocalEditorHierarchyNodeMenu({
      state: createHierarchyState(['root'], 'root'),
      model,
      node: root,
      hasGroupSelectionHandler: true,
    });

    expect(menu.items.find(item => item.id === 'hierarchy.rename')).toMatchObject({ disabled: true });
    expect(menu.items.find(item => item.id === 'hierarchy.delete')).toMatchObject({ disabled: true });
    expect(menu.items.find(item => item.id === 'hierarchy.duplicate')).toMatchObject({ disabled: true });
    expect(menu.items.find(item => item.id === 'hierarchy.create-child-group')).toMatchObject({ disabled: false });
  });

  it('uses container capability for create child group menu state independent of role', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy);
    const socket = model.getNode('socket')!;
    const labelGroup = model.getNode('label_group')!;

    const socketMenu = createLocalEditorHierarchyNodeMenu({
      state: createHierarchyState(['socket'], 'socket'),
      model,
      node: socket,
      hasGroupSelectionHandler: true,
    });
    const labelGroupMenu = createLocalEditorHierarchyNodeMenu({
      state: createHierarchyState(['label_group'], 'label_group'),
      model,
      node: labelGroup,
      hasGroupSelectionHandler: true,
    });

    expect(socket).toMatchObject({ role: 'object' });
    expect(socketMenu.items.find(item => item.id === 'hierarchy.create-child-group')).toMatchObject({ disabled: false });
    expect(socketMenu.actions.get('hierarchy.create-child-group')).toMatchObject({
      kind: 'context-action',
      action: {
        region: 'hierarchy',
        action: 'create-group',
        parentId: 'socket',
        activeId: 'socket',
      },
    });
    expect(labelGroup).toMatchObject({ role: 'group' });
    expect(labelGroupMenu.items.find(item => item.id === 'hierarchy.create-child-group')).toMatchObject({
      disabled: true,
      disabledReason: 'This node cannot contain children.',
    });
  });

  it('enables group selection only when the pipeline is connected and selected nodes are movable', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy, ['box', 'sphere'], 'box');
    const blankWithoutHandler = createLocalEditorHierarchyBlankMenu({
      state: createHierarchyState(['box', 'sphere'], 'box'),
      model,
      hasGroupSelectionHandler: false,
    });
    const blankWithHandler = createLocalEditorHierarchyBlankMenu({
      state: createHierarchyState(['box', 'sphere'], 'box'),
      model,
      hasGroupSelectionHandler: true,
    });

    expect(blankWithoutHandler.items.find(item => item.id === 'hierarchy.group-selection')).toMatchObject({ disabled: true });
    expect(blankWithHandler.items.find(item => item.id === 'hierarchy.group-selection')).toMatchObject({ disabled: false });
    expect(blankWithHandler.actions.get('hierarchy.group-selection')).toMatchObject({
      kind: 'group-selection',
      intent: {
        ids: ['box', 'sphere'],
        parentId: 'group_a',
        name: 'Parent',
        pivot: 'selection-center',
        preserveWorldTransform: true,
      },
    });
  });

  it('enables duplicate, copy, and paste when hierarchy clipboard actions are connected', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy, ['box', 'sphere'], 'sphere');
    const menu = createLocalEditorHierarchyNodeMenu({
      state: createHierarchyState(['box', 'sphere'], 'sphere'),
      model,
      node: model.getNode('box')!,
      clipboardIds: ['box'],
      clipboardActiveId: 'box',
      hasDuplicateHandler: true,
      hasGroupSelectionHandler: true,
    });

    expect(menu.items.find(item => item.id === 'hierarchy.duplicate')).toMatchObject({ disabled: false });
    expect(menu.items.find(item => item.id === 'hierarchy.copy')).toMatchObject({ disabled: false });
    expect(menu.items.find(item => item.id === 'hierarchy.paste')).toMatchObject({ disabled: false });
    expect(menu.actions.get('hierarchy.duplicate')).toMatchObject({
      kind: 'context-action',
      action: {
        region: 'hierarchy',
        action: 'duplicate',
        targetIds: ['box', 'sphere'],
        activeId: 'sphere',
      },
    });
    expect(menu.actions.get('hierarchy.copy')).toMatchObject({
      kind: 'copy-selection',
      targetIds: ['box', 'sphere'],
      activeId: 'sphere',
    });
    expect(menu.actions.get('hierarchy.paste')).toMatchObject({
      kind: 'context-action',
      action: {
        region: 'hierarchy',
        action: 'paste',
        sourceIds: ['box'],
        activeId: 'box',
      },
    });
  });

  it('keeps clipboard shortcuts disabled until the relevant nodes and pipeline exist', () => {
    const model = createLocalEditorHierarchyTreeModel(hierarchy, ['box'], 'box');
    const disconnectedInput = {
      state: createHierarchyState(['box'], 'box'),
      model,
      clipboardIds: ['box'],
      clipboardActiveId: 'box',
      hasDuplicateHandler: false,
      hasGroupSelectionHandler: true,
    };
    const connectedInput = {
      ...disconnectedInput,
      hasDuplicateHandler: true,
    };

    expect(createLocalEditorHierarchyCopyShortcutAction(disconnectedInput)).toBeNull();
    expect(createLocalEditorHierarchyPasteShortcutAction({
      ...connectedInput,
      clipboardIds: ['missing'],
      clipboardActiveId: 'missing',
    })).toBeNull();
    expect(createLocalEditorHierarchyCopyShortcutAction(connectedInput)).toMatchObject({
      kind: 'copy-selection',
      targetIds: ['box'],
      activeId: 'box',
    });
    expect(createLocalEditorHierarchyPasteShortcutAction(connectedInput)).toMatchObject({
      kind: 'context-action',
      action: {
        region: 'hierarchy',
        action: 'paste',
        sourceIds: ['box'],
        activeId: 'box',
      },
    });
  });
});

describe('scene graph protected capability contracts', () => {
  it('rejects mutating protected roots while allowing them as drop containers', () => {
    expect(validateSceneGraphRename(hierarchy, { id: 'root', name: 'New Root' })).toMatchObject({
      ok: false,
      reason: 'node-protected',
    });
    expect(validateSceneGraphDelete(hierarchy, { ids: ['root'] })).toMatchObject({
      ok: false,
      reason: 'node-protected',
    });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'root',
      placement: 'inside',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'root',
      placement: 'before',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'cannot-reorder-root' });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'visual_root_peer',
      placement: 'before',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'locked_child',
      placement: 'before',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'target-parent-locked' });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'sphere',
      placement: 'inside',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'target-cannot-have-children' });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'socket',
      placement: 'inside',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphDrop(hierarchy, {
      draggedId: 'box',
      targetId: 'label_group',
      placement: 'inside',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'target-cannot-have-children' });
  });

  it('validates move and group-selection intents with top-level movable nodes', () => {
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['group_a', 'box'],
      targetId: 'group_b',
      placement: 'inside',
      parentId: 'group_b',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box'],
      targetId: 'socket',
      placement: 'inside',
      parentId: 'socket',
      afterId: 'socket_child',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box'],
      targetId: 'label_group',
      placement: 'inside',
      parentId: 'label_group',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'target-cannot-have-children' });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box'],
      targetId: 'locked_child',
      placement: 'before',
      parentId: 'locked_group',
      beforeId: 'locked_child',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'target-parent-locked' });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['root'],
      placement: 'root',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'node-protected' });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box'],
      targetId: 'root',
      placement: 'before',
      parentId: null,
      beforeId: 'root',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'cannot-reorder-root' });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box'],
      targetId: 'visual_root_peer',
      placement: 'before',
      parentId: null,
      beforeId: 'visual_root_peer',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box', 'missing_node'],
      targetId: 'group_b',
      placement: 'inside',
      parentId: 'group_b',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'missing-node' });
    expect(validateSceneGraphMove(hierarchy, {
      ids: ['box'],
      targetId: 'sphere',
      placement: 'after',
      parentId: 'group_a',
      afterId: 'group_b',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'invalid-after-anchor' });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box', 'sphere'],
      parentId: 'group_a',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box'],
      parentId: 'socket',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box', 'missing_node'],
      parentId: 'group_a',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'missing-node' });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box'],
      parentId: 'locked_group',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'parent-cannot-have-children' });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box'],
      parentId: 'group_a',
      insertBeforeId: 'group_b',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'invalid-before-anchor' });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box'],
      parentId: null,
      insertBeforeId: 'root',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: false, reason: 'invalid-before-anchor' });
    expect(validateSceneGraphGroupSelection(hierarchy, {
      ids: ['box'],
      parentId: null,
      insertBeforeId: 'visual_root_peer',
      name: 'Parent',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })).toMatchObject({ ok: true });
  });
});

function createHierarchyState(selectedIds: string[], activeId: string | null) {
  return {
    mode: 'editor' as const,
    busy: false,
    status: '',
    assetFilter: '',
    assets: [],
    hierarchy,
    selectedIds,
    activeId,
    serializedObject: null,
  };
}
