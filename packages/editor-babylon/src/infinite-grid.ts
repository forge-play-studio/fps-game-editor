import type {
  BabylonRuntimeGlobal,
  RuntimeCamera,
  RuntimeScene,
} from './types';

export interface BabylonEditorInfiniteGridOptions {
  babylon: BabylonRuntimeGlobal & Record<string, any>;
  scene: RuntimeScene;
  camera?: RuntimeCamera | null;
  getCamera?: () => RuntimeCamera | null | undefined;
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
  step: number;
  layers: GridLayerFrameState[];
}

interface GridLayerFrameState {
  level: number;
  center: GridCenter;
  step: number;
  majorStep: number;
  visibleHalfLineCount: number;
  lineSpan: number;
  includeAxis: boolean;
}

interface GridFootprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  focus: GridCenter;
}

const DEFAULT_STEP = 1;
const DEFAULT_MAJOR_STEP_MULTIPLIER = 5;
const DEFAULT_HALF_LINE_COUNT = 80;
const DEFAULT_TARGET_SCREEN_SPACING_PX = 48;
const MAX_LINES_PER_LINE_SYSTEM = 64;
const MAX_GRID_LOD_LAYER_COUNT = 3;
const GRID_FOOTPRINT_COVERAGE_PADDING = 1.15;
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
  const Matrix = options.babylon.Matrix as any;
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
    ...createLineGroups('regular', lines.length * MAX_GRID_LOD_LAYER_COUNT, gridColor),
    ...createLineGroups('major', lines.length * MAX_GRID_LOD_LAYER_COUNT, majorGridColor),
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
    for (const layer of frameState.layers) {
      for (const line of lines) {
        if (Math.abs(line.offsetIndex) > layer.visibleHalfLineCount) continue;
        const resolvedLine = createGridLinePoints(line, layer);
        const group = layer.includeAxis
          ? resolvedLine.group
          : (resolvedLine.group === 'axis-x' || resolvedLine.group === 'axis-z' ? 'major' : resolvedLine.group);
        grouped[group].push(resolvedLine.points);
      }
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
    const camera = readGridCamera();
    const footprint = estimateVisibleGridFootprint(scene, camera, Matrix);
    const step = resolveAdaptiveStep(scene, camera, adaptiveSteps, targetScreenSpacingPx);
    const layers = createGridLodLayers({
      scene,
      camera,
      footprint,
      baseStep: step,
      baseMajorStep: normalizePositive(options.majorStep, step * DEFAULT_MAJOR_STEP_MULTIPLIER),
      adaptiveSteps,
      halfLineCount,
    });
    return {
      step,
      layers,
    };
  }

  function readGridCamera(): RuntimeCamera | null {
    return options.getCamera?.() ?? options.camera ?? scene?.activeCamera ?? null;
  }

  function createGridLinePoints(
    line: GridLine,
    frameState: GridLayerFrameState,
  ): { group: GridLineGroupKey; points: any[] } {
    const offset = line.offsetIndex * frameState.step;
    const xMin = frameState.center.x - frameState.lineSpan;
    const xMax = frameState.center.x + frameState.lineSpan;
    const zMin = frameState.center.z - frameState.lineSpan;
    const zMax = frameState.center.z + frameState.lineSpan;
    const coordinate = line.direction === 'x' ? frameState.center.z + offset : frameState.center.x + offset;
    const points = [new Vector3(0, 0, 0), new Vector3(0, 0, 0)];
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
    && left.layers.length === right.layers.length
    && left.layers.every((layer, index) => isSameGridLayerFrameState(layer, right.layers[index]));
}

function isSameGridLayerFrameState(left: GridLayerFrameState, right: GridLayerFrameState | undefined): boolean {
  return !!right
    && left.level === right.level
    && left.step === right.step
    && left.majorStep === right.majorStep
    && left.visibleHalfLineCount === right.visibleHalfLineCount
    && left.lineSpan === right.lineSpan
    && left.includeAxis === right.includeAxis
    && left.center.x === right.center.x
    && left.center.z === right.center.z;
}

function createGridLodLayers(options: {
  scene: RuntimeScene;
  camera: RuntimeCamera | null;
  footprint: GridFootprint | null;
  baseStep: number;
  baseMajorStep: number;
  adaptiveSteps: number[];
  halfLineCount: number;
}): GridLayerFrameState[] {
  const fineCenter = readGridFocusCenter(options.scene, options.camera, options.baseStep, options.footprint);
  const fineLayer = createGridLayerFrameState({
    level: 0,
    center: fineCenter,
    step: options.baseStep,
    majorStep: options.baseMajorStep,
    halfLineCount: options.halfLineCount,
    desiredHalfSpan: options.halfLineCount * options.baseStep,
    includeAxis: true,
  });
  if (!options.footprint) return [fineLayer];

  const coverageHalfSpan = estimateFootprintHalfSpan(options.footprint) * GRID_FOOTPRINT_COVERAGE_PADDING;
  if (!Number.isFinite(coverageHalfSpan) || coverageHalfSpan <= fineLayer.lineSpan * 1.05) {
    return [fineLayer];
  }

  const layers = [fineLayer];
  const farStep = resolveCoverageStep(
    coverageHalfSpan,
    options.halfLineCount,
    options.baseStep,
    options.adaptiveSteps,
  );
  const midStep = resolveMidLodStep(options.baseStep, farStep, options.adaptiveSteps);
  if (midStep && midStep > options.baseStep * 1.001 && midStep < farStep * 0.999) {
    layers.push(createGridLayerFrameState({
      level: 1,
      center: readGridCoverageCenter(options.footprint, midStep),
      step: midStep,
      majorStep: midStep * DEFAULT_MAJOR_STEP_MULTIPLIER,
      halfLineCount: options.halfLineCount,
      desiredHalfSpan: Math.min(coverageHalfSpan, options.halfLineCount * midStep),
      includeAxis: false,
    }));
  }
  if (farStep > options.baseStep * 1.001) {
    layers.push(createGridLayerFrameState({
      level: layers.length,
      center: readGridCoverageCenter(options.footprint, farStep),
      step: farStep,
      majorStep: farStep * DEFAULT_MAJOR_STEP_MULTIPLIER,
      halfLineCount: options.halfLineCount,
      desiredHalfSpan: coverageHalfSpan,
      includeAxis: false,
    }));
  }
  return layers.slice(0, MAX_GRID_LOD_LAYER_COUNT);
}

function createGridLayerFrameState(options: {
  level: number;
  center: GridCenter;
  step: number;
  majorStep: number;
  halfLineCount: number;
  desiredHalfSpan: number;
  includeAxis: boolean;
}): GridLayerFrameState {
  const visibleHalfLineCount = Math.max(
    4,
    Math.min(options.halfLineCount, Math.ceil(options.desiredHalfSpan / options.step)),
  );
  return {
    level: options.level,
    center: options.center,
    step: options.step,
    majorStep: options.majorStep,
    visibleHalfLineCount,
    lineSpan: visibleHalfLineCount * options.step,
    includeAxis: options.includeAxis,
  };
}

function readGridCenter(
  scene: RuntimeScene,
  camera: RuntimeCamera | null,
  step: number,
): GridCenter {
  const activeCamera = camera ?? scene?.activeCamera ?? null;
  const source = activeCamera?.target ?? activeCamera?.position ?? { x: 0, z: 0 };
  return {
    x: Math.floor((Number(source.x) || 0) / step) * step,
    z: Math.floor((Number(source.z) || 0) / step) * step,
  };
}

function readGridFocusCenter(
  scene: RuntimeScene,
  camera: RuntimeCamera | null,
  step: number,
  footprint: GridFootprint | null,
): GridCenter {
  if (footprint) return quantizeGridCenter(footprint.focus, step);
  return readGridCenter(scene, camera, step);
}

function readGridCoverageCenter(footprint: GridFootprint, step: number): GridCenter {
  return quantizeGridCenter({
    x: (footprint.minX + footprint.maxX) / 2,
    z: (footprint.minZ + footprint.maxZ) / 2,
  }, step);
}

function quantizeGridCenter(center: GridCenter, step: number): GridCenter {
  return {
    x: Math.floor(center.x / step) * step,
    z: Math.floor(center.z / step) * step,
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

function resolveCoverageStep(
  coverageHalfSpan: number,
  halfLineCount: number,
  baseStep: number,
  steps: number[],
): number {
  const requiredStep = Number.isFinite(coverageHalfSpan) && coverageHalfSpan > 0 && halfLineCount > 0
    ? coverageHalfSpan / halfLineCount
    : baseStep;
  return pickAdaptiveStepAtLeast(steps, Math.max(baseStep, requiredStep));
}

function resolveMidLodStep(baseStep: number, farStep: number, steps: number[]): number | null {
  if (!Number.isFinite(farStep) || farStep <= baseStep * DEFAULT_MAJOR_STEP_MULTIPLIER) return null;
  const target = Math.sqrt(baseStep * farStep);
  return pickAdaptiveStepAtLeast(steps, Math.max(baseStep * DEFAULT_MAJOR_STEP_MULTIPLIER, target));
}

function pickAdaptiveStepAtLeast(steps: number[], minStep: number): number {
  const normalizedMinStep = normalizePositive(minStep, DEFAULT_STEP);
  return steps.find(step => step >= normalizedMinStep) ?? normalizedMinStep;
}

function estimateFootprintHalfSpan(footprint: GridFootprint): number {
  const centerX = (footprint.minX + footprint.maxX) / 2;
  const centerZ = (footprint.minZ + footprint.maxZ) / 2;
  return Math.max(
    Math.abs(footprint.minX - centerX),
    Math.abs(footprint.maxX - centerX),
    Math.abs(footprint.minZ - centerZ),
    Math.abs(footprint.maxZ - centerZ),
  );
}

function estimatePixelsPerWorldUnit(
  scene: RuntimeScene,
  camera: RuntimeCamera | null,
): number {
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

function estimateVisibleGridFootprint(
  scene: RuntimeScene,
  camera: RuntimeCamera | null,
  Matrix: any,
): GridFootprint | null {
  if (!camera || !Matrix?.Identity || typeof scene?.createPickingRay !== 'function') return null;
  const engine = scene?.getEngine?.();
  const viewport = readCameraViewport(engine, camera);
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return null;
  const samples = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [1, 0.5],
    [1, 1],
    [0.5, 1],
    [0, 1],
    [0, 0.5],
    [0.5, 0.5],
  ];
  const samplePoints = samples
    .map(([x, y]) => {
      const ray = scene.createPickingRay(
        viewport.x + viewport.width * x,
        viewport.y + viewport.height * y,
        Matrix.Identity(),
        camera,
      );
      const point = intersectRayWithGround(ray, camera);
      return point ? { point, screenDistance: Math.hypot(x - 0.5, y - 0.5) } : null;
    })
    .filter((sample): sample is { point: GridCenter; screenDistance: number } => !!sample);
  if (samplePoints.length < 2) return null;
  const points = samplePoints.map(sample => sample.point);
  const focus = [...samplePoints].sort((left, right) => left.screenDistance - right.screenDistance)[0]?.point ?? {
    x: (Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2,
    z: (Math.min(...points.map(point => point.z)) + Math.max(...points.map(point => point.z))) / 2,
  };
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)),
    maxZ: Math.max(...points.map(point => point.z)),
    focus,
  };
}

function readCameraViewport(engine: any, camera: RuntimeCamera): { x: number; y: number; width: number; height: number } | null {
  const renderWidth = readViewportWidth(engine);
  const renderHeight = readViewportHeight(engine);
  const viewport = camera?.viewport?.toGlobal?.(renderWidth, renderHeight);
  if (viewport) {
    return {
      x: Number(viewport.x) || 0,
      y: Number(viewport.y) || 0,
      width: Number(viewport.width) || 0,
      height: Number(viewport.height) || 0,
    };
  }
  return { x: 0, y: 0, width: renderWidth, height: renderHeight };
}

function intersectRayWithGround(ray: any, camera: RuntimeCamera): { x: number; z: number } | null {
  const origin = ray?.origin;
  const direction = ray?.direction;
  const originY = Number(origin?.y);
  const directionY = Number(direction?.y);
  if (!Number.isFinite(originY) || !Number.isFinite(directionY) || Math.abs(directionY) < 0.000001) return null;
  const t = -originY / directionY;
  if (!Number.isFinite(t) || t < 0) return null;
  const directionLength = Math.hypot(Number(direction.x) || 0, Number(direction.y) || 0, Number(direction.z) || 0) || 1;
  const distance = t * directionLength;
  const minZ = Number(camera?.minZ);
  const maxZ = Number(camera?.maxZ);
  if (Number.isFinite(minZ) && distance < Math.max(0, minZ) * 0.99) return null;
  if (Number.isFinite(maxZ) && maxZ > 0 && distance > maxZ * 1.01) return null;
  const x = Number(origin.x) + (Number(direction.x) || 0) * t;
  const z = Number(origin.z) + (Number(direction.z) || 0) * t;
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
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
