import type {
  EditorTransformVec3,
  EditorViewportGroundMeasurement,
  EditorViewportScreenPoint,
} from '@fps-games/editor-core';
import type {
  BabylonRuntimeGlobal,
  RuntimeScene,
} from './types';

export interface BabylonSceneViewMeasurementControllerOptions {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
}

export interface BabylonSceneViewMeasurementController {
  beginAt(clientX: number, clientY: number): EditorViewportGroundMeasurement | null;
  previewAt(clientX: number, clientY: number): EditorViewportGroundMeasurement | null;
  completeAt(clientX: number, clientY: number): EditorViewportGroundMeasurement | null;
  clear(): EditorViewportGroundMeasurement;
  getState(): EditorViewportGroundMeasurement;
  dispose(): void;
}

export function createBabylonSceneViewMeasurementController(
  options: BabylonSceneViewMeasurementControllerOptions,
): BabylonSceneViewMeasurementController {
  let disposed = false;
  let state = createEmptyMeasurementState();

  function beginAt(clientX: number, clientY: number): EditorViewportGroundMeasurement | null {
    if (disposed) return null;
    const point = pickGroundPoint(options, clientX, clientY);
    if (!point) return null;
    state = projectMeasurementState(options, {
      active: true,
      start: point,
      end: null,
      preview: point,
      distance: null,
    });
    return cloneMeasurement(state);
  }

  function previewAt(clientX: number, clientY: number): EditorViewportGroundMeasurement | null {
    if (disposed || !state.active || !state.start || state.end) return null;
    const point = pickGroundPoint(options, clientX, clientY);
    if (!point) return null;
    state = projectMeasurementState(options, {
      active: true,
      start: state.start,
      end: null,
      preview: point,
      distance: distanceXZ(state.start, point),
    });
    return cloneMeasurement(state);
  }

  function completeAt(clientX: number, clientY: number): EditorViewportGroundMeasurement | null {
    if (disposed || !state.active || !state.start) return null;
    const point = pickGroundPoint(options, clientX, clientY);
    if (!point) return null;
    state = projectMeasurementState(options, {
      active: false,
      start: state.start,
      end: point,
      preview: null,
      distance: distanceXZ(state.start, point),
    });
    return cloneMeasurement(state);
  }

  function clear(): EditorViewportGroundMeasurement {
    state = createEmptyMeasurementState();
    return cloneMeasurement(state);
  }

  return {
    beginAt,
    previewAt,
    completeAt,
    clear,
    getState: () => {
      state = projectMeasurementState(options, state);
      return cloneMeasurement(state);
    },
    dispose() {
      disposed = true;
      state = createEmptyMeasurementState();
    },
  };
}

export function createEmptyMeasurementState(): EditorViewportGroundMeasurement {
  return {
    active: false,
    start: null,
    end: null,
    preview: null,
    distance: null,
    screenStart: null,
    screenEnd: null,
    screenPreview: null,
    label: null,
  };
}

export function pickGroundPoint(
  options: BabylonSceneViewMeasurementControllerOptions,
  clientX: number,
  clientY: number,
): EditorTransformVec3 | null {
  const scene = options.scene;
  const Matrix = (options.babylon as any).Matrix;
  const camera = scene.activeCamera ?? (scene as any).cameraToUseForPointers ?? null;
  const canvas = scene.getEngine?.().getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  if (!canvas || !camera || !Matrix?.Identity || typeof scene.createPickingRay !== 'function') return null;
  const rect = canvas.getBoundingClientRect();
  const renderWidth = Math.max(1, Number(scene.getEngine?.().getRenderWidth?.() ?? canvas.width ?? rect.width));
  const renderHeight = Math.max(1, Number(scene.getEngine?.().getRenderHeight?.() ?? canvas.height ?? rect.height));
  const renderX = (clientX - rect.left) * (renderWidth / Math.max(1, rect.width));
  const renderY = (clientY - rect.top) * (renderHeight / Math.max(1, rect.height));
  const ray = scene.createPickingRay(renderX, renderY, Matrix.Identity(), camera);
  const origin = readVec3(ray?.origin);
  const direction = readVec3(ray?.direction);
  if (!origin || !direction || Math.abs(direction.y) < 0.000001) return null;
  const t = -origin.y / direction.y;
  if (!Number.isFinite(t) || t < 0) return null;
  return addVec3(origin, scaleVec3(direction, t));
}

export function projectMeasurementState(
  options: BabylonSceneViewMeasurementControllerOptions,
  measurement: EditorViewportGroundMeasurement,
): EditorViewportGroundMeasurement {
  const start = measurement.start ? { ...measurement.start } : null;
  const end = measurement.end ? { ...measurement.end } : null;
  const preview = measurement.preview ? { ...measurement.preview } : null;
  const screenStart = start ? projectWorldPoint(options, start) : null;
  const screenEnd = end ? projectWorldPoint(options, end) : null;
  const screenPreview = preview ? projectWorldPoint(options, preview) : null;
  const labelEnd = screenEnd ?? screenPreview;
  const distance = measurement.distance ?? (start && (end ?? preview) ? distanceXZ(start, end ?? preview!) : null);
  return {
    active: measurement.active,
    start,
    end,
    preview,
    distance,
    screenStart,
    screenEnd,
    screenPreview,
    label: screenStart && labelEnd && distance != null
      ? {
          text: `${formatMeasurementDistance(distance)} m`,
          x: (screenStart.x + labelEnd.x) / 2,
          y: (screenStart.y + labelEnd.y) / 2 - 14,
        }
      : null,
  };
}

export function formatMeasurementDistance(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

function projectWorldPoint(
  options: BabylonSceneViewMeasurementControllerOptions,
  point: EditorTransformVec3,
): EditorViewportScreenPoint | null {
  const Vector3 = options.babylon.Vector3 as any;
  const Matrix = (options.babylon as any).Matrix;
  const scene = options.scene;
  const camera = scene.activeCamera ?? (scene as any).cameraToUseForPointers ?? null;
  const canvas = scene.getEngine?.().getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  const viewport = camera?.viewport?.toGlobal?.(
    scene.getEngine?.().getRenderWidth?.() ?? canvas?.width ?? 0,
    scene.getEngine?.().getRenderHeight?.() ?? canvas?.height ?? 0,
  );
  const transformMatrix = scene.getTransformMatrix?.();
  if (!Vector3?.Project || !Matrix?.Identity || !camera || !canvas || !viewport || !transformMatrix) return null;
  const rect = canvas.getBoundingClientRect();
  const renderWidth = Math.max(1, Number(scene.getEngine?.().getRenderWidth?.() ?? canvas.width ?? rect.width));
  const renderHeight = Math.max(1, Number(scene.getEngine?.().getRenderHeight?.() ?? canvas.height ?? rect.height));
  const projected = Vector3.Project(
    new Vector3(point.x, point.y, point.z),
    Matrix.Identity(),
    transformMatrix,
    viewport,
  );
  const x = rect.left + Number(projected?.x) * (rect.width / renderWidth);
  const y = rect.top + Number(projected?.y) * (rect.height / renderHeight);
  const depth = Number(projected?.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(depth)) return null;
  return { x, y, depth };
}

function cloneMeasurement(measurement: EditorViewportGroundMeasurement): EditorViewportGroundMeasurement {
  return {
    active: measurement.active,
    start: measurement.start ? { ...measurement.start } : null,
    end: measurement.end ? { ...measurement.end } : null,
    preview: measurement.preview ? { ...measurement.preview } : null,
    distance: measurement.distance,
    screenStart: measurement.screenStart ? { ...measurement.screenStart } : null,
    screenEnd: measurement.screenEnd ? { ...measurement.screenEnd } : null,
    screenPreview: measurement.screenPreview ? { ...measurement.screenPreview } : null,
    label: measurement.label ? { ...measurement.label } : null,
  };
}

function readVec3(value: any): EditorTransformVec3 | null {
  if (!value) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
}

function addVec3(left: EditorTransformVec3, right: EditorTransformVec3): EditorTransformVec3 {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

function scaleVec3(value: EditorTransformVec3, factor: number): EditorTransformVec3 {
  return { x: value.x * factor, y: value.y * factor, z: value.z * factor };
}

function distanceXZ(left: EditorTransformVec3, right: EditorTransformVec3): number {
  return Math.hypot(right.x - left.x, right.z - left.z);
}
