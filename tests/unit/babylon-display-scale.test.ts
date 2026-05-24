import { describe, expect, it } from 'vitest';
import {
  resolveBabylonEditorDisplayScale,
  syncBabylonEditorDisplayScale,
} from '../../packages/editor-babylon/src';

function createDisplayScaleFixture(input: {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
}) {
  let devicePixelRatio = input.devicePixelRatio;
  const canvas = {
    width: input.cssWidth,
    height: input.cssHeight,
    clientWidth: input.cssWidth,
    clientHeight: input.cssHeight,
    ownerDocument: {
      get defaultView() {
        return { devicePixelRatio };
      },
    },
    getBoundingClientRect() {
      return {
        width: input.cssWidth,
        height: input.cssHeight,
      };
    },
  } as unknown as HTMLCanvasElement;
  const engine = {
    hardwareScalingLevel: 1,
    resizeCalls: 0,
    setCalls: [] as number[],
    getHardwareScalingLevel() {
      return engine.hardwareScalingLevel;
    },
    setHardwareScalingLevel(level: number) {
      engine.hardwareScalingLevel = level;
      engine.setCalls.push(level);
      engine.resize();
    },
    resize() {
      engine.resizeCalls += 1;
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth / engine.hardwareScalingLevel));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight / engine.hardwareScalingLevel));
    },
  };

  return {
    canvas,
    engine,
    setDevicePixelRatio(next: number) {
      devicePixelRatio = next;
    },
  };
}

describe('Babylon editor display scale', () => {
  it('resolves Retina backing dimensions from CSS size and device pixel ratio', () => {
    const state = resolveBabylonEditorDisplayScale({
      cssWidth: 2048,
      cssHeight: 1172,
      devicePixelRatio: 2,
    });

    expect(state.scale).toBe(2);
    expect(state.hardwareScalingLevel).toBe(0.5);
    expect(state.renderWidth).toBe(4096);
    expect(state.renderHeight).toBe(2344);
  });

  it('syncs the engine once and keeps later frames stable when nothing changed', () => {
    const { canvas, engine } = createDisplayScaleFixture({
      cssWidth: 2048,
      cssHeight: 1172,
      devicePixelRatio: 2,
    });

    const first = syncBabylonEditorDisplayScale(engine, canvas);
    const second = syncBabylonEditorDisplayScale(engine, canvas);

    expect(first.hardwareScalingChanged).toBe(true);
    expect(first.scale).toBe(2);
    expect(engine.setCalls).toEqual([0.5]);
    expect(engine.resizeCalls).toBe(1);
    expect(canvas.width).toBe(4096);
    expect(canvas.height).toBe(2344);
    expect(second.hardwareScalingChanged).toBe(false);
    expect(second.resized).toBe(false);
    expect(engine.resizeCalls).toBe(1);
  });

  it('reacts to device pixel ratio changes after the editor world is running', () => {
    const { canvas, engine, setDevicePixelRatio } = createDisplayScaleFixture({
      cssWidth: 1280,
      cssHeight: 720,
      devicePixelRatio: 1,
    });

    syncBabylonEditorDisplayScale(engine, canvas);
    setDevicePixelRatio(1.5);
    const result = syncBabylonEditorDisplayScale(engine, canvas);

    expect(result.hardwareScalingChanged).toBe(true);
    expect(result.scale).toBe(1.5);
    expect(engine.setCalls).toEqual([2 / 3]);
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
  });

  it('caps oversized high-DPI canvases by render-pixel budget', () => {
    const state = resolveBabylonEditorDisplayScale({
      cssWidth: 5120,
      cssHeight: 2880,
      devicePixelRatio: 2,
      maxRenderPixels: 7680 * 4320,
    });

    expect(state.limitedByRenderPixels).toBe(true);
    expect(state.scale).toBe(1.5);
    expect(state.renderWidth).toBe(7680);
    expect(state.renderHeight).toBe(4320);
  });
});
