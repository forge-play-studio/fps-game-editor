import type { SceneViewPointerIntent } from '@fps-games/editor-core';
import type { LocalEditorSceneRenderFrame } from './local-editor-scene-render-scheduler';
import type { LocalEditorViewportRenderCoordinator } from './local-editor-viewport-render-coordinator';

export interface LocalEditorSceneViewFrameConsumer {
  updateFrame(frame: LocalEditorSceneRenderFrame): boolean;
}

export interface LocalEditorSceneViewInteractionRuntime {
  beginPointerIntent(intent: SceneViewPointerIntent): void;
  endPointerIntent(intent: SceneViewPointerIntent): void;
  cancelPointerIntent(intent: SceneViewPointerIntent): void;
  beginGizmoDrag(): void;
  endGizmoDrag(): void;
  updateMovementKeys(keys: readonly string[]): void;
  updateFrame(frame: LocalEditorSceneRenderFrame): boolean;
  dispose(): void;
}

export interface LocalEditorSceneViewInteractionRuntimeOptions {
  coordinator: Pick<LocalEditorViewportRenderCoordinator, 'beginContinuous' | 'endContinuous'>;
  getCamera?: () => LocalEditorSceneViewFrameConsumer | null;
}

const FLYTHROUGH_KEY_RENDER_REASON = 'camera-flythrough-keys';
const GIZMO_DRAG_RENDER_REASON = 'gizmo-drag';

export function createLocalEditorSceneViewInteractionRuntime(
  options: LocalEditorSceneViewInteractionRuntimeOptions,
): LocalEditorSceneViewInteractionRuntime {
  const activeReasons = new Set<string>();
  let disposed = false;

  const beginReason = (reason: string): void => {
    if (disposed || activeReasons.has(reason)) return;
    activeReasons.add(reason);
    options.coordinator.beginContinuous(reason);
  };

  const endReason = (reason: string): void => {
    if (disposed || !activeReasons.has(reason)) return;
    activeReasons.delete(reason);
    options.coordinator.endContinuous(reason);
  };

  const endPointerIntentReasons = (intent: SceneViewPointerIntent): void => {
    const reason = continuousRenderReasonForPointerIntent(intent);
    if (reason) endReason(reason);
    if (intent === 'gizmo-drag') endReason(GIZMO_DRAG_RENDER_REASON);
    if (intent === 'flythrough') endReason(FLYTHROUGH_KEY_RENDER_REASON);
  };

  return {
    beginPointerIntent(intent) {
      const reason = continuousRenderReasonForPointerIntent(intent);
      if (reason) beginReason(reason);
    },
    endPointerIntent(intent) {
      endPointerIntentReasons(intent);
    },
    cancelPointerIntent(intent) {
      endPointerIntentReasons(intent);
    },
    beginGizmoDrag() {
      beginReason(GIZMO_DRAG_RENDER_REASON);
    },
    endGizmoDrag() {
      endReason(GIZMO_DRAG_RENDER_REASON);
    },
    updateMovementKeys(keys) {
      if (keys.length > 0) beginReason(FLYTHROUGH_KEY_RENDER_REASON);
      else endReason(FLYTHROUGH_KEY_RENDER_REASON);
    },
    updateFrame(frame) {
      return options.getCamera?.()?.updateFrame(frame) ?? false;
    },
    dispose() {
      if (disposed) return;
      const reasons = [...activeReasons];
      activeReasons.clear();
      for (const reason of reasons) options.coordinator.endContinuous(reason);
      disposed = true;
    },
  };
}

function continuousRenderReasonForPointerIntent(intent: SceneViewPointerIntent): string | null {
  switch (intent) {
    case 'gizmo-drag':
    case 'view-plane-move':
    case 'placement':
    case 'measurement':
    case 'orbit':
    case 'pan':
    case 'dolly':
    case 'flythrough':
      return `pointer-${intent}`;
    default:
      return null;
  }
}
