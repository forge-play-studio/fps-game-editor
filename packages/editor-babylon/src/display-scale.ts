export interface BabylonEditorDisplayScaleOptions {
  enabled?: boolean;
  maxDevicePixelRatio?: number;
  maxRenderPixels?: number;
  devicePixelRatio?: number;
}

export interface BabylonEditorDisplayScaleInput extends BabylonEditorDisplayScaleOptions {
  cssWidth: number;
  cssHeight: number;
}

export interface BabylonEditorDisplayScaleState {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  maxDevicePixelRatio: number;
  maxRenderPixels: number;
  scale: number;
  hardwareScalingLevel: number;
  renderWidth: number;
  renderHeight: number;
  limitedByDevicePixelRatio: boolean;
  limitedByRenderPixels: boolean;
}

export interface BabylonEditorDisplayScaleSyncResult extends BabylonEditorDisplayScaleState {
  hardwareScalingChanged: boolean;
  resized: boolean;
}

type BabylonEditorDisplayScaleEngine = {
  getHardwareScalingLevel?: () => number;
  setHardwareScalingLevel?: (level: number) => void;
  resize?: () => void;
};

const DEFAULT_MAX_DEVICE_PIXEL_RATIO = 2;
const DEFAULT_MAX_RENDER_PIXELS = 7680 * 4320;
const MIN_SCALE = 1;
const EPSILON = 0.001;

export function resolveBabylonEditorDisplayScale(
  input: BabylonEditorDisplayScaleInput | false,
): BabylonEditorDisplayScaleState {
  if (input === false || input.enabled === false) {
    return createDisplayScaleState({
      cssWidth: input === false ? 1 : input.cssWidth,
      cssHeight: input === false ? 1 : input.cssHeight,
      devicePixelRatio: 1,
      maxDevicePixelRatio: 1,
      maxRenderPixels: Number.POSITIVE_INFINITY,
      scale: 1,
      limitedByDevicePixelRatio: false,
      limitedByRenderPixels: false,
    });
  }

  const cssWidth = normalizePositiveNumber(input.cssWidth, 1);
  const cssHeight = normalizePositiveNumber(input.cssHeight, 1);
  const devicePixelRatio = normalizePositiveNumber(input.devicePixelRatio, 1);
  const maxDevicePixelRatio = normalizePositiveNumber(
    input.maxDevicePixelRatio,
    DEFAULT_MAX_DEVICE_PIXEL_RATIO,
  );
  const maxRenderPixels = normalizePositiveNumber(
    input.maxRenderPixels,
    DEFAULT_MAX_RENDER_PIXELS,
    true,
  );
  const scaleAfterDprCap = Math.min(devicePixelRatio, maxDevicePixelRatio);
  const cssPixels = cssWidth * cssHeight;
  const maxScaleForPixels = Math.max(MIN_SCALE, Math.sqrt(maxRenderPixels / Math.max(1, cssPixels)));
  const scale = Math.max(MIN_SCALE, Math.min(scaleAfterDprCap, maxScaleForPixels));

  return createDisplayScaleState({
    cssWidth,
    cssHeight,
    devicePixelRatio,
    maxDevicePixelRatio,
    maxRenderPixels,
    scale,
    limitedByDevicePixelRatio: devicePixelRatio - scaleAfterDprCap > EPSILON,
    limitedByRenderPixels: scaleAfterDprCap - scale > EPSILON,
  });
}

export function syncBabylonEditorDisplayScale(
  engine: BabylonEditorDisplayScaleEngine | null | undefined,
  canvas: HTMLCanvasElement | null | undefined,
  options: BabylonEditorDisplayScaleOptions | false = {},
): BabylonEditorDisplayScaleSyncResult {
  const canvasSize = readCanvasCssSize(canvas);
  const devicePixelRatio = options === false
    ? 1
    : normalizePositiveNumber(options.devicePixelRatio, readDevicePixelRatio(canvas));
  const state = resolveBabylonEditorDisplayScale(options === false
    ? {
        enabled: false,
        cssWidth: canvasSize.width,
        cssHeight: canvasSize.height,
        devicePixelRatio: 1,
      }
    : {
        ...options,
        cssWidth: canvasSize.width,
        cssHeight: canvasSize.height,
        devicePixelRatio,
      });

  let hardwareScalingChanged = false;
  let resized = false;
  const currentHardwareScalingLevel = engine?.getHardwareScalingLevel?.();

  if (engine?.setHardwareScalingLevel
    && (!Number.isFinite(currentHardwareScalingLevel)
      || Math.abs((currentHardwareScalingLevel ?? 0) - state.hardwareScalingLevel) > EPSILON)
  ) {
    engine.setHardwareScalingLevel(state.hardwareScalingLevel);
    hardwareScalingChanged = true;
  } else if (canvas && engine?.resize && shouldResizeCanvas(canvas, state)) {
    engine.resize();
    resized = true;
  }

  return {
    ...state,
    hardwareScalingChanged,
    resized,
  };
}

function createDisplayScaleState(input: {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  maxDevicePixelRatio: number;
  maxRenderPixels: number;
  scale: number;
  limitedByDevicePixelRatio: boolean;
  limitedByRenderPixels: boolean;
}): BabylonEditorDisplayScaleState {
  const scale = normalizePositiveNumber(input.scale, MIN_SCALE);
  const hardwareScalingLevel = 1 / scale;

  return {
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    devicePixelRatio: input.devicePixelRatio,
    maxDevicePixelRatio: input.maxDevicePixelRatio,
    maxRenderPixels: input.maxRenderPixels,
    scale,
    hardwareScalingLevel,
    renderWidth: Math.max(1, Math.floor(input.cssWidth * scale)),
    renderHeight: Math.max(1, Math.floor(input.cssHeight * scale)),
    limitedByDevicePixelRatio: input.limitedByDevicePixelRatio,
    limitedByRenderPixels: input.limitedByRenderPixels,
  };
}

function readCanvasCssSize(canvas: HTMLCanvasElement | null | undefined): { width: number; height: number } {
  const rect = canvas?.getBoundingClientRect?.();
  const fallbackWidth = normalizePositiveNumber(rect?.width, canvas?.width ?? 1);
  const fallbackHeight = normalizePositiveNumber(rect?.height, canvas?.height ?? 1);

  return {
    width: normalizePositiveNumber(canvas?.clientWidth, fallbackWidth),
    height: normalizePositiveNumber(canvas?.clientHeight, fallbackHeight),
  };
}

function readDevicePixelRatio(canvas: HTMLCanvasElement | null | undefined): number {
  const view = canvas?.ownerDocument?.defaultView
    ?? (typeof window !== 'undefined' ? window : null);
  return normalizePositiveNumber(view?.devicePixelRatio, 1);
}

function shouldResizeCanvas(canvas: HTMLCanvasElement, state: BabylonEditorDisplayScaleState): boolean {
  return Math.abs(canvas.width - state.renderWidth) > 1
    || Math.abs(canvas.height - state.renderHeight) > 1;
}

function normalizePositiveNumber(value: unknown, fallback: number, allowInfinity = false): number {
  return typeof value === 'number'
    && value > 0
    && (Number.isFinite(value) || (allowInfinity && value === Number.POSITIVE_INFINITY))
    ? value
    : fallback;
}
