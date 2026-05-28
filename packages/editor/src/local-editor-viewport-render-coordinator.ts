import type {
  LocalEditorSceneRenderFrameHost,
  LocalEditorSceneRenderScheduler,
} from './local-editor-scene-render-scheduler';

export interface LocalEditorViewportRenderCoordinator {
  requestFrame(reason: string): void;
  requestRevealFrame(reason: string): void;
  invalidateScene(reason: string): void;
  beginContinuous(reason: string): void;
  endContinuous(reason: string): void;
  dispose(): void;
}

export interface LocalEditorViewportRenderCoordinatorOptions {
  scheduler: LocalEditorSceneRenderScheduler;
  getEngine?: () => { resize?: () => void } | null | undefined;
  frameHost?: LocalEditorSceneRenderFrameHost | null;
}

export function createLocalEditorViewportRenderCoordinator(
  options: LocalEditorViewportRenderCoordinatorOptions,
): LocalEditorViewportRenderCoordinator {
  const scheduler = options.scheduler;
  const frameHost = options.frameHost ?? readDefaultFrameHost();
  let disposed = false;
  let revealFrameId: number | null = null;

  const resize = (): void => {
    options.getEngine?.()?.resize?.();
  };

  return {
    requestFrame(reason) {
      if (disposed) return;
      scheduler.requestFrame(reason);
    },
    requestRevealFrame(reason) {
      if (disposed) return;
      resize();
      scheduler.requestFrame(reason);
      if (!frameHost) return;
      if (revealFrameId != null) frameHost.cancelAnimationFrame(revealFrameId);
      revealFrameId = frameHost.requestAnimationFrame(() => {
        revealFrameId = null;
        if (disposed) return;
        resize();
        scheduler.requestFrame(`${reason}-post-layout`);
      });
    },
    invalidateScene(reason) {
      if (disposed) return;
      scheduler.requestFrame(reason);
    },
    beginContinuous(reason) {
      if (disposed) return;
      scheduler.beginContinuous(reason);
    },
    endContinuous(reason) {
      if (disposed) return;
      scheduler.endContinuous(reason);
    },
    dispose() {
      disposed = true;
      if (revealFrameId != null && frameHost) {
        frameHost.cancelAnimationFrame(revealFrameId);
        revealFrameId = null;
      }
    },
  };
}

function readDefaultFrameHost(): LocalEditorSceneRenderFrameHost | null {
  return typeof window === 'undefined' ? null : window;
}
