import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS } from '../../packages/editor-core/src/viewport-tools';
import {
  createEditorViewportSpatialOverlayState,
  formatEditorViewportOverlayNumber,
} from '../../packages/editor-babylon/src/scene-view-spatial-overlay-controller';

function createProjectionOptions(scale = 24, canvasRect = { left: 10, top: 20, width: 800, height: 600 }) {
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
        x: 100 + point.x * scale + point.z * 2,
        y: 80 - point.y * scale + point.z * scale,
        z: 0.5,
      };
    }
  }
  const canvas = {
    width: 800,
    height: 600,
    getBoundingClientRect: () => canvasRect,
  };
  const engine = {
    getRenderingCanvas: () => canvas,
    getRenderWidth: () => 800,
    getRenderHeight: () => 600,
  };
  return {
    babylon: {
      Vector3,
      Matrix: { Identity: () => ({}) },
    } as any,
    scene: {
      activeCamera: { viewport: { toGlobal: () => ({}) } },
      getEngine: () => engine,
      getTransformMatrix: () => ({}),
    } as any,
  };
}

describe('Babylon scene view spatial overlay state', () => {
  it('defaults all viewport spatial overlay settings off', () => {
    expect(DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS).toEqual({
      bounds: false,
      dimensions: false,
      edgeLengths: false,
      anchor: false,
    });
  });

  it('returns an inactive overlay state when all settings are off', () => {
    const state = createEditorViewportSpatialOverlayState(createProjectionOptions(), {
      nodeId: 'box-1',
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 2, y: 3, z: 4 },
        center: { x: 1, y: 1.5, z: 2 },
        size: { x: 2, y: 3, z: 4 },
      },
      anchor: { x: 1, y: 0, z: 2 },
      settings: DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS,
    });

    expect(state.active).toBe(false);
    expect(state.lines).toHaveLength(0);
    expect(state.labels).toHaveLength(0);
    expect(state.markers).toHaveLength(0);
  });

  it('projects single-selection bounds, dimensions, and anchor labels', () => {
    const state = createEditorViewportSpatialOverlayState(createProjectionOptions(), {
      nodeId: 'box-1',
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 2, y: 3, z: 4 },
        center: { x: 1, y: 1.5, z: 2 },
        size: { x: 2, y: 3, z: 4 },
      },
      anchor: { x: 1, y: 0, z: 2 },
      settings: {
        bounds: true,
        dimensions: true,
        edgeLengths: false,
        anchor: true,
      },
    });

    expect(state.active).toBe(true);
    expect(state.nodeId).toBe('box-1');
    expect(state.lines).toHaveLength(12);
    expect(state.markers).toHaveLength(1);
    expect(state.labels.map(label => label.text)).toEqual(expect.arrayContaining([
      'X 2',
      'Y 3',
      'Z 4',
      'Anchor (1, 0, 2)',
    ]));
    expect(state.labels.some(label => label.kind === 'edge-length')).toBe(false);
  });

  it('adds all legible edge length labels when full edge labels are enabled', () => {
    const state = createEditorViewportSpatialOverlayState(createProjectionOptions(), {
      nodeId: 'box-1',
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 2, y: 3, z: 4 },
        center: { x: 1, y: 1.5, z: 2 },
        size: { x: 2, y: 3, z: 4 },
      },
      anchor: null,
      settings: {
        ...DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS,
        bounds: true,
        edgeLengths: true,
        anchor: false,
      },
    });

    expect(state.labels.filter(label => label.kind === 'edge-length')).toHaveLength(12);
  });

  it('maps render-pixel projection coordinates into CSS canvas coordinates', () => {
    const state = createEditorViewportSpatialOverlayState(
      createProjectionOptions(24, { left: 10, top: 20, width: 400, height: 300 }),
      {
        nodeId: 'box-1',
        bounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 2, y: 3, z: 4 },
          center: { x: 1, y: 1.5, z: 2 },
          size: { x: 2, y: 3, z: 4 },
        },
        anchor: { x: 1, y: 0, z: 2 },
        settings: {
          ...DEFAULT_EDITOR_VIEWPORT_OVERLAY_SETTINGS,
          anchor: true,
        },
      },
    );

    expect(state.markers[0]?.position).toMatchObject({
      x: 74,
      y: 84,
    });
  });

  it('formats overlay numbers with at most two decimals and trimmed zeroes', () => {
    expect(formatEditorViewportOverlayNumber(1)).toBe('1');
    expect(formatEditorViewportOverlayNumber(1.236)).toBe('1.24');
    expect(formatEditorViewportOverlayNumber(0.001)).toBe('0');
  });
});
