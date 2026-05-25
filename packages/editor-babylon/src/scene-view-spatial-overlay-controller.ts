import type {
  EditorTransformVec3,
  EditorViewportBounds,
  EditorViewportOverlaySettings,
  EditorViewportSpatialOverlayLabel,
  EditorViewportSpatialOverlayLine,
  EditorViewportSpatialOverlayMarker,
  EditorViewportSpatialOverlayState,
} from '@fps-games/editor-core';
import {
  createEmptyEditorViewportSpatialOverlayState,
} from '@fps-games/editor-core';
import type {
  BabylonRuntimeGlobal,
  RuntimeScene,
} from './types';

export interface BabylonSceneViewSpatialOverlayControllerOptions {
  babylon: BabylonRuntimeGlobal;
  scene: RuntimeScene;
}

export interface BabylonSceneViewSpatialOverlayInput {
  nodeId: string | null;
  bounds: EditorViewportBounds | null;
  anchor: EditorTransformVec3 | null;
  settings: EditorViewportOverlaySettings;
}

export interface BabylonSceneViewSpatialOverlayController {
  compute(input: BabylonSceneViewSpatialOverlayInput): EditorViewportSpatialOverlayState;
  dispose(): void;
}

interface ProjectedCorner {
  key: BoundsCornerKey;
  world: EditorTransformVec3;
  screen: ProjectedPoint;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

type BoundsCornerKey =
  | 'min-min-min'
  | 'max-min-min'
  | 'min-max-min'
  | 'max-max-min'
  | 'min-min-max'
  | 'max-min-max'
  | 'min-max-max'
  | 'max-max-max';

interface BoundsEdge {
  id: string;
  axis: 'x' | 'y' | 'z';
  start: BoundsCornerKey;
  end: BoundsCornerKey;
}

const MIN_LABEL_EDGE_LENGTH_PX = 34;

const BOUNDS_EDGES = [
  { id: 'x-y0-z0', axis: 'x', start: 'min-min-min', end: 'max-min-min' },
  { id: 'x-y1-z0', axis: 'x', start: 'min-max-min', end: 'max-max-min' },
  { id: 'x-y0-z1', axis: 'x', start: 'min-min-max', end: 'max-min-max' },
  { id: 'x-y1-z1', axis: 'x', start: 'min-max-max', end: 'max-max-max' },
  { id: 'y-x0-z0', axis: 'y', start: 'min-min-min', end: 'min-max-min' },
  { id: 'y-x1-z0', axis: 'y', start: 'max-min-min', end: 'max-max-min' },
  { id: 'y-x0-z1', axis: 'y', start: 'min-min-max', end: 'min-max-max' },
  { id: 'y-x1-z1', axis: 'y', start: 'max-min-max', end: 'max-max-max' },
  { id: 'z-x0-y0', axis: 'z', start: 'min-min-min', end: 'min-min-max' },
  { id: 'z-x1-y0', axis: 'z', start: 'max-min-min', end: 'max-min-max' },
  { id: 'z-x0-y1', axis: 'z', start: 'min-max-min', end: 'min-max-max' },
  { id: 'z-x1-y1', axis: 'z', start: 'max-max-min', end: 'max-max-max' },
] as const satisfies readonly BoundsEdge[];

const DIMENSION_EDGES = [
  BOUNDS_EDGES[0],
  BOUNDS_EDGES[4],
  BOUNDS_EDGES[8],
] as const satisfies readonly BoundsEdge[];

export function createBabylonSceneViewSpatialOverlayController(
  options: BabylonSceneViewSpatialOverlayControllerOptions,
): BabylonSceneViewSpatialOverlayController {
  let disposed = false;

  return {
    compute(input) {
      if (disposed) return createEmptyEditorViewportSpatialOverlayState();
      return createEditorViewportSpatialOverlayState(options, input);
    },
    dispose() {
      disposed = true;
    },
  };
}

export function createEditorViewportSpatialOverlayState(
  options: BabylonSceneViewSpatialOverlayControllerOptions,
  input: BabylonSceneViewSpatialOverlayInput,
): EditorViewportSpatialOverlayState {
  if (!input.nodeId || !input.bounds) return createEmptyEditorViewportSpatialOverlayState();
  const projectedCorners = projectBoundsCorners(options, input.bounds);
  if (!projectedCorners) return createEmptyEditorViewportSpatialOverlayState();
  const cornerMap = new Map(projectedCorners.map(corner => [corner.key, corner]));
  const lines: EditorViewportSpatialOverlayLine[] = [];
  const labels: EditorViewportSpatialOverlayLabel[] = [];

  if (input.settings.bounds) {
    for (const edge of BOUNDS_EDGES) {
      const line = createOverlayLine(edge, cornerMap);
      if (line) lines.push(line);
    }
  }

  if (input.settings.dimensions) {
    for (const edge of DIMENSION_EDGES) {
      const label = createEdgeLabel(edge, cornerMap, input.bounds, 'dimension');
      if (label) labels.push(label);
    }
  }

  if (input.settings.edgeLengths) {
    for (const edge of BOUNDS_EDGES) {
      const label = createEdgeLabel(edge, cornerMap, input.bounds, 'edge-length');
      if (label) labels.push(label);
    }
  }

  const markers: EditorViewportSpatialOverlayMarker[] = [];
  if (input.settings.anchor && input.anchor) {
    const anchor = projectWorldPoint(options, input.anchor);
    if (anchor) {
      const label = `Anchor ${formatVec3(input.anchor)}`;
      markers.push({
        id: 'anchor',
        kind: 'anchor',
        position: anchor,
        label,
      });
      labels.push({
        id: 'anchor-label',
        kind: 'anchor',
        text: label,
        x: anchor.x,
        y: anchor.y - 18,
      });
    }
  }

  return {
    active: lines.length > 0 || labels.length > 0 || markers.length > 0,
    nodeId: input.nodeId,
    bounds: cloneBounds(input.bounds),
    anchor: input.anchor ? { ...input.anchor } : null,
    lines,
    labels,
    markers,
  };
}

function projectBoundsCorners(
  options: BabylonSceneViewSpatialOverlayControllerOptions,
  bounds: EditorViewportBounds,
): ProjectedCorner[] | null {
  const corners: Array<[BoundsCornerKey, EditorTransformVec3]> = [
    ['min-min-min', { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z }],
    ['max-min-min', { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z }],
    ['min-max-min', { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z }],
    ['max-max-min', { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z }],
    ['min-min-max', { x: bounds.min.x, y: bounds.min.y, z: bounds.max.z }],
    ['max-min-max', { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z }],
    ['min-max-max', { x: bounds.min.x, y: bounds.max.y, z: bounds.max.z }],
    ['max-max-max', { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }],
  ];
  const projected: ProjectedCorner[] = [];
  for (const [key, world] of corners) {
    const screen = projectWorldPoint(options, world);
    if (!screen) return null;
    projected.push({ key, world, screen });
  }
  return projected;
}

function projectWorldPoint(
  options: BabylonSceneViewSpatialOverlayControllerOptions,
  point: EditorTransformVec3,
): ProjectedPoint | null {
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
  const canvasRect = canvas.getBoundingClientRect();
  const renderWidth = Math.max(1, Number(scene.getEngine?.().getRenderWidth?.() ?? canvas.width ?? canvasRect.width));
  const renderHeight = Math.max(1, Number(scene.getEngine?.().getRenderHeight?.() ?? canvas.height ?? canvasRect.height));
  const cssScaleX = canvasRect.width / renderWidth;
  const cssScaleY = canvasRect.height / renderHeight;
  const projected = Vector3.Project(
    new Vector3(point.x, point.y, point.z),
    Matrix.Identity(),
    transformMatrix,
    viewport,
  );
  const x = canvasRect.left + Number(projected?.x) * cssScaleX;
  const y = canvasRect.top + Number(projected?.y) * cssScaleY;
  const depth = Number(projected?.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(depth)) return null;
  return { x, y, depth };
}

function createOverlayLine(
  edge: BoundsEdge,
  corners: Map<BoundsCornerKey, ProjectedCorner>,
): EditorViewportSpatialOverlayLine | null {
  const start = corners.get(edge.start)?.screen;
  const end = corners.get(edge.end)?.screen;
  if (!start || !end) return null;
  return {
    id: edge.id,
    kind: 'bounds',
    start: { ...start },
    end: { ...end },
  };
}

function createEdgeLabel(
  edge: BoundsEdge,
  corners: Map<BoundsCornerKey, ProjectedCorner>,
  bounds: EditorViewportBounds,
  kind: 'dimension' | 'edge-length',
): EditorViewportSpatialOverlayLabel | null {
  const start = corners.get(edge.start)?.screen;
  const end = corners.get(edge.end)?.screen;
  if (!start || !end) return null;
  const screenLength = Math.hypot(end.x - start.x, end.y - start.y);
  if (screenLength < MIN_LABEL_EDGE_LENGTH_PX) return null;
  return {
    id: `${kind}-${edge.id}`,
    kind,
    text: kind === 'dimension'
      ? `${edge.axis.toUpperCase()} ${formatNumber(bounds.size[edge.axis])}`
      : formatNumber(bounds.size[edge.axis]),
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function cloneBounds(bounds: EditorViewportBounds): EditorViewportBounds {
  return {
    min: { ...bounds.min },
    max: { ...bounds.max },
    center: { ...bounds.center },
    size: { ...bounds.size },
  };
}

export function formatEditorViewportOverlayNumber(value: number): string {
  return formatNumber(value);
}

function formatVec3(value: EditorTransformVec3): string {
  return `(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.abs(value) < 0.005 ? 0 : value;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}
