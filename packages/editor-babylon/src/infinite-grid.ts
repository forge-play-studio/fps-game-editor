import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';

export interface BabylonEditorInfiniteGridOptions {
  babylon: BabylonRuntimeGlobal & Record<string, any>;
  scene: RuntimeScene;
  camera?: RuntimeCamera | null;
  name?: string;
  step?: number;
  adaptiveSteps?: number[];
  targetScreenSpacingPx?: number;
  majorStep?: number;
  halfLineCount?: number;
  gridColor?: { r: number; g: number; b: number };
  majorGridColor?: { r: number; g: number; b: number };
  axisXColor?: { r: number; g: number; b: number };
  axisZColor?: { r: number; g: number; b: number };
}

export interface BabylonEditorGridController {
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  getStep(): number;
  dispose(): void;
}

type GridLineDirection = 'x' | 'z';
type GridLineGroupKey = 'regular' | 'major' | 'axis-x' | 'axis-z';

interface GridLine {
  direction: GridLineDirection;
  offsetIndex: number;
  points: any[];
}

interface GridLineGroup {
  key: GridLineGroupKey;
  mesh: any;
  capacity: number;
  hiddenLines: any[][];
  hasLines: boolean;
}

interface GridCenter {
  x: number;
  z: number;
}

interface GridFrameState {
  center: GridCenter;
  step: number;
  majorStep: number;
  visibleHalfLineCount: number;
  lineSpan: number;
}

const DEFAULT_STEP = 1;
const DEFAULT_MAJOR_STEP_MULTIPLIER = 5;
const DEFAULT_HALF_LINE_COUNT = 80;
const DEFAULT_TARGET_SCREEN_SPACING_PX = 48;
const MAX_LINES_PER_LINE_SYSTEM = 64;
const DEFAULT_ADAPTIVE_STEPS = [
  1,
  5,
  10,
  50,
  100,
  500,
  1000,
  5000,
  10000,
  50000,
  100000,
];

export function createBabylonEditorInfiniteGrid(
  options: BabylonEditorInfiniteGridOptions,
): BabylonEditorGridController {
  const MeshBuilder = options.babylon.MeshBuilder as any;
  const Vector3 = options.babylon.Vector3 as any;
  const Color3 = options.babylon.Color3 as any;
  const scene = options.scene;
  if (!scene || !MeshBuilder?.CreateLineSystem || !Vector3 || !Color3) return createNoopGridController();

  const minStep = normalizePositive(options.step, DEFAULT_STEP);
  const adaptiveSteps = normalizeAdaptiveSteps(options.adaptiveSteps, minStep);
  const targetScreenSpacingPx = normalizePositive(
    options.targetScreenSpacingPx,
    DEFAULT_TARGET_SCREEN_SPACING_PX,
  );
  const halfLineCount = Math.max(4, Math.floor(normalizePositive(options.halfLineCount, DEFAULT_HALF_LINE_COUNT)));
  const name = options.name ?? 'editor-infinite-grid';
  const gridColor = createColor(Color3, options.gridColor ?? { r: 0.18, g: 0.27, b: 0.42 });
  const majorGridColor = createColor(Color3, options.majorGridColor ?? { r: 0.24, g: 0.36, b: 0.56 });
  const axisXColor = createColor(Color3, options.axisXColor ?? { r: 0.8, g: 0.22, b: 0.22 });
  const axisZColor = createColor(Color3, options.axisZColor ?? { r: 0.22, g: 0.55, b: 0.85 });
  const lines: GridLine[] = [];
  let lineGroups: GridLineGroup[] = [];
  let visible = true;
  let disposed = false;
  let currentStep = minStep;
  let lastFrameState: GridFrameState | null = null;
  let renderObserver: unknown = null;

  for (let offsetIndex = -halfLineCount; offsetIndex <= halfLineCount; offsetIndex += 1) {
    lines.push(createGridLine('x', offsetIndex));
    lines.push(createGridLine('z', offsetIndex));
  }
  lineGroups = [
    ...createLineGroups('regular', lines.length, gridColor),
    ...createLineGroups('major', lines.length, majorGridColor),
    createLineGroup('axis-x', 1, axisXColor),
    createLineGroup('axis-z', 1, axisZColor),
  ];

  updateGrid(true);
  renderObserver = scene.onBeforeRenderObservable?.add?.(() => updateGrid(false)) ?? null;

  function createGridLine(direction: GridLineDirection, offsetIndex: number): GridLine {
    return {
      direction,
      offsetIndex,
      points: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)],
    };
  }

  function createLineGroups(key: GridLineGroupKey, totalCapacity: number, color: any): GridLineGroup[] {
    const chunkCount = Math.max(1, Math.ceil(totalCapacity / MAX_LINES_PER_LINE_SYSTEM));
    const groups: GridLineGroup[] = [];
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const remainingCapacity = totalCapacity - chunkIndex * MAX_LINES_PER_LINE_SYSTEM;
      groups.push(createLineGroup(
        key,
        Math.min(MAX_LINES_PER_LINE_SYSTEM, remainingCapacity),
        color,
        chunkCount > 1 ? chunkIndex : null,
      ));
    }
    return groups;
  }

  function createLineGroup(
    key: GridLineGroupKey,
    capacity: number,
    color: any,
    chunkIndex: number | null = null,
  ): GridLineGroup {
    const hiddenLines = createHiddenLines(capacity);
    const suffix = chunkIndex === null ? key : `${key}-${chunkIndex}`;
    const mesh = MeshBuilder.CreateLineSystem(`${name}-${suffix}`, {
      lines: hiddenLines,
      updatable: true,
    }, scene);
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 0;
    mesh.color = color;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      editorProjectionHelper: true,
      editorGrid: true,
      editorGridGroup: key,
      editorGridChunk: chunkIndex ?? 0,
    };
    mesh.setEnabled?.(false);
    return { key, mesh, capacity, hiddenLines, hasLines: false };
  }

  function updateGrid(force: boolean): void {
    if (disposed || !visible) return;
    const frameState = readGridFrameState();
    if (!force && lastFrameState && isSameGridFrameState(lastFrameState, frameState)) return;
    lastFrameState = frameState;
    currentStep = frameState.step;
    const nextGroups = createGroupedLines(frameState);
    updateLineGroups(nextGroups);
  }

  function createGroupedLines(frameState: GridFrameState): Record<GridLineGroupKey, any[][]> {
    const grouped: Record<GridLineGroupKey, any[][]> = {
      regular: [],
      major: [],
      'axis-x': [],
      'axis-z': [],
    };
    for (const line of lines) {
      if (Math.abs(line.offsetIndex) > frameState.visibleHalfLineCount) continue;
      const resolvedLine = createGridLinePoints(line, frameState);
      grouped[resolvedLine.group].push(resolvedLine.points);
    }
    return grouped;
  }

  function updateLineGroups(nextGroups: Record<GridLineGroupKey, any[][]>): void {
    const cursors: Record<GridLineGroupKey, number> = {
      regular: 0,
      major: 0,
      'axis-x': 0,
      'axis-z': 0,
    };
    for (const group of lineGroups) {
      const groupLines = nextGroups[group.key] ?? [];
      const start = cursors[group.key] ?? 0;
      const chunkLines = groupLines.slice(start, start + group.capacity);
      cursors[group.key] = start + group.capacity;
      group.hasLines = chunkLines.length > 0;
      MeshBuilder.CreateLineSystem(group.mesh.name, {
        lines: padLines(chunkLines, group),
        instance: group.mesh,
        updatable: true,
      }, scene);
      group.mesh.setEnabled?.(visible && group.hasLines);
    }
  }

  function readGridFrameState(): GridFrameState {
    const step = resolveAdaptiveStep(scene, options.camera ?? null, adaptiveSteps, targetScreenSpacingPx);
    const majorStep = normalizePositive(options.majorStep, step * DEFAULT_MAJOR_STEP_MULTIPLIER);
    const visibleHalfLineCount = resolveVisibleHalfLineCount(scene, options.camera ?? null, step, halfLineCount);
    return {
      center: readGridCenter(scene, options.camera ?? null, step),
      step,
      majorStep,
      visibleHalfLineCount,
      lineSpan: visibleHalfLineCount * step,
    };
  }

  function createGridLinePoints(
    line: GridLine,
    frameState: GridFrameState,
  ): { group: GridLineGroupKey; points: any[] } {
    const offset = line.offsetIndex * frameState.step;
    const xMin = frameState.center.x - frameState.lineSpan;
    const xMax = frameState.center.x + frameState.lineSpan;
    const zMin = frameState.center.z - frameState.lineSpan;
    const zMax = frameState.center.z + frameState.lineSpan;
    const coordinate = line.direction === 'x' ? frameState.center.z + offset : frameState.center.x + offset;
    const points = line.points;
    if (line.direction === 'x') {
      setVector3(points[0], xMin, 0, coordinate);
      setVector3(points[1], xMax, 0, coordinate);
    } else {
      setVector3(points[0], coordinate, 0, zMin);
      setVector3(points[1], coordinate, 0, zMax);
    }
    return {
      group: resolveLineGroup(line.direction, coordinate, frameState.step, frameState.majorStep),
      points,
    };
  }

  function resolveLineGroup(
    direction: GridLineDirection,
    coordinate: number,
    step: number,
    majorStep: number,
  ): GridLineGroupKey {
    const axisThreshold = step * 0.25;
    if (Math.abs(coordinate) <= axisThreshold) return direction === 'x' ? 'axis-x' : 'axis-z';
    const majorIndex = Math.round(coordinate / majorStep);
    if (Math.abs(coordinate - majorIndex * majorStep) <= step * 0.1) return 'major';
    return 'regular';
  }

  function disposeLineGroups(): void {
    for (const group of lineGroups) {
      try { group.mesh.dispose?.(); } catch {}
    }
    lineGroups = [];
  }

  function padLines(groupLines: any[][], group: GridLineGroup): any[][] {
    return [
      ...groupLines.slice(0, group.capacity),
      ...group.hiddenLines.slice(0, Math.max(0, group.capacity - groupLines.length)),
    ];
  }

  function createHiddenLines(count: number): any[][] {
    const lines: any[][] = [];
    for (let index = 0; index < count; index += 1) {
      lines.push([new Vector3(0, 0, 0), new Vector3(0, 0, 0)]);
    }
    return lines;
  }

  function setVector3(target: any, x: number, y: number, z: number): void {
    if (target?.set) {
      target.set(x, y, z);
      return;
    }
    target.x = x;
    target.y = y;
    target.z = z;
  }

  return {
    setVisible(nextVisible) {
      visible = nextVisible;
      for (const group of lineGroups) {
        group.mesh.setEnabled?.(nextVisible && group.hasLines);
      }
      if (nextVisible) updateGrid(true);
    },
    isVisible() {
      return visible;
    },
    getStep() {
      return currentStep;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (renderObserver && scene.onBeforeRenderObservable?.remove) {
        scene.onBeforeRenderObservable.remove(renderObserver);
      }
      renderObserver = null;
      disposeLineGroups();
      lines.length = 0;
      lastFrameState = null;
    },
  };
}

function isSameGridFrameState(left: GridFrameState, right: GridFrameState): boolean {
  return left.step === right.step
    && left.majorStep === right.majorStep
    && left.visibleHalfLineCount === right.visibleHalfLineCount
    && left.lineSpan === right.lineSpan
    && left.center.x === right.center.x
    && left.center.z === right.center.z;
}

function readGridCenter(scene: RuntimeScene, camera: RuntimeCamera | null, step: number): GridCenter {
  const activeCamera = camera ?? scene?.activeCamera ?? null;
  const source = activeCamera?.target ?? activeCamera?.position ?? { x: 0, z: 0 };
  return {
    x: Math.floor((Number(source.x) || 0) / step) * step,
    z: Math.floor((Number(source.z) || 0) / step) * step,
  };
}

function normalizePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function normalizeAdaptiveSteps(steps: number[] | undefined, minStep: number): number[] {
  const source = steps?.length ? steps : DEFAULT_ADAPTIVE_STEPS;
  const normalized = Array.from(new Set(
    source
      .map(value => normalizePositive(value, 0))
      .filter(value => value >= minStep),
  )).sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [minStep];
}

function resolveAdaptiveStep(
  scene: RuntimeScene,
  camera: RuntimeCamera | null,
  steps: number[],
  targetScreenSpacingPx: number,
): number {
  const pixelsPerWorldUnit = estimatePixelsPerWorldUnit(scene, camera);
  if (!Number.isFinite(pixelsPerWorldUnit) || pixelsPerWorldUnit <= 0) return steps[0] ?? DEFAULT_STEP;
  let bestStep = steps[0] ?? DEFAULT_STEP;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const step of steps) {
    const screenSpacing = step * pixelsPerWorldUnit;
    const score = Math.abs(Math.log(Math.max(screenSpacing, 0.0001) / targetScreenSpacingPx));
    if (score < bestScore) {
      bestScore = score;
      bestStep = step;
    }
  }
  return bestStep;
}

function estimatePixelsPerWorldUnit(scene: RuntimeScene, camera: RuntimeCamera | null): number {
  const activeCamera = camera ?? scene?.activeCamera ?? null;
  const engine = scene?.getEngine?.();
  const viewportHeight = readViewportHeight(engine);
  if (!activeCamera || viewportHeight <= 0) return 1;

  const orthoTop = Number(activeCamera.orthoTop);
  const orthoBottom = Number(activeCamera.orthoBottom);
  if (Number.isFinite(orthoTop) && Number.isFinite(orthoBottom) && orthoTop !== orthoBottom) {
    return viewportHeight / Math.abs(orthoTop - orthoBottom);
  }

  const distance = estimateCameraDistanceToTarget(activeCamera);
  const fov = normalizePositive(Number(activeCamera.fov), Math.PI / 4);
  const visibleHeight = 2 * distance * Math.tan(fov / 2);
  return visibleHeight > 0 ? viewportHeight / visibleHeight : 1;
}

function readViewportHeight(engine: any): number {
  const renderHeight = Number(engine?.getRenderHeight?.());
  if (Number.isFinite(renderHeight) && renderHeight > 0) return renderHeight;
  const canvasHeight = Number(engine?.getRenderingCanvas?.()?.clientHeight);
  if (Number.isFinite(canvasHeight) && canvasHeight > 0) return canvasHeight;
  return 720;
}

function readViewportWidth(engine: any): number {
  const renderWidth = Number(engine?.getRenderWidth?.());
  if (Number.isFinite(renderWidth) && renderWidth > 0) return renderWidth;
  const canvasWidth = Number(engine?.getRenderingCanvas?.()?.clientWidth);
  if (Number.isFinite(canvasWidth) && canvasWidth > 0) return canvasWidth;
  return 1280;
}

function resolveVisibleHalfLineCount(
  scene: RuntimeScene,
  camera: RuntimeCamera | null,
  step: number,
  maxHalfLineCount: number,
): number {
  const activeCamera = camera ?? scene?.activeCamera ?? null;
  if (!activeCamera) return maxHalfLineCount;
  const visibleSpan = estimateVisibleGridSpan(scene, activeCamera);
  if (!Number.isFinite(visibleSpan) || visibleSpan <= 0) return maxHalfLineCount;
  const desiredHalfLineCount = Math.ceil((visibleSpan * 1.15) / step);
  return Math.max(4, Math.min(maxHalfLineCount, desiredHalfLineCount));
}

function estimateVisibleGridSpan(scene: RuntimeScene, camera: RuntimeCamera): number {
  const engine = scene?.getEngine?.();
  const viewportHeight = readViewportHeight(engine);
  const viewportWidth = readViewportWidth(engine);
  const aspect = viewportHeight > 0 ? viewportWidth / viewportHeight : 1;

  const orthoTop = Number(camera.orthoTop);
  const orthoBottom = Number(camera.orthoBottom);
  const orthoLeft = Number(camera.orthoLeft);
  const orthoRight = Number(camera.orthoRight);
  if (Number.isFinite(orthoTop)
    && Number.isFinite(orthoBottom)
    && Number.isFinite(orthoLeft)
    && Number.isFinite(orthoRight)
    && orthoTop !== orthoBottom
    && orthoLeft !== orthoRight) {
    return Math.max(Math.abs(orthoTop - orthoBottom), Math.abs(orthoRight - orthoLeft));
  }

  const distance = estimateCameraDistanceToTarget(camera);
  const fov = normalizePositive(Number(camera.fov), Math.PI / 4);
  const visibleHeight = 2 * distance * Math.tan(fov / 2);
  return Math.max(visibleHeight, visibleHeight * aspect);
}

function estimateCameraDistanceToTarget(camera: any): number {
  const radius = Number(camera?.radius);
  if (Number.isFinite(radius) && radius > 0) return radius;
  const position = camera?.position;
  const target = camera?.target;
  if (position && target) {
    const distance = Math.hypot(
      (Number(position.x) || 0) - (Number(target.x) || 0),
      (Number(position.y) || 0) - (Number(target.y) || 0),
      (Number(position.z) || 0) - (Number(target.z) || 0),
    );
    if (Number.isFinite(distance) && distance > 0) return distance;
  }
  const height = Math.abs(Number(position?.y) || 0);
  return height > 0 ? height : 8;
}

function createColor(Color3: any, color: { r: number; g: number; b: number }): any {
  return new Color3(color.r, color.g, color.b);
}

function createNoopGridController(): BabylonEditorGridController {
  return {
    setVisible() {},
    isVisible() {
      return false;
    },
    getStep() {
      return DEFAULT_STEP;
    },
    dispose() {},
  };
}
