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

const DEFAULT_STEP = 1;
const DEFAULT_MAJOR_STEP = 5;
const DEFAULT_HALF_LINE_COUNT = 80;

export function createBabylonEditorInfiniteGrid(
  options: BabylonEditorInfiniteGridOptions,
): BabylonEditorGridController {
  const MeshBuilder = options.babylon.MeshBuilder as any;
  const Vector3 = options.babylon.Vector3 as any;
  const Color3 = options.babylon.Color3 as any;
  const scene = options.scene;
  if (!scene || !MeshBuilder?.CreateLines || !Vector3 || !Color3) return createNoopGridController();

  const step = normalizePositive(options.step, DEFAULT_STEP);
  const majorStep = normalizePositive(options.majorStep, DEFAULT_MAJOR_STEP);
  const halfLineCount = Math.max(4, Math.floor(normalizePositive(options.halfLineCount, DEFAULT_HALF_LINE_COUNT)));
  const lineSpan = halfLineCount * step;
  const name = options.name ?? 'editor-infinite-grid';
  const gridColor = createColor(Color3, options.gridColor ?? { r: 0.18, g: 0.27, b: 0.42 });
  const majorGridColor = createColor(Color3, options.majorGridColor ?? { r: 0.24, g: 0.36, b: 0.56 });
  const axisXColor = createColor(Color3, options.axisXColor ?? { r: 0.8, g: 0.22, b: 0.22 });
  const axisZColor = createColor(Color3, options.axisZColor ?? { r: 0.22, g: 0.55, b: 0.85 });
  const lines: GridLine[] = [];
  let visible = true;
  let disposed = false;
  let lastCenter: GridCenter | null = null;
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
    const center = readGridCenter(scene, options.camera ?? null, step);
    if (!force && lastCenter && center.x === lastCenter.x && center.z === lastCenter.z) return;
    lastCenter = center;
    for (const line of lines) {
      updateGridLine(line, center);
    }
  }

  function updateGridLine(line: GridLine, center: GridCenter): void {
    const offset = line.offsetIndex * step;
    const xMin = center.x - lineSpan;
    const xMax = center.x + lineSpan;
    const zMin = center.z - lineSpan;
    const zMax = center.z + lineSpan;
    const coordinate = line.direction === 'x' ? center.z + offset : center.x + offset;
    const points = line.direction === 'x'
      ? [new Vector3(xMin, 0, coordinate), new Vector3(xMax, 0, coordinate)]
      : [new Vector3(coordinate, 0, zMin), new Vector3(coordinate, 0, zMax)];
    MeshBuilder.CreateLines(line.mesh.name, {
      points,
      instance: line.mesh,
    }, scene);
    line.mesh.color = resolveLineColor(line.direction, coordinate);
  }

  function resolveLineColor(direction: 'x' | 'z', coordinate: number): any {
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
    isVisible() {
      return visible;
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
      lastCenter = null;
    },
  };
}

function readGridCenter(scene: RuntimeScene, camera: RuntimeCamera | null, step: number): GridCenter {
  const activeCamera = scene?.activeCamera ?? camera;
  const source = activeCamera?.target ?? activeCamera?.position ?? { x: 0, z: 0 };
  return {
    x: Math.floor((Number(source.x) || 0) / step) * step,
    z: Math.floor((Number(source.z) || 0) / step) * step,
  };
}

function normalizePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
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
    dispose() {},
  };
}
