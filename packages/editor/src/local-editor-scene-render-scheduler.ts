export interface LocalEditorSceneRenderFrameHost {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
}

export interface LocalEditorSceneRenderScheduler {
  requestFrame(reason: string): void;
  beginContinuous(reason: string): void;
  endContinuous(reason: string): void;
  dispose(): void;
}

export interface LocalEditorSceneRenderSchedulerOptions {
  render: () => void;
  frameHost?: LocalEditorSceneRenderFrameHost | null;
}

export function createLocalEditorSceneRenderScheduler(
  options: LocalEditorSceneRenderSchedulerOptions,
): LocalEditorSceneRenderScheduler {
  const frameHost = options.frameHost ?? readDefaultFrameHost();
  const continuousReasons = new Set<string>();
  let disposed = false;
  let frameId: number | null = null;
  let pendingFrame = false;

  const scheduleFrame = (): void => {
    if (disposed || frameId != null || !frameHost) return;
    frameId = frameHost.requestAnimationFrame(() => {
      frameId = null;
      if (disposed) return;
      const shouldRender = pendingFrame || continuousReasons.size > 0;
      pendingFrame = false;
      if (shouldRender) options.render();
      if (continuousReasons.size > 0) scheduleFrame();
    });
  };

  return {
    requestFrame() {
      if (disposed) return;
      pendingFrame = true;
      scheduleFrame();
    },
    beginContinuous(reason) {
      if (disposed) return;
      continuousReasons.add(reason);
      scheduleFrame();
    },
    endContinuous(reason) {
      if (disposed) return;
      continuousReasons.delete(reason);
    },
    dispose() {
      disposed = true;
      pendingFrame = false;
      continuousReasons.clear();
      if (frameId != null && frameHost) {
        frameHost.cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}

function readDefaultFrameHost(): LocalEditorSceneRenderFrameHost | null {
  return typeof window === 'undefined' ? null : window;
}
