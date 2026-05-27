import { describe, expect, it } from 'vitest';
import {
  createLocalEditorSceneRenderScheduler,
  type LocalEditorSceneRenderFrameHost,
  type LocalEditorSceneRenderStats,
} from '../../packages/editor/src/local-editor-scene-render-scheduler';

function createManualFrameHost(): {
  host: LocalEditorSceneRenderFrameHost;
  pendingCount(): number;
  flushNextFrame(): void;
} {
  let nextFrameId = 1;
  let nextTimestamp = 0;
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
      nextTimestamp += 16.67;
      callback(nextTimestamp);
    },
  };
}

describe('local editor scene render scheduler', () => {
  it('coalesces one-shot frame requests', () => {
    const frameHost = createManualFrameHost();
    let renders = 0;
    const scheduler = createLocalEditorSceneRenderScheduler(() => {
      renders += 1;
    }, { frameHost: frameHost.host });

    scheduler.requestFrame('selection');
    scheduler.requestFrame('grid');
    scheduler.requestFrame('camera');

    expect(frameHost.pendingCount()).toBe(1);
    frameHost.flushNextFrame();
    expect(renders).toBe(1);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('waits for the next real scene frame without driving a duplicate frame', async () => {
    const frameHost = createManualFrameHost();
    let renders = 0;
    const scheduler = createLocalEditorSceneRenderScheduler(() => {
      renders += 1;
    }, { frameHost: frameHost.host });

    const frame = scheduler.waitForNextFrame('initial-editor-frame');
    scheduler.requestFrame('coalesced-selection');

    expect(frameHost.pendingCount()).toBe(1);
    frameHost.flushNextFrame();

    await expect(frame).resolves.toMatchObject({
      frameCount: 1,
      mode: 'idle',
    });
    expect(renders).toBe(1);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('keeps scene invalidations requested during a frame instead of swallowing them', () => {
    const frameHost = createManualFrameHost();
    let renders = 0;
    const scheduler = createLocalEditorSceneRenderScheduler(() => {
      renders += 1;
      if (renders === 1) scheduler.requestFrame('projection-updated-during-render');
    }, { frameHost: frameHost.host });

    scheduler.requestFrame('initial');

    expect(frameHost.pendingCount()).toBe(1);
    frameHost.flushNextFrame();
    expect(renders).toBe(1);
    expect(frameHost.pendingCount()).toBe(1);

    frameHost.flushNextFrame();
    expect(renders).toBe(2);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('renders continuously only while a reason is active', () => {
    const frameHost = createManualFrameHost();
    let renders = 0;
    const scheduler = createLocalEditorSceneRenderScheduler(() => {
      renders += 1;
    }, { frameHost: frameHost.host });

    scheduler.beginContinuous('orbit');
    expect(frameHost.pendingCount()).toBe(1);

    frameHost.flushNextFrame();
    expect(renders).toBe(1);
    expect(frameHost.pendingCount()).toBe(1);

    scheduler.endContinuous('orbit');
    frameHost.flushNextFrame();
    expect(renders).toBe(2);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('keeps continuous rendering until every reason ends', () => {
    const frameHost = createManualFrameHost();
    let renders = 0;
    const scheduler = createLocalEditorSceneRenderScheduler(() => {
      renders += 1;
    }, { frameHost: frameHost.host });

    scheduler.beginContinuous('orbit');
    scheduler.beginContinuous('measurement');
    frameHost.flushNextFrame();
    expect(frameHost.pendingCount()).toBe(1);

    scheduler.endContinuous('orbit');
    frameHost.flushNextFrame();
    expect(renders).toBe(2);
    expect(frameHost.pendingCount()).toBe(1);

    scheduler.endContinuous('measurement');
    frameHost.flushNextFrame();
    expect(renders).toBe(3);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('cancels pending work on dispose', () => {
    const frameHost = createManualFrameHost();
    let renders = 0;
    const scheduler = createLocalEditorSceneRenderScheduler(() => {
      renders += 1;
    }, { frameHost: frameHost.host });

    scheduler.beginContinuous('drag');
    expect(frameHost.pendingCount()).toBe(1);

    scheduler.dispose();
    expect(frameHost.pendingCount()).toBe(0);
    frameHost.flushNextFrame();
    expect(renders).toBe(0);
  });

  it('rejects frame waiters on dispose', async () => {
    const frameHost = createManualFrameHost();
    const scheduler = createLocalEditorSceneRenderScheduler(() => {}, { frameHost: frameHost.host });
    const frame = scheduler.waitForNextFrame('initial-editor-frame');

    scheduler.dispose();

    await expect(frame).rejects.toThrow('disposed');
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('reports passive frame-rate stats without driving extra frames', () => {
    const frameHost = createManualFrameHost();
    const stats: LocalEditorSceneRenderStats[] = [];
    const latestStats = () => stats[stats.length - 1];
    const scheduler = createLocalEditorSceneRenderScheduler(() => {}, {
      frameHost: frameHost.host,
      onStatsChange: nextStats => stats.push(nextStats),
      statsUpdateIntervalMs: 0,
    });

    scheduler.beginContinuous('orbit');
    expect(latestStats()?.mode).toBe('continuous');
    expect(latestStats()?.activeReasons).toEqual(['orbit']);

    frameHost.flushNextFrame();
    frameHost.flushNextFrame();
    expect(latestStats()?.fps).toBeGreaterThan(50);
    expect(latestStats()?.frameCount).toBe(2);

    scheduler.endContinuous('orbit');
    expect(latestStats()?.mode).toBe('idle');
    expect(latestStats()?.fps).toBeNull();
    expect(frameHost.pendingCount()).toBe(1);

    frameHost.flushNextFrame();
    expect(latestStats()?.mode).toBe('idle');
    expect(latestStats()?.fps).toBeNull();
    expect(frameHost.pendingCount()).toBe(0);
  });
});
