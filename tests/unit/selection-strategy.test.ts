import { describe, expect, it } from 'vitest';
import { resolveEditorSelectionCommand } from '@fps-games/editor-core';

describe('editor selection strategy', () => {
  it('uses additive click as add-or-remove while preserving additive box union behavior', () => {
    const selection = {
      selectedIds: ['box', 'sphere'],
      activeId: 'sphere',
    };

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: ['tree'],
      activeId: 'tree',
      gesture: 'click',
      modifier: 'additive',
    })).toMatchObject({
      type: 'selection.add',
      selectedIds: ['tree'],
      activeId: 'tree',
    });

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: ['sphere'],
      activeId: 'sphere',
      gesture: 'click',
      modifier: 'additive',
    })).toMatchObject({
      type: 'selection.remove',
      selectedIds: ['sphere'],
    });

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: ['box', 'tree'],
      activeId: 'tree',
      gesture: 'box',
      modifier: 'additive',
    })).toMatchObject({
      type: 'selection.add',
      selectedIds: ['box', 'tree'],
      activeId: 'tree',
    });
  });

  it('maps replace, toggle, and empty replace gestures to core selection commands', () => {
    const selection = {
      selectedIds: ['box'],
      activeId: 'box',
    };

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: ['sphere'],
      activeId: 'sphere',
      gesture: 'click',
      modifier: 'replace',
    })).toMatchObject({
      type: 'selection.replace',
      selectedIds: ['sphere'],
      activeId: 'sphere',
    });

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: ['box'],
      activeId: 'box',
      gesture: 'click',
      modifier: 'toggle',
    })).toMatchObject({
      type: 'selection.toggle',
      selectedIds: ['box'],
      activeId: 'box',
    });

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: [],
      gesture: 'click',
      modifier: 'replace',
    })).toEqual({
      type: 'selection.clear',
      label: 'Clear Selection',
    });

    expect(resolveEditorSelectionCommand({
      selection,
      targetIds: [],
      gesture: 'box',
      modifier: 'additive',
    })).toBeNull();
  });
});
