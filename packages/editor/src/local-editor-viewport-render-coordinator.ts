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
  getEngine?: () => any;
  getScene?: () => any;
  frameHost?: LocalEditorSceneRenderFrameHost | null;
}

export function createLocalEditorViewportRenderCoordinator(
  options: LocalEditorViewportRenderCoordinatorOptions,
): LocalEditorViewportRenderCoordinator {
  const scheduler = options.scheduler;
  const frameHost = options.frameHost ?? readDefaultFrameHost();
  let disposed = false;
  let revealFrameId: number | null = null;
  let sceneReadyFrameId: number | null = null;
  let sceneReadyToken = 0;

  const resize = (): void => {
    options.getEngine?.()?.resize?.();
  };

  const cancelSceneReadyFrame = (): void => {
    if (sceneReadyFrameId != null && frameHost) {
      frameHost.cancelAnimationFrame(sceneReadyFrameId);
    }
    sceneReadyFrameId = null;
  };

  const requestSceneReadyFrame = (reason: string): void => {
    const scene = options.getScene?.();
    sceneReadyToken += 1;
    const token = sceneReadyToken;
    cancelSceneReadyFrame();
    if (!scene) return;

    const requestAfterReady = (): void => {
      if (disposed || token !== sceneReadyToken) return;
      if (!frameHost) {
        scheduler.requestFrame(`${reason}-scene-ready`);
        return;
      }
      sceneReadyFrameId = frameHost.requestAnimationFrame(() => {
        sceneReadyFrameId = null;
        if (disposed || token !== sceneReadyToken) return;
        scheduler.requestFrame(`${reason}-scene-ready`);
      });
    };

    if (typeof scene.executeWhenReady === 'function') {
      scene.executeWhenReady(requestAfterReady);
      return;
    }

    const readyPromise = typeof scene.whenReadyAsync === 'function' ? scene.whenReadyAsync() : null;
    if (readyPromise && typeof readyPromise.then === 'function') {
      readyPromise.then(requestAfterReady, () => {});
      return;
    }

    requestAfterReady();
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
      requestSceneReadyFrame(reason);
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
      sceneReadyToken += 1;
      if (revealFrameId != null && frameHost) {
        frameHost.cancelAnimationFrame(revealFrameId);
        revealFrameId = null;
      }
      cancelSceneReadyFrame();
    },
  };
}

function readDefaultFrameHost(): LocalEditorSceneRenderFrameHost | null {
  return typeof window === 'undefined' ? null : window;
}
