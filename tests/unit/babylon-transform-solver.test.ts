import * as BABYLON from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import type { EditorTransformSnapshot } from '../../packages/editor-core/src';
import { createBabylonTransformSolver } from '../../packages/editor-babylon/src/transform-solver';

const IDENTITY: EditorTransformSnapshot = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

describe('Babylon transform solver', () => {
  it('moves world-space TRS snapshots without changing rotation or scale', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const result = solver.solveMove({
      before: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.2, y: -0.1, z: 0.4 },
        scale: { x: 2, y: 2, z: 2 },
      },
      delta: { x: 4, y: -2, z: 0.5 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transform).toEqual({
      position: { x: 5, y: 0, z: 3.5 },
      rotation: { x: 0.2, y: -0.1, z: 0.4 },
      scale: { x: 2, y: 2, z: 2 },
    });
  });

  it('applies world rotation as a world-space quaternion delta', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const before = {
      ...IDENTITY,
      rotation: { x: 0.45, y: 0.8, z: -0.25 },
    };
    const result = solver.solveRotate({
      before,
      pivot: before.position,
      delta: { x: 0, y: 0, z: Math.PI / 6 },
      space: 'world',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transform.rotation.x).toBeCloseTo(0.053746467954180574);
    expect(result.transform.rotation.y).toBeCloseTo(0.8914884034697566);
    expect(result.transform.rotation.z).toBeCloseTo(0.10635131382026909);
    expect(result.transform.rotation.z).not.toBeCloseTo(before.rotation.z + Math.PI / 6);
  });

  it('applies local rotation as an object-space quaternion delta', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const before = {
      ...IDENTITY,
      position: { x: 3, y: 0, z: -2 },
      rotation: { x: 0.45, y: 0.8, z: -0.25 },
    };
    const result = solver.solveRotate({
      before,
      pivot: before.position,
      delta: { x: 0, y: 0, z: Math.PI / 6 },
      space: 'local',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transform.position).toEqual(before.position);
    expect(result.transform.rotation.x).toBeCloseTo(0.45);
    expect(result.transform.rotation.y).toBeCloseTo(0.8);
    expect(result.transform.rotation.z).toBeCloseTo(before.rotation.z + Math.PI / 6);
  });

  it('keeps non-uniform scale stable during local rotation', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const before = {
      ...IDENTITY,
      rotation: { x: 0.2, y: 0.4, z: -0.1 },
      scale: { x: 2, y: 1, z: 0.5 },
    };
    const result = solver.solveRotate({
      before,
      pivot: before.position,
      delta: { x: 0, y: 0, z: Math.PI / 2 },
      space: 'local',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transform.scale.x).toBeCloseTo(before.scale.x);
    expect(result.transform.scale.y).toBeCloseTo(before.scale.y);
    expect(result.transform.scale.z).toBeCloseTo(before.scale.z);
    expect(result.transform.rotation.z).not.toBeCloseTo(before.rotation.z);
  });

  it('allows representable world non-uniform scale on unrotated targets', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const result = solver.solveScale({
      before: {
        ...IDENTITY,
        position: { x: 2, y: 0, z: 0 },
      },
      pivot: { x: 1, y: 0, z: 0 },
      delta: { x: 2, y: 1, z: 1 },
      space: 'world',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transform.position.x).toBeCloseTo(3);
    expect(result.transform.scale).toEqual({ x: 2, y: 1, z: 1 });
  });

  it('blocks world non-uniform scale when it would require shear', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const result = solver.solveScale({
      before: {
        ...IDENTITY,
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
      },
      pivot: IDENTITY.position,
      delta: { x: 2, y: 1, z: 1 },
      space: 'world',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('non-trs-representable');
  });

  it('allows local non-uniform scale on rotated targets', () => {
    const solver = createBabylonTransformSolver({ babylon: BABYLON as any });
    const result = solver.solveScale({
      before: {
        ...IDENTITY,
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
      },
      pivot: IDENTITY.position,
      delta: { x: 2, y: 1, z: 1 },
      space: 'local',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transform.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(result.transform.scale.x).toBeCloseTo(2);
    expect(result.transform.scale.y).toBeCloseTo(1);
    expect(result.transform.scale.z).toBeCloseTo(1);
  });
});
