import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS,
  DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS,
  computeEditorTransformActionTargets,
  normalizeEditorTransformConstraint,
  snapEditorTransformSnapshot,
  type EditorTransformBatchCommit,
  type EditorTransformGizmoCommit,
  type EditorTransformOperationBlockReason,
  type EditorTransformSnapshot,
} from '@fps-games/editor-core';

describe('editor transform operation descriptors', () => {
  it('describes select, move, rotate, and scale tools from core', () => {
    expect(Object.keys(DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS)).toEqual([
      'select',
      'move',
      'rotate',
      'scale',
    ]);
    expect(DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS.move.handles.map(handle => handle.constraint))
      .toEqual(['axis', 'plane', 'free']);
    expect(DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS.rotate.handles.map(handle => handle.constraint))
      .toEqual(['axis']);
    expect(DEFAULT_EDITOR_TRANSFORM_TOOL_DESCRIPTORS.scale.handles.map(handle => handle.constraint))
      .toEqual(['axis', 'uniform']);
  });

  it('normalizes constraints against the selected tool capabilities', () => {
    expect(normalizeEditorTransformConstraint('move')).toBe('axis');
    expect(normalizeEditorTransformConstraint('move', 'plane')).toBe('plane');
    expect(normalizeEditorTransformConstraint('move', 'free')).toBe('free');
    expect(normalizeEditorTransformConstraint('move', 'view-plane')).toBe('free');
    expect(normalizeEditorTransformConstraint('move', 'uniform')).toBe('axis');

    expect(normalizeEditorTransformConstraint('rotate', 'plane')).toBe('axis');
    expect(normalizeEditorTransformConstraint('scale', 'uniform')).toBe('uniform');
    expect(normalizeEditorTransformConstraint('scale', 'free')).toBe('axis');
    expect(normalizeEditorTransformConstraint('select', 'axis')).toBeUndefined();
  });

  it('keeps persisted transform commits on canonical handle constraints', () => {
    const constraint = normalizeEditorTransformConstraint('move', 'view-plane');
    const singleCommit: EditorTransformGizmoCommit = {
      nodeId: 'a',
      tool: 'move',
      space: 'world',
      constraint: constraint!,
      before: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      after: {
        position: { x: 1, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    };
    const commit: EditorTransformBatchCommit = {
      targetIds: ['a', 'b'],
      activeId: 'a',
      tool: 'move',
      space: 'world',
      constraint: constraint!,
      pivot: {
        mode: 'selection-center',
        position: { x: 0, y: 0, z: 0 },
      },
      targets: [],
    };

    expect(singleCommit.constraint).toBe('free');
    expect(commit.constraint).toBe('free');
  });

  it('exposes engine-agnostic transform operation block reasons', () => {
    const reasons: EditorTransformOperationBlockReason[] = [
      'non-trs-representable',
      'non-invertible-parent',
      'unsupported-transform',
    ];

    expect(reasons).toEqual([
      'non-trs-representable',
      'non-invertible-parent',
      'unsupported-transform',
    ]);
  });

  it('snaps move, rotate, and scale deltas with operation defaults', () => {
    const before = createSnapshot();
    const settings = {
      ...DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS.snap,
      enabled: true,
    };

    expect(snapEditorTransformSnapshot(before, {
      ...before,
      position: { x: 0.74, y: 0.24, z: -0.76 },
    }, 'move', settings).position).toEqual({ x: 0.5, y: 0, z: -1 });

    expect(snapEditorTransformSnapshot(before, {
      ...before,
      rotation: { x: (22 * Math.PI) / 180, y: 0, z: 0 },
    }, 'rotate', settings).rotation.x).toBeCloseTo((15 * Math.PI) / 180);

    expect(snapEditorTransformSnapshot(before, {
      ...before,
      scale: { x: 1.24, y: 0.86, z: 1 },
    }, 'scale', settings).scale).toEqual({ x: 1.2, y: 0.9, z: 1 });
  });

  it('leaves transforms untouched when snap is disabled', () => {
    const before = createSnapshot();
    const after = {
      ...before,
      position: { x: 0.74, y: 0.24, z: -0.76 },
    };

    expect(snapEditorTransformSnapshot(before, after, 'move', {
      ...DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS.snap,
      enabled: false,
    })).toEqual(after);
  });

  it('computes align and distribute position actions from core', () => {
    const targets = [
      { id: 'a', transform: createSnapshot({ position: { x: 0, y: 0, z: 0 } }) },
      { id: 'b', transform: createSnapshot({ position: { x: 4, y: 2, z: 0 } }) },
      { id: 'c', transform: createSnapshot({ position: { x: 10, y: 4, z: 0 } }) },
    ];

    const aligned = computeEditorTransformActionTargets({
      action: 'align-x',
      activeId: 'b',
      targets,
    });
    expect(aligned.map(target => [target.id, target.after.position.x])).toEqual([
      ['a', 4],
      ['b', 4],
      ['c', 4],
    ]);

    const distributed = computeEditorTransformActionTargets({
      action: 'distribute-x',
      activeId: 'b',
      targets,
    });
    expect(distributed.map(target => [target.id, target.after.position.x])).toEqual([
      ['a', 0],
      ['b', 5],
      ['c', 10],
    ]);
  });

  it('aligns every position axis to the active object without changing active values', () => {
    const targets = [
      { id: 'a', transform: createSnapshot({ position: { x: -2, y: 1, z: 4 } }) },
      { id: 'b', transform: createSnapshot({ position: { x: 3, y: 2, z: -1 } }) },
    ];

    const aligned = computeEditorTransformActionTargets({
      action: 'align-all',
      activeId: 'b',
      targets,
    });

    expect(aligned.map(target => [target.id, target.after.position])).toEqual([
      ['a', { x: 3, y: 2, z: -1 }],
      ['b', { x: 3, y: 2, z: -1 }],
    ]);
  });

  it('distributes sorted positions while preserving the first and last endpoints', () => {
    const targets = [
      { id: 'middle', transform: createSnapshot({ position: { x: 5, y: 0, z: 0 } }) },
      { id: 'last', transform: createSnapshot({ position: { x: 10, y: 0, z: 0 } }) },
      { id: 'first', transform: createSnapshot({ position: { x: -2, y: 0, z: 0 } }) },
    ];

    const distributed = computeEditorTransformActionTargets({
      action: 'distribute-x',
      activeId: 'middle',
      targets,
    });

    expect(distributed.map(target => [target.id, target.after.position.x])).toEqual([
      ['first', -2],
      ['middle', 4],
      ['last', 10],
    ]);
  });
});

function createSnapshot(
  overrides: Partial<EditorTransformSnapshot> = {},
): EditorTransformSnapshot {
  return {
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
    rotation: overrides.rotation ?? { x: 0, y: 0, z: 0 },
    scale: overrides.scale ?? { x: 1, y: 1, z: 1 },
  };
}
