import { describe, expect, it, vi } from 'vitest';
import { createBabylonSceneViewInputController } from '../../packages/editor-babylon/src/scene-view-input-controller';
import {
  applyLocalEditorHarnessViewportMeasurementPointerEnd,
  applyLocalEditorHarnessViewportMeasurementPointerMove,
  applyLocalEditorHarnessViewportMeasurementPointerStart,
  type LocalEditorHarnessViewportMeasurementState,
} from '../../packages/editor/src/local-editor-harness';
import { DEFAULT_EDITOR_VIEWPORT_TOOL_STATE } from '../../packages/editor-core/src/viewport-tools';

function createPointerEvent(type: string, pointerId: number, clientX: number, clientY: number): PointerEvent {
  return {
    type,
    pointerId,
    button: 0,
    clientX,
    clientY,
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent;
}

function createCanvasStub() {
  const listeners = new Map<string, Array<(event: any) => void>>();
  const win = {
    addEventListener: vi.fn((type: string, listener: (event: any) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }),
    removeEventListener: vi.fn(),
  };
  const canvas = {
    ownerDocument: { defaultView: win },
    tabIndex: 0,
    hasAttribute: () => true,
    addEventListener: vi.fn((type: string, listener: (event: any) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }),
    removeEventListener: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    focus: vi.fn(),
    dispatch(type: string, event: any) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
  return canvas as unknown as HTMLCanvasElement & { dispatch(type: string, event: any): void };
}

describe('Babylon scene view input measurement intent', () => {
  it('uses harness measurement handlers so pointerup cannot complete the first click', () => {
    const state: LocalEditorHarnessViewportMeasurementState = {
      viewportTools: {
        ...DEFAULT_EDITOR_VIEWPORT_TOOL_STATE,
        activeUtilityTool: 'measure-distance',
      },
      viewportMeasurement: {
        active: false,
        start: null,
        end: null,
        preview: null,
        distance: null,
      },
      sceneViewMeasurement: {
        beginAt: vi.fn(() => ({
          active: true,
          start: { x: 0, y: 0, z: 0 },
          end: null,
          preview: { x: 0, y: 0, z: 0 },
          distance: null,
        })),
        previewAt: vi.fn(() => ({
          active: true,
          start: { x: 0, y: 0, z: 0 },
          end: null,
          preview: { x: 2, y: 0, z: 0 },
          distance: 2,
        })),
        completeAt: vi.fn(() => ({
          active: false,
          start: { x: 0, y: 0, z: 0 },
          end: { x: 3, y: 0, z: 0 },
          preview: null,
          distance: 3,
        })),
        clear: vi.fn(() => ({
          active: false,
          start: null,
          end: null,
          preview: null,
          distance: null,
        })),
      },
      status: '',
      statusTone: 'default',
      statusToneStatus: '',
      statusDetails: '',
    };

    expect(applyLocalEditorHarnessViewportMeasurementPointerStart(state, { clientX: 0, clientY: 0 })).toBe(true);
    expect(state.viewportMeasurement.start).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.viewportTools.activeUtilityTool).toBe('measure-distance');
    expect(state.sceneViewMeasurement?.completeAt).not.toHaveBeenCalled();

    expect(applyLocalEditorHarnessViewportMeasurementPointerEnd(state)).toBe(false);
    expect(state.viewportMeasurement.end).toBeNull();
    expect(state.viewportTools.activeUtilityTool).toBe('measure-distance');

    expect(applyLocalEditorHarnessViewportMeasurementPointerMove(state, { clientX: 20, clientY: 0 })).toBe(true);
    expect(state.viewportMeasurement.preview).toEqual({ x: 2, y: 0, z: 0 });

    expect(applyLocalEditorHarnessViewportMeasurementPointerStart(state, { clientX: 30, clientY: 0 })).toBe(true);
    expect(state.viewportMeasurement.end).toEqual({ x: 3, y: 0, z: 0 });
    expect(state.viewportTools.activeUtilityTool).toBe('none');
  });

  it('does not complete measurement on the same click that starts it', () => {
    const canvas = createCanvasStub();
    let measureMode = true;
    let hasStart = false;
    let completed = 0;
    let starts = 0;
    let ends = 0;
    const controller = createBabylonSceneViewInputController({
      canvas,
      isMeasurementCandidate: () => measureMode,
      onPointerIntentStart(event) {
        if (event.state.intent !== 'measurement') return;
        if (!hasStart) {
          hasStart = true;
          starts += 1;
          return;
        }
        completed += 1;
        measureMode = false;
      },
      onPointerIntentEnd(event) {
        if (event.state.intent === 'measurement') ends += 1;
      },
    });

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 1, 10, 20));
    canvas.dispatch('pointerup', createPointerEvent('pointerup', 1, 10, 20));
    expect(starts).toBe(1);
    expect(completed).toBe(0);
    expect(ends).toBe(1);
    expect(measureMode).toBe(true);

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 2, 30, 20));
    canvas.dispatch('pointerup', createPointerEvent('pointerup', 2, 30, 20));
    expect(starts).toBe(1);
    expect(completed).toBe(1);
    expect(ends).toBe(2);
    expect(measureMode).toBe(false);

    controller.dispose();
  });
});
