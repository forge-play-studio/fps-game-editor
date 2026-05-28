import { describe, expect, it } from 'vitest';

import {
  createLocalEditorSceneRenderScheduler,
  type LocalEditorSceneRenderFrameHost,
} from '../../packages/editor/src/local-editor-scene-render-scheduler';

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

describe('local editor scene render scheduler', () => {
  it('coalesces requested frames into one render', () => {
    const frameHost = createFrameHost();
    let renderCount = 0;
    const scheduler = createLocalEditorSceneRenderScheduler({
      frameHost,
      render: () => {
        renderCount += 1;
      },
    });

    scheduler.requestFrame('projection');
    scheduler.requestFrame('selection');

    expect(frameHost.pendingCount()).toBe(1);
    frameHost.flushNext();
    expect(renderCount).toBe(1);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('renders continuously while continuous reasons are active', () => {
    const frameHost = createFrameHost();
    let renderCount = 0;
    const scheduler = createLocalEditorSceneRenderScheduler({
      frameHost,
      render: () => {
        renderCount += 1;
      },
    });

    scheduler.beginContinuous('orbit');
    frameHost.flushNext();
    frameHost.flushNext();
    expect(renderCount).toBe(2);
    expect(frameHost.pendingCount()).toBe(1);

    scheduler.endContinuous('orbit');
    frameHost.flushNext();
    expect(renderCount).toBe(2);
    expect(frameHost.pendingCount()).toBe(0);
  });

  it('cancels pending frame work after dispose', () => {
    const frameHost = createFrameHost();
    let renderCount = 0;
    const scheduler = createLocalEditorSceneRenderScheduler({
      frameHost,
      render: () => {
        renderCount += 1;
      },
    });

    scheduler.requestFrame('initial');
    scheduler.dispose();
    scheduler.requestFrame('late');
    scheduler.beginContinuous('late-continuous');

    expect(frameHost.canceled).toEqual([1]);
    expect(frameHost.pendingCount()).toBe(0);
    expect(renderCount).toBe(0);
  });
});
