import type { EditorTool } from '@fps-games/editor-protocol';
import type { BabylonRuntimeGlobal, RuntimeScene } from './types';
import { getBabylonRuntime } from './runtime-globals';

export interface EditorToolControllerOptions {
  getScene: () => RuntimeScene | null;
  getSelectedEntity: () => unknown;
  enablePicking: () => void;
  babylon?: BabylonRuntimeGlobal | null;
  syncExternalToolState?: (tool: EditorTool) => boolean;
}
export interface EditorToolController {
  currentTool(): EditorTool;
  syncSelection(entity?: unknown): boolean;
  setTool(nextTool: EditorTool): boolean;
  dispose(): void;
}

function entityHasTransform(entity: any): boolean {
  return !!entity?.position && !!entity?.scaling && (!!entity?.rotation || !!entity?.rotationQuaternion);
}

export function createEditorToolController(options: EditorToolControllerOptions): EditorToolController {
  let tool: EditorTool = 'pick';
  let gizmoManager: any = null;

  function ensureGizmoManager(): any | null {
    if (gizmoManager) return gizmoManager;
    const scene = options.getScene();
    if (!scene) return null;
    const GizmoManager = getBabylonRuntime(options.babylon)?.GizmoManager;
    if (!GizmoManager) return null;
    const manager = new GizmoManager(scene);
    manager.usePointerToAttachGizmos = false;
    manager.clearGizmoOnEmptyPointerEvent = false;
    manager.boundingBoxGizmoEnabled = false;
    gizmoManager = manager;
    return manager;
  }

  return {
    currentTool(): EditorTool {
      return tool;
    },

    syncSelection(entity?: unknown): boolean {
      const nextEntity = entity ?? options.getSelectedEntity() ?? null;
      const handledByExternalTool = options.syncExternalToolState?.(tool) ?? false;
      const manager = ensureGizmoManager();
      if (!manager) return handledByExternalTool;

      if (handledByExternalTool) {
        manager.positionGizmoEnabled = false;
        manager.rotationGizmoEnabled = false;
        manager.scaleGizmoEnabled = false;
        try { manager.attachToNode?.(null); } catch {}
        return true;
      }

      manager.positionGizmoEnabled = tool === 'move';
      manager.rotationGizmoEnabled = tool === 'rotate';
      manager.scaleGizmoEnabled = tool === 'scale';

      if (tool === 'pick') {
        try { manager.attachToNode?.(null); } catch {}
        return true;
      }

      const target = entityHasTransform(nextEntity) ? nextEntity : null;
      try { manager.attachToNode?.(target); } catch {}
      return true;
    },

    setTool(nextTool: EditorTool): boolean {
      tool = nextTool;
      if (nextTool === 'pick') options.enablePicking();
      return this.syncSelection();
    },

    dispose(): void {
      const manager = gizmoManager;
      if (!manager) return;
      try { manager.attachToNode?.(null); } catch {}
      try { manager.dispose?.(); } catch {}
      gizmoManager = null;
    },
  };
}
