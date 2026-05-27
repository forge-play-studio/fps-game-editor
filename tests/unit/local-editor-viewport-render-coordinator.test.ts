import { describe, expect, it } from 'vitest';
import {
  createLocalEditorViewportRenderCoordinator,
} from '../../packages/editor/src/local-editor-viewport-render-coordinator';
import type {
  LocalEditorSceneRenderFrameHost,
  LocalEditorSceneRenderScheduler,
  LocalEditorSceneRenderStats,
} from '../../packages/editor/src/local-editor-scene-render-scheduler';

function createManualFrameHost(): {
  host: LocalEditorSceneRenderFrameHost;
  pendingCount(): number;
  flushNextFrame(): void;
} {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  return {
    host: {
      requestAnimationFrame(callback) {
        const frameId = nextFrameId;
        nextFrameId += 1;
        callbacks.set(frameId, callback);
        return frameId;
      },
      cancelAnimationFrame(frameId) {
        callbacks.delete(frameId);
      },
    },
    pendingCount() {
      return callbacks.size;
    },
    flushNextFrame() {
      const entry = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!entry) return;
      const [frameId, callback] = entry;
      callbacks.delete(frameId);
      callback(16.67);
    },
  };
}

function createFakeScene(): {
  scene: { executeWhenReady(callback: () => void): void };
  flushReady(): void;
  pendingReadyCount(): number;
} {
  const callbacks: Array<() => void> = [];
  return {
    scene: {
      executeWhenReady(callback) {
        callbacks.push(callback);
      },
    },
    flushReady() {
      callbacks.shift()?.();
    },
    pendingReadyCount() {
      return callbacks.length;
    },
  };
}

function createFakeScheduler(): LocalEditorSceneRenderScheduler & {
  requestedFrames: string[];
  continuousBegins: string[];
  continuousEnds: string[];
  frameWaiters: Array<() => void>;
} {
  const stats: LocalEditorSceneRenderStats = {
    fps: null,
    frameCount: 0,
    mode: 'idle',
    lastFrameMs: null,
    activeReasons: [],
  };
  return {
    requestedFrames: [],
    continuousBegins: [],
    continuousEnds: [],
    frameWaiters: [],
    requestFrame(reason) {
      this.requestedFrames.push(reason);
    },
    waitForNextFrame() {
      return new Promise(resolve => {
        this.frameWaiters.push(() => resolve(stats));
      });
    },
    beginContinuous(reason) {
      this.continuousBegins.push(reason);
    },
    endContinuous(reason) {
      this.continuousEnds.push(reason);
    },
    getStats() {
      return stats;
    },
    dispose() {},
  };
}

describe('local editor viewport render coordinator', () => {
  it('requests reveal frames around viewport layout stabilization', () => {
    const frameHost = createManualFrameHost();
    const scheduler = createFakeScheduler();
    let resizeCount = 0;
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost: frameHost.host,
      getEngine: () => ({
        resize() {
          resizeCount += 1;
        },
      }),
    });

    coordinator.requestRevealFrame('editor-enter');

    expect(resizeCount).toBe(1);
    expect(scheduler.requestedFrames).toEqual(['editor-enter']);
    expect(frameHost.pendingCount()).toBe(1);

    frameHost.flushNextFrame();

    expect(resizeCount).toBe(2);
    expect(scheduler.requestedFrames).toEqual(['editor-enter', 'editor-enter-post-layout']);
  });

  it('cancels pending reveal work on dispose', () => {
    const frameHost = createManualFrameHost();
    const scheduler = createFakeScheduler();
    let resizeCount = 0;
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost: frameHost.host,
      getEngine: () => ({
        resize() {
          resizeCount += 1;
        },
      }),
    });

    coordinator.requestRevealFrame('editor-enter');
    coordinator.invalidateScene('projection-rebuild');
    coordinator.dispose();
    frameHost.flushNextFrame();
    coordinator.requestFrame('after-dispose');

    expect(resizeCount).toBe(1);
    expect(scheduler.requestedFrames).toEqual(['editor-enter', 'projection-rebuild']);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('invalidates scene data and follows up after Babylon scene readiness', () => {
    const frameHost = createManualFrameHost();
    const readyScene = createFakeScene();
    let resizeCount = 0;
    const scheduler = createFakeScheduler();
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost: frameHost.host,
      getEngine: () => ({
        resize() {
          resizeCount += 1;
        },
      }),
      getScene: () => readyScene.scene,
    });

    coordinator.invalidateScene('projection-changed');

    expect(resizeCount).toBe(0);
    expect(frameHost.pendingCount()).toBe(0);
    expect(readyScene.pendingReadyCount()).toBe(1);
    expect(scheduler.requestedFrames).toEqual(['projection-changed']);

    readyScene.flushReady();
    expect(frameHost.pendingCount()).toBe(1);
    frameHost.flushNextFrame();
    expect(scheduler.requestedFrames).toEqual(['projection-changed', 'projection-changed-scene-ready']);

    coordinator.dispose();
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('cancels pending scene-ready follow-up work on dispose', () => {
    const frameHost = createManualFrameHost();
    const readyScene = createFakeScene();
    const scheduler = createFakeScheduler();
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost: frameHost.host,
      getScene: () => readyScene.scene,
    });

    coordinator.invalidateScene('projection-rebuild');
    readyScene.flushReady();
    expect(frameHost.pendingCount()).toBe(1);

    coordinator.dispose();
    frameHost.flushNextFrame();

    expect(frameHost.pendingCount()).toBe(0);
    expect(scheduler.requestedFrames).toEqual(['projection-rebuild']);
  });

  it('ignores stale scene-ready callbacks after a newer invalidation', () => {
    const frameHost = createManualFrameHost();
    const readyScene = createFakeScene();
    const scheduler = createFakeScheduler();
    const coordinator = createLocalEditorViewportRenderCoordinator({
      scheduler,
      frameHost: frameHost.host,
      getScene: () => readyScene.scene,
    });

    coordinator.invalidateScene('projection-first');
    coordinator.invalidateScene('projection-second');

    expect(readyScene.pendingReadyCount()).toBe(2);
    readyScene.flushReady();
    expect(frameHost.pendingCount()).toBe(0);
    readyScene.flushReady();
    expect(frameHost.pendingCount()).toBe(1);
    frameHost.flushNextFrame();

    expect(scheduler.requestedFrames).toEqual([
      'projection-first',
      'projection-second',
      'projection-second-scene-ready',
    ]);
  });

  it('passes one-shot, invalidation, and continuous render requests to the scheduler', () => {
    const scheduler = createFakeScheduler();
    const coordinator = createLocalEditorViewportRenderCoordinator({ scheduler, frameHost: null });

    coordinator.requestFrame('selection');
    coordinator.invalidateScene('projection-changed');
    coordinator.beginContinuous('orbit');
    coordinator.endContinuous('orbit');

    expect(scheduler.requestedFrames).toEqual(['selection', 'projection-changed']);
    expect(scheduler.continuousBegins).toEqual(['orbit']);
    expect(scheduler.continuousEnds).toEqual(['orbit']);
  });
});
