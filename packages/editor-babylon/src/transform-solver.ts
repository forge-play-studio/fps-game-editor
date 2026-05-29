import type {
  EditorTransformOperationBlockReason,
  EditorTransformSnapshot,
  EditorTransformSpace,
  EditorTransformVec3,
} from '@fps-games/editor-core';
import type { BabylonRuntimeGlobal } from './types';

export interface BabylonTransformSolverOptions {
  babylon: BabylonRuntimeGlobal & Record<string, any>;
  epsilon?: number;
}

export interface BabylonTransformDeltaInput {
  before: EditorTransformSnapshot;
  pivot: EditorTransformVec3;
  delta: EditorTransformVec3;
  space: EditorTransformSpace;
}

export type BabylonTransformSolverResult =
  | {
      ok: true;
      transform: EditorTransformSnapshot;
      matrix: any;
    }
  | {
      ok: false;
      reason: EditorTransformOperationBlockReason;
      matrix: any;
    };

export interface BabylonTransformSolver {
  composeTransformMatrix(transform: EditorTransformSnapshot): any;
  decomposeRepresentableWorldMatrix(matrix: any): BabylonTransformSolverResult;
  solveMove(input: Pick<BabylonTransformDeltaInput, 'before' | 'delta'>): BabylonTransformSolverResult;
  solveRotate(input: BabylonTransformDeltaInput): BabylonTransformSolverResult;
  solveScale(input: BabylonTransformDeltaInput): BabylonTransformSolverResult;
}

const DEFAULT_EPSILON = 0.00001;

export function createBabylonTransformSolver(
  options: BabylonTransformSolverOptions,
): BabylonTransformSolver {
  const Vector3Ctor = options.babylon.Vector3;
  const Quaternion = (options.babylon as any).Quaternion;
  const Matrix = (options.babylon as any).Matrix;
  if (!Vector3Ctor || !Quaternion || !Matrix) {
    throw new Error('Babylon runtime missing transform solver constructors');
  }
  const Vector3 = Vector3Ctor as NonNullable<BabylonRuntimeGlobal['Vector3']>;
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;

  function vec3(value: EditorTransformVec3): any {
    return new Vector3(value.x, value.y, value.z);
  }

  function composeTransformMatrix(transform: EditorTransformSnapshot): any {
    return Matrix.Compose(
      vec3(transform.scale),
      Quaternion.FromEulerAngles(transform.rotation.x, transform.rotation.y, transform.rotation.z),
      vec3(transform.position),
    );
  }

  function decomposeRepresentableWorldMatrix(matrix: any): BabylonTransformSolverResult {
    const scale = new Vector3(1, 1, 1);
    const rotation = new Quaternion();
    const position = new Vector3(0, 0, 0);
    if (!matrix?.decompose?.(scale, rotation, position)) {
      return { ok: false, reason: 'non-trs-representable', matrix };
    }
    const transform = {
      position: readVec3(position),
      rotation: readVec3(rotation.toEulerAngles()),
      scale: readVec3(scale),
    };
    if (!isFiniteTransform(transform)) {
      return { ok: false, reason: 'non-trs-representable', matrix };
    }
    const recomposed = composeTransformMatrix(transform);
    return matricesAlmostEqual(matrix, recomposed, epsilon)
      ? { ok: true, transform, matrix }
      : { ok: false, reason: 'non-trs-representable', matrix };
  }

  function solveMove(
    input: Pick<BabylonTransformDeltaInput, 'before' | 'delta'>,
  ): BabylonTransformSolverResult {
    const transform = {
      position: addVec3(input.before.position, input.delta),
      rotation: input.before.rotation,
      scale: input.before.scale,
    };
    return {
      ok: true,
      transform,
      matrix: composeTransformMatrix(transform),
    };
  }

  function solveRotate(input: BabylonTransformDeltaInput): BabylonTransformSolverResult {
    const matrix = composeRotatedTransformMatrix(input);
    return decomposeRepresentableWorldMatrix(matrix);
  }

  function solveScale(input: BabylonTransformDeltaInput): BabylonTransformSolverResult {
    const matrix = applyDeltaMatrix(input.before, input.pivot, Matrix.Scaling(input.delta.x, input.delta.y, input.delta.z), input.space);
    return decomposeRepresentableWorldMatrix(matrix);
  }

  function composeRotatedTransformMatrix(input: BabylonTransformDeltaInput): any {
    const beforeRotation = Quaternion.FromEulerAngles(input.before.rotation.x, input.before.rotation.y, input.before.rotation.z);
    const deltaRotation = Quaternion.FromEulerAngles(input.delta.x, input.delta.y, input.delta.z);
    const rotation = input.space === 'world'
      ? deltaRotation.multiply(beforeRotation)
      : beforeRotation.multiply(deltaRotation);
    const position = input.space === 'world'
      ? rotatePositionAroundPivot(input.before.position, input.pivot, deltaRotation)
      : input.before.position;
    return Matrix.Compose(vec3(input.before.scale), rotation, vec3(position));
  }

  function rotatePositionAroundPivot(
    position: EditorTransformVec3,
    pivot: EditorTransformVec3,
    rotation: any,
  ): EditorTransformVec3 {
    const rotated = Matrix.Translation(position.x - pivot.x, position.y - pivot.y, position.z - pivot.z)
      .multiply(Matrix.Compose(new Vector3(1, 1, 1), rotation, new Vector3(0, 0, 0)));
    return {
      x: Number(rotated.m?.[12] ?? 0) + pivot.x,
      y: Number(rotated.m?.[13] ?? 0) + pivot.y,
      z: Number(rotated.m?.[14] ?? 0) + pivot.z,
    };
  }

  function applyDeltaMatrix(
    before: EditorTransformSnapshot,
    pivot: EditorTransformVec3,
    deltaMatrix: any,
    space: EditorTransformSpace,
  ): any {
    const beforeMatrix = composeTransformMatrix(before);
    if (space === 'local') return deltaMatrix.multiply(beforeMatrix);
    return beforeMatrix
      .multiply(Matrix.Translation(-pivot.x, -pivot.y, -pivot.z))
      .multiply(deltaMatrix)
      .multiply(Matrix.Translation(pivot.x, pivot.y, pivot.z));
  }

  return {
    composeTransformMatrix,
    decomposeRepresentableWorldMatrix,
    solveMove,
    solveRotate,
    solveScale,
  };
}

function readVec3(value: any): EditorTransformVec3 {
  return {
    x: Number(value.x),
    y: Number(value.y),
    z: Number(value.z),
  };
}

function addVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

function isFiniteTransform(transform: EditorTransformSnapshot): boolean {
  return isFiniteVec3(transform.position) && isFiniteVec3(transform.rotation) && isFiniteVec3(transform.scale);
}

function isFiniteVec3(value: EditorTransformVec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function matricesAlmostEqual(left: any, right: any, epsilon: number): boolean {
  const leftValues = typeof left.asArray === 'function' ? left.asArray() : [];
  const rightValues = typeof right.asArray === 'function' ? right.asArray() : [];
  return leftValues.length === rightValues.length
    && leftValues.every((value: number, index: number) => Math.abs(value - rightValues[index]) <= epsilon);
}
