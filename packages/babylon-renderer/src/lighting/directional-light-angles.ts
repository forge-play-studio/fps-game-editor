export interface BabylonRendererVec3 {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_DIRECTIONAL_LIGHT_DIRECTION: BabylonRendererVec3 = { x: -0.3, y: -1, z: -0.2 };
export const LIGHT_DIRECTION_HORIZONTAL_MIN_DEG = -180;
export const LIGHT_DIRECTION_HORIZONTAL_MAX_DEG = 180;
export const LIGHT_DIRECTION_ELEVATION_MIN_DEG = -90;
export const LIGHT_DIRECTION_ELEVATION_MAX_DEG = 90;

export function normalizeDirectionVector(
  direction: BabylonRendererVec3 | undefined,
  fallback: BabylonRendererVec3 = DEFAULT_DIRECTIONAL_LIGHT_DIRECTION,
): BabylonRendererVec3 {
  const candidate = direction && isVec3(direction) ? direction : fallback;
  const length = Math.hypot(candidate.x, candidate.y, candidate.z);
  if (!Number.isFinite(length) || length <= 0.000001) {
    const fallbackLength = Math.hypot(fallback.x, fallback.y, fallback.z) || 1;
    return {
      x: fallback.x / fallbackLength,
      y: fallback.y / fallbackLength,
      z: fallback.z / fallbackLength,
    };
  }
  return {
    x: candidate.x / length,
    y: candidate.y / length,
    z: candidate.z / length,
  };
}

export function readDirectionalLightAngles(direction: BabylonRendererVec3 | undefined): {
  horizontalAngleDeg: number;
  elevationAngleDeg: number;
} {
  const normalized = normalizeDirectionVector(direction);
  return {
    horizontalAngleDeg: Math.round(normalizeAngleDegrees(radiansToDegrees(Math.atan2(normalized.z, normalized.x)))),
    elevationAngleDeg: Math.round(radiansToDegrees(Math.asin(clampNumber(-normalized.y, -1, 1)))),
  };
}

export function createDirectionalLightDirectionFromAngles(
  horizontalAngleDeg: number,
  elevationAngleDeg: number,
): BabylonRendererVec3 {
  const horizontal = degreesToRadians(normalizeAngleDegrees(horizontalAngleDeg));
  const elevation = degreesToRadians(clampNumber(
    elevationAngleDeg,
    LIGHT_DIRECTION_ELEVATION_MIN_DEG,
    LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  ));
  const horizontalLength = Math.cos(elevation);
  return {
    x: roundVectorComponent(horizontalLength * Math.cos(horizontal)),
    y: roundVectorComponent(-Math.sin(elevation)),
    z: roundVectorComponent(horizontalLength * Math.sin(horizontal)),
  };
}

function isVec3(value: BabylonRendererVec3): boolean {
  return typeof value.x === 'number'
    && Number.isFinite(value.x)
    && typeof value.y === 'number'
    && Number.isFinite(value.y)
    && typeof value.z === 'number'
    && Number.isFinite(value.z);
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundVectorComponent(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngleDegrees(value: number): number {
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}
