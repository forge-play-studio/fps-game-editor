import type { EditorTransformSnapshot, EditorTransformVec3 } from './transform-gizmo';

export type EditorTransformMatrix = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

const TRANSFORM_EPSILON = 0.000001;

export function createIdentityEditorTransform(): EditorTransformSnapshot {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

export function createIdentityEditorTransformMatrix(): EditorTransformMatrix {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

export function composeEditorTransformMatrix(transform: EditorTransformSnapshot): EditorTransformMatrix {
  const rotation = quaternionFromEulerAngles(transform.rotation);
  const x = rotation.x;
  const y = rotation.y;
  const z = rotation.z;
  const w = rotation.w;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  const sx = transform.scale.x;
  const sy = transform.scale.y;
  const sz = transform.scale.z;

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    transform.position.x,
    transform.position.y,
    transform.position.z,
    1,
  ];
}

export function multiplyEditorTransformMatrices(
  left: readonly number[],
  right: readonly number[],
): EditorTransformMatrix {
  return [
    left[0]! * right[0]! + left[1]! * right[4]! + left[2]! * right[8]! + left[3]! * right[12]!,
    left[0]! * right[1]! + left[1]! * right[5]! + left[2]! * right[9]! + left[3]! * right[13]!,
    left[0]! * right[2]! + left[1]! * right[6]! + left[2]! * right[10]! + left[3]! * right[14]!,
    left[0]! * right[3]! + left[1]! * right[7]! + left[2]! * right[11]! + left[3]! * right[15]!,
    left[4]! * right[0]! + left[5]! * right[4]! + left[6]! * right[8]! + left[7]! * right[12]!,
    left[4]! * right[1]! + left[5]! * right[5]! + left[6]! * right[9]! + left[7]! * right[13]!,
    left[4]! * right[2]! + left[5]! * right[6]! + left[6]! * right[10]! + left[7]! * right[14]!,
    left[4]! * right[3]! + left[5]! * right[7]! + left[6]! * right[11]! + left[7]! * right[15]!,
    left[8]! * right[0]! + left[9]! * right[4]! + left[10]! * right[8]! + left[11]! * right[12]!,
    left[8]! * right[1]! + left[9]! * right[5]! + left[10]! * right[9]! + left[11]! * right[13]!,
    left[8]! * right[2]! + left[9]! * right[6]! + left[10]! * right[10]! + left[11]! * right[14]!,
    left[8]! * right[3]! + left[9]! * right[7]! + left[10]! * right[11]! + left[11]! * right[15]!,
    left[12]! * right[0]! + left[13]! * right[4]! + left[14]! * right[8]! + left[15]! * right[12]!,
    left[12]! * right[1]! + left[13]! * right[5]! + left[14]! * right[9]! + left[15]! * right[13]!,
    left[12]! * right[2]! + left[13]! * right[6]! + left[14]! * right[10]! + left[15]! * right[14]!,
    left[12]! * right[3]! + left[13]! * right[7]! + left[14]! * right[11]! + left[15]! * right[15]!,
  ];
}

export function invertEditorTransformMatrix(matrix: readonly number[]): EditorTransformMatrix | null {
  const a00 = matrix[0]!;
  const a01 = matrix[1]!;
  const a02 = matrix[2]!;
  const a03 = matrix[3]!;
  const a10 = matrix[4]!;
  const a11 = matrix[5]!;
  const a12 = matrix[6]!;
  const a13 = matrix[7]!;
  const a20 = matrix[8]!;
  const a21 = matrix[9]!;
  const a22 = matrix[10]!;
  const a23 = matrix[11]!;
  const a30 = matrix[12]!;
  const a31 = matrix[13]!;
  const a32 = matrix[14]!;
  const a33 = matrix[15]!;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!Number.isFinite(det) || Math.abs(det) < TRANSFORM_EPSILON) return null;
  const invDet = 1 / det;

  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * invDet,
    (a02 * b10 - a01 * b11 - a03 * b09) * invDet,
    (a31 * b05 - a32 * b04 + a33 * b03) * invDet,
    (a22 * b04 - a21 * b05 - a23 * b03) * invDet,
    (a12 * b08 - a10 * b11 - a13 * b07) * invDet,
    (a00 * b11 - a02 * b08 + a03 * b07) * invDet,
    (a32 * b02 - a30 * b05 - a33 * b01) * invDet,
    (a20 * b05 - a22 * b02 + a23 * b01) * invDet,
    (a10 * b10 - a11 * b08 + a13 * b06) * invDet,
    (a01 * b08 - a00 * b10 - a03 * b06) * invDet,
    (a30 * b04 - a31 * b02 + a33 * b00) * invDet,
    (a21 * b02 - a20 * b04 - a23 * b00) * invDet,
    (a11 * b07 - a10 * b09 - a12 * b06) * invDet,
    (a00 * b09 - a01 * b07 + a02 * b06) * invDet,
    (a31 * b01 - a30 * b03 - a32 * b00) * invDet,
    (a20 * b03 - a21 * b01 + a22 * b00) * invDet,
  ];
}

export function decomposeEditorTransformMatrix(matrix: readonly number[]): EditorTransformSnapshot | null {
  const position = { x: matrix[12]!, y: matrix[13]!, z: matrix[14]! };
  const scale = {
    x: vectorLength(matrix[0]!, matrix[1]!, matrix[2]!),
    y: vectorLength(matrix[4]!, matrix[5]!, matrix[6]!),
    z: vectorLength(matrix[8]!, matrix[9]!, matrix[10]!),
  };
  if (determinantEditorTransformMatrix(matrix) <= 0) scale.y *= -1;
  if (!isFiniteVec3(position) || !isFiniteVec3(scale)) return null;
  if (Math.abs(scale.x) < TRANSFORM_EPSILON || Math.abs(scale.y) < TRANSFORM_EPSILON || Math.abs(scale.z) < TRANSFORM_EPSILON) {
    return null;
  }
  const sx = 1 / scale.x;
  const sy = 1 / scale.y;
  const sz = 1 / scale.z;
  const rotationMatrix: EditorTransformMatrix = [
    matrix[0]! * sx, matrix[1]! * sx, matrix[2]! * sx, 0,
    matrix[4]! * sy, matrix[5]! * sy, matrix[6]! * sy, 0,
    matrix[8]! * sz, matrix[9]! * sz, matrix[10]! * sz, 0,
    0, 0, 0, 1,
  ];
  if (!hasOrthogonalBasis(rotationMatrix)) return null;
  const quaternion = normalizeQuaternion(quaternionFromRotationMatrix(rotationMatrix));
  if (!quaternion) return null;
  const rotation = eulerAnglesFromQuaternion(quaternion);
  if (!isFiniteVec3(rotation)) return null;
  const transform = { position, rotation, scale };
  return editorTransformMatricesAlmostEqual(composeEditorTransformMatrix(transform), matrix, 0.00001)
    ? transform
    : null;
}

export function composeEditorTransformChain(
  transforms: readonly EditorTransformSnapshot[],
): EditorTransformSnapshot | null {
  let world = createIdentityEditorTransformMatrix();
  for (const transform of transforms) {
    world = multiplyEditorTransformMatrices(composeEditorTransformMatrix(transform), world);
  }
  return decomposeEditorTransformMatrix(world);
}

export function combineEditorTransforms(
  parent: EditorTransformSnapshot,
  local: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  return decomposeEditorTransformMatrix(
    multiplyEditorTransformMatrices(composeEditorTransformMatrix(local), composeEditorTransformMatrix(parent)),
  );
}

export function toEditorLocalTransformFromWorld(
  parentWorld: EditorTransformSnapshot,
  world: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const parentInverse = invertEditorTransformMatrix(composeEditorTransformMatrix(parentWorld));
  if (!parentInverse) return null;
  return decomposeEditorTransformMatrix(
    multiplyEditorTransformMatrices(composeEditorTransformMatrix(world), parentInverse),
  );
}

export function editorTransformMatricesAlmostEqual(
  left: readonly number[],
  right: readonly number[],
  epsilon = TRANSFORM_EPSILON,
): boolean {
  return left.length === right.length
    && left.every((value, index) => Math.abs(value - right[index]!) <= epsilon);
}

function quaternionFromEulerAngles(rotation: EditorTransformVec3): Quaternion {
  const halfRoll = rotation.z * 0.5;
  const halfPitch = rotation.x * 0.5;
  const halfYaw = rotation.y * 0.5;
  const sinRoll = Math.sin(halfRoll);
  const cosRoll = Math.cos(halfRoll);
  const sinPitch = Math.sin(halfPitch);
  const cosPitch = Math.cos(halfPitch);
  const sinYaw = Math.sin(halfYaw);
  const cosYaw = Math.cos(halfYaw);
  return {
    x: cosYaw * sinPitch * cosRoll + sinYaw * cosPitch * sinRoll,
    y: sinYaw * cosPitch * cosRoll - cosYaw * sinPitch * sinRoll,
    z: cosYaw * cosPitch * sinRoll - sinYaw * sinPitch * cosRoll,
    w: cosYaw * cosPitch * cosRoll + sinYaw * sinPitch * sinRoll,
  };
}

function eulerAnglesFromQuaternion(quaternion: Quaternion): EditorTransformVec3 {
  const qz = quaternion.z;
  const qx = quaternion.x;
  const qy = quaternion.y;
  const qw = quaternion.w;
  const zAxisY = qy * qz - qx * qw;
  const limit = 0.4999999;
  if (zAxisY < -limit) {
    return {
      x: Math.PI / 2,
      y: 2 * Math.atan2(qy, qw),
      z: 0,
    };
  }
  if (zAxisY > limit) {
    return {
      x: -Math.PI / 2,
      y: 2 * Math.atan2(qy, qw),
      z: 0,
    };
  }
  const sqw = qw * qw;
  const sqz = qz * qz;
  const sqx = qx * qx;
  const sqy = qy * qy;
  return {
    z: Math.atan2(2 * (qx * qy + qz * qw), -sqz - sqx + sqy + sqw),
    x: Math.asin(-2 * zAxisY),
    y: Math.atan2(2 * (qz * qx + qy * qw), sqz - sqx - sqy + sqw),
  };
}

function quaternionFromRotationMatrix(matrix: readonly number[]): Quaternion {
  const m11 = matrix[0]!;
  const m12 = matrix[4]!;
  const m13 = matrix[8]!;
  const m21 = matrix[1]!;
  const m22 = matrix[5]!;
  const m23 = matrix[9]!;
  const m31 = matrix[2]!;
  const m32 = matrix[6]!;
  const m33 = matrix[10]!;
  const trace = m11 + m22 + m33;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return {
      w: 0.25 / s,
      x: (m32 - m23) * s,
      y: (m13 - m31) * s,
      z: (m21 - m12) * s,
    };
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    return {
      w: (m32 - m23) / s,
      x: 0.25 * s,
      y: (m12 + m21) / s,
      z: (m13 + m31) / s,
    };
  }
  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    return {
      w: (m13 - m31) / s,
      x: (m12 + m21) / s,
      y: 0.25 * s,
      z: (m23 + m32) / s,
    };
  }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return {
    w: (m21 - m12) / s,
    x: (m13 + m31) / s,
    y: (m23 + m32) / s,
    z: 0.25 * s,
  };
}

function normalizeQuaternion(quaternion: Quaternion): Quaternion | null {
  const length = Math.sqrt(
    quaternion.x * quaternion.x
      + quaternion.y * quaternion.y
      + quaternion.z * quaternion.z
      + quaternion.w * quaternion.w,
  );
  if (!Number.isFinite(length) || length < TRANSFORM_EPSILON) return null;
  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length,
  };
}

function determinantEditorTransformMatrix(matrix: readonly number[]): number {
  const m00 = matrix[0]!;
  const m01 = matrix[1]!;
  const m02 = matrix[2]!;
  const m03 = matrix[3]!;
  const m10 = matrix[4]!;
  const m11 = matrix[5]!;
  const m12 = matrix[6]!;
  const m13 = matrix[7]!;
  const m20 = matrix[8]!;
  const m21 = matrix[9]!;
  const m22 = matrix[10]!;
  const m23 = matrix[11]!;
  const m30 = matrix[12]!;
  const m31 = matrix[13]!;
  const m32 = matrix[14]!;
  const m33 = matrix[15]!;
  const det22_33 = m22 * m33 - m32 * m23;
  const det21_33 = m21 * m33 - m31 * m23;
  const det21_32 = m21 * m32 - m31 * m22;
  const det20_33 = m20 * m33 - m30 * m23;
  const det20_32 = m20 * m32 - m22 * m30;
  const det20_31 = m20 * m31 - m30 * m21;
  const cofact00 = +(m11 * det22_33 - m12 * det21_33 + m13 * det21_32);
  const cofact01 = -(m10 * det22_33 - m12 * det20_33 + m13 * det20_32);
  const cofact02 = +(m10 * det21_33 - m11 * det20_33 + m13 * det20_31);
  const cofact03 = -(m10 * det21_32 - m11 * det20_32 + m12 * det20_31);
  return m00 * cofact00 + m01 * cofact01 + m02 * cofact02 + m03 * cofact03;
}

function vectorLength(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function hasOrthogonalBasis(matrix: readonly number[]): boolean {
  const x = { x: matrix[0]!, y: matrix[1]!, z: matrix[2]! };
  const y = { x: matrix[4]!, y: matrix[5]!, z: matrix[6]! };
  const z = { x: matrix[8]!, y: matrix[9]!, z: matrix[10]! };
  return Math.abs(dotVec3(x, y)) < TRANSFORM_EPSILON
    && Math.abs(dotVec3(x, z)) < TRANSFORM_EPSILON
    && Math.abs(dotVec3(y, z)) < TRANSFORM_EPSILON;
}

function dotVec3(left: EditorTransformVec3, right: EditorTransformVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function isFiniteVec3(value: EditorTransformVec3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}
