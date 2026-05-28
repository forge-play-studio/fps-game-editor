import { describe, expect, it } from 'vitest';

import type {
  LocalEditorSceneRenderFrameHost,
  LocalEditorSceneRenderScheduler,
} from '../../packages/editor/src/local-editor-scene-render-scheduler';
import { createLocalEditorViewportRenderCoordinator } from '../../packages/editor/src/local-editor-viewport-render-coordinator';

function createFrameHost(): LocalEditorSceneRenderFrameHost & {
  canceled: number[];
  flushNext(): void;
  pendingCount(): number;
} {
  type Callback = Parameters<LocalEditorSceneRenderFrameHost['requestAnimationFrame']>[0];
  let nextId = 1;
  const callbacks = new Map<number, Callback>();
  return {
    canceled: [],
    requestAnimationFrame(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
      this.canceled.push(id);
    },
    flushNext() {
      const [id, callback] = callbacks.entries().next().value ?? [];
      if (id == null || !callback) return;
      callbacks.delete(id);
      callback(0);
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

function createScheduler(): LocalEditorSceneRenderScheduler & {
  continuousBegins: string[];
  continuousEnds: string[];
  requestedFrames: string[];
} {
  const requestedFrames: string[] = [];
  const continuousBegins: string[] = [];
  const continuousEnds: string[] = [];
  return {
    requestedFrames,
    continuousBegins,
    continuousEnds,
    requestFrame(reason) {
      requestedFrames.push(reason);
    },
    beginContinuous(reason) {
      continuousBegins.push(reason);
    },
    endContinuous(reason) {
      continuousEnds.push(reason);
    },
    dispose() {
      // Scheduler ownership stays with the harness; coordinator only controls viewport requests.
    },
  };
}

describe('local editor viewport render coordinator', () => {
  it('requests a reveal frame with immediate and post-layout resize', () => {
    const scheduler = createScheduler();
    const frameHost = createFrameHost();
    let resizeCount = 0;
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost,
      getEngine: () => ({
        resize: () => {
          resizeCount += 1;
        },
      }),
    });

    coordinator.requestRevealFrame('editor-enter');

    expect(resizeCount).toBe(1);
    expect(scheduler.requestedFrames).toEqual(['editor-enter']);
    expect(frameHost.pendingCount()).toBe(1);

    frameHost.flushNext();

    expect(resizeCount).toBe(2);
    expect(scheduler.requestedFrames).toEqual(['editor-enter', 'editor-enter-post-layout']);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('cancels reveal work and ignores requests after dispose', () => {
    const scheduler = createScheduler();
    const frameHost = createFrameHost();
    let resizeCount = 0;
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost,
      getEngine: () => ({
        resize: () => {
          resizeCount += 1;
        },
      }),
    });

    coordinator.requestRevealFrame('editor-enter');
    coordinator.dispose();
    coordinator.requestFrame('late');
    coordinator.invalidateScene('late-invalidated');
    coordinator.beginContinuous('late-continuous');
    coordinator.endContinuous('late-continuous');
    frameHost.flushNext();

    expect(resizeCount).toBe(1);
    expect(frameHost.canceled).toEqual([1]);
    expect(scheduler.requestedFrames).toEqual(['editor-enter']);
    expect(scheduler.continuousBegins).toEqual([]);
    expect(scheduler.continuousEnds).toEqual([]);
  });

  it('passes frame, invalidation, and continuous requests through to the scheduler', () => {
    const scheduler = createScheduler();
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost: createFrameHost(),
    });

    coordinator.requestFrame('resize');
    coordinator.invalidateScene('projection-ready');
    coordinator.beginContinuous('orbit');
    coordinator.endContinuous('orbit');

    expect(scheduler.requestedFrames).toEqual(['resize', 'projection-ready']);
    expect(scheduler.continuousBegins).toEqual(['orbit']);
    expect(scheduler.continuousEnds).toEqual(['orbit']);
  });
});
