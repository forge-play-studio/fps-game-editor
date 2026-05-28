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

export interface BabylonEditorGridColorOptions {
  gridColor?: { r: number; g: number; b: number };
  majorGridColor?: { r: number; g: number; b: number };
  axisXColor?: { r: number; g: number; b: number };
  axisZColor?: { r: number; g: number; b: number };
}

export interface BabylonEditorGridController {
  setVisible(visible: boolean): void;
  setColors(colors: BabylonEditorGridColorOptions): void;
  isVisible(): boolean;
  getStep(): number;
  dispose(): void;
}

interface GridLine {
  mesh: any;
  direction: 'x' | 'z';
  offsetIndex: number;
}

interface GridCenter {
  x: number;
  z: number;
}

interface GridFrameState {
  center: GridCenter;
  step: number;
  majorStep: number;
  lineSpan: number;
}

const DEFAULT_STEP = 1;
const DEFAULT_MAJOR_STEP_MULTIPLIER = 5;
const DEFAULT_HALF_LINE_COUNT = 80;
const DEFAULT_TARGET_SCREEN_SPACING_PX = 48;
const DEFAULT_GRID_COLOR = { r: 0.18, g: 0.27, b: 0.42 };
const DEFAULT_MAJOR_GRID_COLOR = { r: 0.24, g: 0.36, b: 0.56 };
const DEFAULT_AXIS_X_COLOR = { r: 0.8, g: 0.22, b: 0.22 };
const DEFAULT_AXIS_Z_COLOR = { r: 0.22, g: 0.55, b: 0.85 };
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
  if (!scene || !MeshBuilder?.CreateLines || !Vector3 || !Color3) return createNoopGridController();

  const minStep = normalizePositive(options.step, DEFAULT_STEP);
  const adaptiveSteps = normalizeAdaptiveSteps(options.adaptiveSteps, minStep);
  const targetScreenSpacingPx = normalizePositive(
    options.targetScreenSpacingPx,
    DEFAULT_TARGET_SCREEN_SPACING_PX,
  );
  const halfLineCount = Math.max(4, Math.floor(normalizePositive(options.halfLineCount, DEFAULT_HALF_LINE_COUNT)));
  const name = options.name ?? 'editor-infinite-grid';
  const defaultColors: Required<BabylonEditorGridColorOptions> = {
    gridColor: options.gridColor ?? DEFAULT_GRID_COLOR,
    majorGridColor: options.majorGridColor ?? DEFAULT_MAJOR_GRID_COLOR,
    axisXColor: options.axisXColor ?? DEFAULT_AXIS_X_COLOR,
    axisZColor: options.axisZColor ?? DEFAULT_AXIS_Z_COLOR,
  };
  let gridColor = createColor(Color3, defaultColors.gridColor);
  let majorGridColor = createColor(Color3, defaultColors.majorGridColor);
  let axisXColor = createColor(Color3, defaultColors.axisXColor);
  let axisZColor = createColor(Color3, defaultColors.axisZColor);
  const lines: GridLine[] = [];
  let visible = true;
  let disposed = false;
  let currentStep = minStep;
  let lastFrameState: GridFrameState | null = null;
  let renderObserver: unknown = null;

  for (let offsetIndex = -halfLineCount; offsetIndex <= halfLineCount; offsetIndex += 1) {
    lines.push(createGridLine('x', offsetIndex));
    lines.push(createGridLine('z', offsetIndex));
  }

  updateGrid(true);
  renderObserver = scene.onBeforeRenderObservable?.add?.(() => updateGrid(false)) ?? null;

  function createGridLine(direction: 'x' | 'z', offsetIndex: number): GridLine {
    const mesh = MeshBuilder.CreateLines(`${name}-${direction}-${offsetIndex}`, {
      points: [new Vector3(0, 0, 0), new Vector3(0, 0, 0)],
      updatable: true,
    }, scene);
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 0;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      editorProjectionHelper: true,
      editorGrid: true,
    };
    return { mesh, direction, offsetIndex };
  }

  function updateGrid(force: boolean): void {
    if (disposed || !visible) return;
    const frameState = readGridFrameState();
    if (!force && lastFrameState && isSameGridFrameState(lastFrameState, frameState)) return;
    lastFrameState = frameState;
    currentStep = frameState.step;
    for (const line of lines) {
      updateGridLine(line, frameState);
    }
  }

  function readGridFrameState(): GridFrameState {
    const step = resolveAdaptiveStep(scene, options.camera ?? null, adaptiveSteps, targetScreenSpacingPx);
    const majorStep = normalizePositive(options.majorStep, step * DEFAULT_MAJOR_STEP_MULTIPLIER);
    return {
      center: readGridCenter(scene, options.camera ?? null, step),
      step,
      majorStep,
      lineSpan: halfLineCount * step,
    };
  }

  function updateGridLine(line: GridLine, frameState: GridFrameState): void {
    const offset = line.offsetIndex * frameState.step;
    const xMin = frameState.center.x - frameState.lineSpan;
    const xMax = frameState.center.x + frameState.lineSpan;
    const zMin = frameState.center.z - frameState.lineSpan;
    const zMax = frameState.center.z + frameState.lineSpan;
    const coordinate = line.direction === 'x' ? frameState.center.z + offset : frameState.center.x + offset;
    const points = line.direction === 'x'
      ? [new Vector3(xMin, 0, coordinate), new Vector3(xMax, 0, coordinate)]
      : [new Vector3(coordinate, 0, zMin), new Vector3(coordinate, 0, zMax)];
    MeshBuilder.CreateLines(line.mesh.name, {
      points,
      instance: line.mesh,
    }, scene);
    line.mesh.color = resolveLineColor(line.direction, coordinate, frameState.step, frameState.majorStep);
  }

  function resolveLineColor(direction: 'x' | 'z', coordinate: number, step: number, majorStep: number): any {
    const axisThreshold = step * 0.25;
    if (Math.abs(coordinate) <= axisThreshold) return direction === 'x' ? axisXColor : axisZColor;
    const majorIndex = Math.round(coordinate / majorStep);
    if (Math.abs(coordinate - majorIndex * majorStep) <= step * 0.1) return majorGridColor;
    return gridColor;
  }

  return {
    setVisible(nextVisible) {
      visible = nextVisible;
      for (const line of lines) {
        line.mesh.setEnabled?.(nextVisible);
      }
      if (nextVisible) updateGrid(true);
    },
    setColors(colors) {
      gridColor = createColor(Color3, colors.gridColor ?? defaultColors.gridColor);
      majorGridColor = createColor(Color3, colors.majorGridColor ?? defaultColors.majorGridColor);
      axisXColor = createColor(Color3, colors.axisXColor ?? defaultColors.axisXColor);
      axisZColor = createColor(Color3, colors.axisZColor ?? defaultColors.axisZColor);
      updateGrid(true);
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
      for (const line of lines) {
        try { line.mesh.dispose?.(); } catch {}
      }
      lines.length = 0;
      lastFrameState = null;
    },
  };
}

function isSameGridFrameState(left: GridFrameState, right: GridFrameState): boolean {
  return left.step === right.step
    && left.majorStep === right.majorStep
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
    setColors() {},
    isVisible() {
      return false;
    },
    getStep() {
      return DEFAULT_STEP;
    },
    dispose() {},
  };
}
