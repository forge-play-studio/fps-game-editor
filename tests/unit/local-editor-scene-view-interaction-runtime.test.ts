import { describe, expect, it, vi } from 'vitest';
import {
  createLocalEditorSceneViewInteractionRuntime,
} from '../../packages/editor/src/local-editor-scene-view-interaction-runtime';
import type { LocalEditorSceneRenderFrame } from '../../packages/editor/src/local-editor-scene-render-scheduler';

function createCoordinatorStub() {
  return {
    beginContinuous: vi.fn(),
    endContinuous: vi.fn(),
  };
}

function createFrame(): LocalEditorSceneRenderFrame {
  return {
    timestampMs: 1000,
    deltaSeconds: 1 / 60,
    mode: 'continuous',
    frameCount: 1,
    activeReasons: ['pointer-flythrough'],
  };
}

describe('local editor scene view interaction runtime', () => {
  it('centralizes pointer intent and flythrough keyboard continuous reasons', () => {
    const coordinator = createCoordinatorStub();
    const runtime = createLocalEditorSceneViewInteractionRuntime({ coordinator });

    runtime.beginPointerIntent('flythrough');
    runtime.beginPointerIntent('flythrough');
    runtime.updateMovementKeys(['w']);
    runtime.updateMovementKeys(['w', 'd']);

    expect(coordinator.beginContinuous).toHaveBeenCalledTimes(2);
    expect(coordinator.beginContinuous).toHaveBeenNthCalledWith(1, 'pointer-flythrough');
    expect(coordinator.beginContinuous).toHaveBeenNthCalledWith(2, 'camera-flythrough-keys');

    runtime.endPointerIntent('flythrough');

    expect(coordinator.endContinuous).toHaveBeenCalledTimes(2);
    expect(coordinator.endContinuous).toHaveBeenNthCalledWith(1, 'pointer-flythrough');
    expect(coordinator.endContinuous).toHaveBeenNthCalledWith(2, 'camera-flythrough-keys');
  });

  it('keeps non-continuous pointer intents out of the scheduler', () => {
    const coordinator = createCoordinatorStub();
    const runtime = createLocalEditorSceneViewInteractionRuntime({ coordinator });

    runtime.beginPointerIntent('selection-click');
    runtime.endPointerIntent('selection-click');
    runtime.cancelPointerIntent('box-select');

    expect(coordinator.beginContinuous).not.toHaveBeenCalled();
    expect(coordinator.endContinuous).not.toHaveBeenCalled();
  });

  it('tracks gizmo drag as an interaction reason and releases it on pointer end fallback', () => {
    const coordinator = createCoordinatorStub();
    const runtime = createLocalEditorSceneViewInteractionRuntime({ coordinator });

    runtime.beginPointerIntent('gizmo-drag');
    runtime.beginGizmoDrag();
    runtime.endPointerIntent('gizmo-drag');
    runtime.endGizmoDrag();

    expect(coordinator.beginContinuous).toHaveBeenCalledTimes(2);
    expect(coordinator.beginContinuous).toHaveBeenNthCalledWith(1, 'pointer-gizmo-drag');
    expect(coordinator.beginContinuous).toHaveBeenNthCalledWith(2, 'gizmo-drag');
    expect(coordinator.endContinuous).toHaveBeenCalledTimes(2);
    expect(coordinator.endContinuous).toHaveBeenNthCalledWith(1, 'pointer-gizmo-drag');
    expect(coordinator.endContinuous).toHaveBeenNthCalledWith(2, 'gizmo-drag');
  });

  it('drives the scene view camera from editor frames', () => {
    const coordinator = createCoordinatorStub();
    const frame = createFrame();
    const camera = {
      updateFrame: vi.fn(() => true),
    };
    const runtime = createLocalEditorSceneViewInteractionRuntime({
      coordinator,
      getCamera: () => camera,
    });

    expect(runtime.updateFrame(frame)).toBe(true);
    expect(camera.updateFrame).toHaveBeenCalledWith(frame);
  });

  it('releases active interaction reasons on dispose', () => {
    const coordinator = createCoordinatorStub();
    const runtime = createLocalEditorSceneViewInteractionRuntime({ coordinator });

    runtime.beginPointerIntent('measurement');
    runtime.updateMovementKeys(['q']);
    runtime.dispose();
    runtime.updateMovementKeys(['q']);
    runtime.beginPointerIntent('flythrough');

    expect(coordinator.endContinuous).toHaveBeenCalledTimes(2);
    expect(coordinator.endContinuous).toHaveBeenNthCalledWith(1, 'pointer-measurement');
    expect(coordinator.endContinuous).toHaveBeenNthCalledWith(2, 'camera-flythrough-keys');
    expect(coordinator.beginContinuous).toHaveBeenCalledTimes(2);
    expect(coordinator.beginContinuous).toHaveBeenNthCalledWith(1, 'pointer-measurement');
    expect(coordinator.beginContinuous).toHaveBeenNthCalledWith(2, 'camera-flythrough-keys');
  });
});
