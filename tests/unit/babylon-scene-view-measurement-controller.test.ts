import { describe, expect, it } from 'vitest';
import {
  createBabylonSceneViewMeasurementController,
  formatMeasurementDistance,
  pickGroundPoint,
} from '../../packages/editor-babylon/src/scene-view-measurement-controller';

function createMeasurementOptions() {
  class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    static Project(point: Vector3) {
      return {
        x: 100 + point.x * 20,
        y: 100 + point.z * 20,
        z: 0.5,
      };
    }
  }
  const canvas = {
    width: 800,
    height: 600,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 }),
  };
  const engine = {
    getRenderingCanvas: () => canvas,
    getRenderWidth: () => 800,
    getRenderHeight: () => 600,
  };
  const scene = {
    activeCamera: { viewport: { toGlobal: () => ({}) } },
    getEngine: () => engine,
    getTransformMatrix: () => ({}),
    createPickingRay: (x: number, y: number) => ({
      origin: { x: x / 100, y: 10, z: y / 100 },
      direction: { x: 0, y: -1, z: 0 },
    }),
  };
  return {
    babylon: {
      Vector3,
      Matrix: { Identity: () => ({}) },
    } as any,
    scene: scene as any,
  };
}

describe('Babylon scene view measurement controller', () => {
  it('picks XZ ground points using render-scaled pointer coordinates', () => {
    const point = pickGroundPoint(createMeasurementOptions(), 110, 95);
    expect(point).toEqual({ x: 2, y: 0, z: 1.5 });
  });

  it('tracks first point, preview, completion, and latest measurement distance', () => {
    const controller = createBabylonSceneViewMeasurementController(createMeasurementOptions());

    const start = controller.beginAt(10, 20);
    expect(start?.active).toBe(true);
    expect(start?.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(start?.end).toBeNull();

    const preview = controller.previewAt(110, 95);
    expect(preview?.active).toBe(true);
    expect(preview?.preview).toEqual({ x: 2, y: 0, z: 1.5 });
    expect(preview?.distance).toBeCloseTo(2.5);
    expect(preview?.label?.text).toBe('2.5 m');

    const complete = controller.completeAt(210, 20);
    expect(complete?.active).toBe(false);
    expect(complete?.end).toEqual({ x: 4, y: 0, z: 0 });
    expect(complete?.distance).toBe(4);
    expect(complete?.screenStart).toMatchObject({ x: 60, y: 70 });
    expect(complete?.screenEnd).toMatchObject({ x: 100, y: 70 });

    expect(controller.clear()).toMatchObject({
      active: false,
      start: null,
      end: null,
      distance: null,
    });
  });

  it('formats measurement distance with at most two decimals', () => {
    expect(formatMeasurementDistance(3)).toBe('3');
    expect(formatMeasurementDistance(3.456)).toBe('3.46');
    expect(formatMeasurementDistance(0.001)).toBe('0');
  });
});
