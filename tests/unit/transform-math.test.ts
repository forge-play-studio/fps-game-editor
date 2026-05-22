import { describe, expect, it } from 'vitest';
import {
  combineEditorTransforms,
  composeEditorTransformMatrix,
  createIdentityEditorTransform,
  editorTransformMatricesAlmostEqual,
  toEditorLocalTransformFromWorld,
  type EditorTransformSnapshot,
} from '@fps-games/editor-core';

describe('editor transform math', () => {
  it('preserves world matrices when deriving local transform under rotated and scaled parents', () => {
    const parent: EditorTransformSnapshot = {
      position: { x: 4, y: 1, z: -2 },
      rotation: { x: 0.2, y: Math.PI / 4, z: -0.1 },
      scale: { x: 2, y: 2, z: 2 },
    };
    const originalLocal: EditorTransformSnapshot = {
      position: { x: 1.5, y: 0.5, z: -3 },
      rotation: { x: -0.15, y: 0.35, z: 0.2 },
      scale: { x: 0.75, y: 0.75, z: 0.75 },
    };
    const world = combineEditorTransforms(parent, originalLocal)!;
    const local = toEditorLocalTransformFromWorld(parent, world)!;
    const recomposedWorld = combineEditorTransforms(parent, local)!;

    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(recomposedWorld),
      composeEditorTransformMatrix(world),
    )).toBe(true);
  });

  it('preserves world matrices through nested rotated and scaled parent chains', () => {
    const root: EditorTransformSnapshot = {
      position: { x: 10, y: 0, z: 0 },
      rotation: { x: 0, y: Math.PI / 6, z: 0 },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    };
    const parent: EditorTransformSnapshot = {
      position: { x: -2, y: 0.25, z: 1 },
      rotation: { x: 0.1, y: -0.25, z: 0.05 },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
    };
    const child: EditorTransformSnapshot = {
      position: { x: 3, y: 1, z: 2 },
      rotation: { x: 0.3, y: 0.2, z: -0.4 },
      scale: { x: 1.25, y: 1.25, z: 1.25 },
    };
    const parentWorld = combineEditorTransforms(root, parent)!;
    const childWorld = combineEditorTransforms(parentWorld, child)!;
    const localUnderRoot = toEditorLocalTransformFromWorld(root, childWorld)!;
    const recomposedWorld = combineEditorTransforms(root, localUnderRoot)!;

    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(recomposedWorld),
      composeEditorTransformMatrix(childWorld),
    )).toBe(true);
  });

  it('rejects local transform derivation under non-invertible parent scale', () => {
    expect(toEditorLocalTransformFromWorld(
      {
        ...createIdentityEditorTransform(),
        scale: { x: 1, y: 0, z: 1 },
      },
      createIdentityEditorTransform(),
    )).toBeNull();
  });

  it('rejects preserve-world locals that would require shear under non-uniform rotated parents', () => {
    expect(toEditorLocalTransformFromWorld(
      {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
        scale: { x: 2, y: 1, z: 1 },
      },
      {
        position: { x: 2, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    )).toBeNull();
  });
});
