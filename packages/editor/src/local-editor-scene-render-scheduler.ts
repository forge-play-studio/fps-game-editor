export interface LocalEditorSceneRenderScheduler {
  requestFrame(reason: string): void;
  waitForNextFrame(reason: string): Promise<LocalEditorSceneRenderStats>;
  beginContinuous(reason: string): void;
  endContinuous(reason: string): void;
  getStats(): LocalEditorSceneRenderStats;
  dispose(): void;
}

export interface LocalEditorSceneRenderFrameHost {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(frameId: number): void;
}

export interface LocalEditorSceneRenderStats {
  fps: number | null;
  frameCount: number;
  mode: 'idle' | 'continuous';
  lastFrameMs: number | null;
  activeReasons: string[];
}

export interface LocalEditorSceneRenderSchedulerOptions {
  frameHost?: LocalEditorSceneRenderFrameHost;
  onStatsChange?: (stats: LocalEditorSceneRenderStats) => void;
  statsUpdateIntervalMs?: number;
}

interface LocalEditorSceneRenderFrameWaiter {
  resolve(stats: LocalEditorSceneRenderStats): void;
  reject(error: Error): void;
}

export function createLocalEditorSceneRenderScheduler(
  renderScene: () => void,
  options: LocalEditorSceneRenderSchedulerOptions = {},
): LocalEditorSceneRenderScheduler {
  const host = options.frameHost ?? window;
  const statsUpdateIntervalMs = options.statsUpdateIntervalMs ?? 250;
  const continuousReasons = new Set<string>();
  let frameId: number | null = null;
  let disposed = false;
  let frameCount = 0;
  let lastFrameTimestamp: number | null = null;
  let lastStatsTimestamp: number | null = null;
  let lastFrameMs: number | null = null;
  let fps: number | null = null;
  let oneShotFrameRequested = false;
  let scheduledFrameWasContinuous = false;
  const frameWaiters: LocalEditorSceneRenderFrameWaiter[] = [];

  const getStats = (): LocalEditorSceneRenderStats => ({
    fps,
    frameCount,
    mode: continuousReasons.size > 0 ? 'continuous' : 'idle',
    lastFrameMs,
    activeReasons: [...continuousReasons].sort(),
  });

  const emitStats = (stats = getStats()): void => {
    options.onStatsChange?.(stats);
  };

  const emitFrameStats = (timestamp: number, stats: LocalEditorSceneRenderStats): void => {
    if (
      continuousReasons.size === 0
      || statsUpdateIntervalMs <= 0
      || lastStatsTimestamp == null
      || timestamp - lastStatsTimestamp >= statsUpdateIntervalMs
    ) {
      lastStatsTimestamp = timestamp;
      emitStats(stats);
    }
  };

  const resolveFrameWaiters = (stats: LocalEditorSceneRenderStats): void => {
    const waiters = frameWaiters.splice(0);
    for (const waiter of waiters) waiter.resolve(stats);
  };

  const schedule = (): void => {
    if (disposed || frameId != null) return;
    scheduledFrameWasContinuous = continuousReasons.size > 0;
    frameId = host.requestAnimationFrame((timestamp) => {
      frameId = null;
      if (disposed) return;
      const shouldRenderOneShot = oneShotFrameRequested || frameWaiters.length > 0;
      oneShotFrameRequested = false;
      const shouldRenderContinuousFrame = scheduledFrameWasContinuous || continuousReasons.size > 0;
      scheduledFrameWasContinuous = false;
      if (!shouldRenderOneShot && !shouldRenderContinuousFrame) return;
      const isContinuousFrame = continuousReasons.size > 0;
      const frameMs = isContinuousFrame && lastFrameTimestamp != null
        ? Math.max(0, timestamp - lastFrameTimestamp)
        : null;
      lastFrameTimestamp = isContinuousFrame ? timestamp : null;
      renderScene();
      frameCount += 1;
      lastFrameMs = frameMs;
      if (isContinuousFrame && frameMs != null && frameMs > 0) {
        const instantFps = 1000 / frameMs;
        fps = fps == null ? instantFps : fps * 0.8 + instantFps * 0.2;
      } else if (!isContinuousFrame) {
        fps = null;
      }
      const stats = getStats();
      emitFrameStats(timestamp, stats);
      resolveFrameWaiters(stats);
      if (oneShotFrameRequested || frameWaiters.length > 0 || continuousReasons.size > 0) {
        schedule();
      }
    });
  };

  return {
    requestFrame(_reason) {
      if (disposed) return;
      oneShotFrameRequested = true;
      schedule();
    },
    waitForNextFrame(_reason) {
      if (disposed) {
        return Promise.reject(new Error('Local editor scene render scheduler is disposed'));
      }
      return new Promise((resolve, reject) => {
        frameWaiters.push({ resolve, reject });
        oneShotFrameRequested = true;
        schedule();
      });
    },
    beginContinuous(reason) {
      if (disposed) return;
      const previousSize = continuousReasons.size;
      continuousReasons.add(reason);
      if (previousSize === 0 && continuousReasons.size > 0) {
        lastFrameTimestamp = null;
        lastStatsTimestamp = null;
        lastFrameMs = null;
        fps = null;
      }
      if (continuousReasons.size !== previousSize) emitStats();
      schedule();
    },
    endContinuous(reason) {
      const previousSize = continuousReasons.size;
      continuousReasons.delete(reason);
      if (previousSize > 0 && continuousReasons.size === 0) {
        lastFrameTimestamp = null;
        lastStatsTimestamp = null;
        lastFrameMs = null;
        fps = null;
      }
      if (continuousReasons.size !== previousSize) emitStats();
    },
    getStats() {
      return getStats();
    },
    dispose() {
      disposed = true;
      continuousReasons.clear();
      if (frameId != null) {
        host.cancelAnimationFrame(frameId);
        frameId = null;
      }
      scheduledFrameWasContinuous = false;
      oneShotFrameRequested = false;
      const waiters = frameWaiters.splice(0);
      const error = new Error('Local editor scene render scheduler is disposed');
      for (const waiter of waiters) waiter.reject(error);
    },
  };
}
