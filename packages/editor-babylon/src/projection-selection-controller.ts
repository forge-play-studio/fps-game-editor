import {
  type EditorSelectionState,
  type EditorTransformTool,
  resolveEditorSelectionCommand,
  type SceneViewPointerIntent,
  type SelectionCommand,
} from '@fps-games/editor-core';
import type {
  BabylonEditorProjection,
  BabylonEditorProjectionScreenRect,
} from './projection';
import type { RuntimeScene } from './types';

export interface BabylonProjectionSelectionBox {
  active: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BabylonProjectionSelectionControllerOptions {
  scene: RuntimeScene;
  canvas: HTMLCanvasElement;
  projection: BabylonEditorProjection;
  getTool: () => EditorTransformTool;
  getSelection: () => EditorSelectionState;
  isSelectable?: (nodeId: string) => boolean;
  isLocked?: (nodeId: string) => boolean;
  isOperationBlocked?: () => boolean;
  onSelectionCommand?: (command: SelectionCommand) => void;
  onFocusIntent?: (nodeId: string) => void;
  onBoxSelectionChange?: (box: BabylonProjectionSelectionBox | null) => void;
}

export interface BabylonProjectionSelectionController {
  isBoxSelectionCandidate(event: PointerEvent): boolean;
  beginPointerSelection(event: PointerEvent): void;
  updatePointerSelection(event: PointerEvent, intent?: SceneViewPointerIntent): void;
  endPointerSelection(event: PointerEvent, intent?: SceneViewPointerIntent): void;
  handleDoubleClick(event: MouseEvent): void;
  cancelBoxSelection(): void;
  dispose(): void;
}

interface PointerDragState {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startNodeId: string | null;
  startHit: boolean;
  additive: boolean;
  toggle: boolean;
  boxActive: boolean;
}

const CLICK_DRAG_THRESHOLD_PX = 5;

export function createBabylonProjectionSelectionController(
  options: BabylonProjectionSelectionControllerOptions,
): BabylonProjectionSelectionController {
  let drag: PointerDragState | null = null;
  let disposed = false;

  function isBoxSelectionCandidate(event: PointerEvent): boolean {
    if (disposed || event.button !== 0 || options.isOperationBlocked?.()) return false;
    if (event.altKey || options.getTool() !== 'select') return false;
    const pick = pickScene(options, event.clientX, event.clientY);
    return !pick.nodeId && !pick.hit;
  }

  function beginPointerSelection(event: PointerEvent): void {
    if (disposed || event.button !== 0 || options.isOperationBlocked?.()) return;
    const tool = options.getTool();
    if (!isSelectionPointerAllowed(event, tool)) return;
    const pick = pickScene(options, event.clientX, event.clientY);
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startNodeId: pick.nodeId,
      startHit: pick.hit,
      additive: event.shiftKey && !event.metaKey && !event.ctrlKey,
      toggle: event.metaKey || event.ctrlKey,
      boxActive: false,
    };
  }

  function updatePointerSelection(event: PointerEvent, intent?: SceneViewPointerIntent): void {
    if (!drag || event.pointerId !== drag.pointerId || disposed) return;
    const moved = pointerDistance(drag.startX, drag.startY, event.clientX, event.clientY);
    drag.currentX = event.clientX;
    drag.currentY = event.clientY;
    if (
      !drag.boxActive
      && (
        intent === 'box-select'
        || (moved >= CLICK_DRAG_THRESHOLD_PX && options.getTool() === 'select' && !drag.startNodeId && !drag.startHit)
      )
    ) {
      drag.boxActive = true;
    }
    if (!drag.boxActive) return;
    options.onBoxSelectionChange?.(toBoxOverlay(drag));
  }

  function endPointerSelection(event: PointerEvent, intent?: SceneViewPointerIntent): void {
    if (!drag || event.pointerId !== drag.pointerId || disposed) return;
    updatePointerSelection(event, intent);
    const current = drag;
    drag = null;
    if (current.boxActive) {
      options.onBoxSelectionChange?.(null);
      const selectedIds = options.projection
        .getNodeIdsInScreenRect(toScreenRect(current))
        .filter(id => isSelectable(options, id));
      dispatchBoxSelection(options, selectedIds, current);
      return;
    }
    const moved = pointerDistance(current.startX, current.startY, event.clientX, event.clientY);
    if (moved >= CLICK_DRAG_THRESHOLD_PX) return;
    if (current.startNodeId) {
      if (!isSelectable(options, current.startNodeId)) return;
      dispatchPointerSelection(options, current.startNodeId, current);
      return;
    }
    if (current.startHit) return;
    if (!current.additive && !current.toggle) {
      options.onSelectionCommand?.({ type: 'selection.clear', label: 'Clear Selection' });
    }
  }

  function handleDoubleClick(event: MouseEvent): void {
    if (disposed || options.isOperationBlocked?.()) return;
    const pick = pickScene(options, event.clientX, event.clientY);
    if (!pick.nodeId || !isSelectable(options, pick.nodeId)) return;
    const selection = options.getSelection();
    if (!selection.selectedIds.includes(pick.nodeId)) {
      options.onSelectionCommand?.({
        type: 'selection.replace',
        selectedIds: [pick.nodeId],
        activeId: pick.nodeId,
        label: 'Select Object',
      });
    }
    event.preventDefault();
    event.stopPropagation();
    options.onFocusIntent?.(pick.nodeId);
  }

  function cancelBoxSelection(): void {
    const current = drag;
    drag = null;
    if (current?.boxActive) {
      options.onBoxSelectionChange?.(null);
    }
  }

  return {
    isBoxSelectionCandidate,
    beginPointerSelection,
    updatePointerSelection,
    endPointerSelection,
    handleDoubleClick,
    cancelBoxSelection,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelBoxSelection();
    },
  };
}

function isSelectionPointerAllowed(event: PointerEvent, tool: EditorTransformTool): boolean {
  if (event.altKey) return false;
  return tool === 'select' || tool === 'move' || tool === 'rotate' || tool === 'scale';
}

function pickScene(
  options: BabylonProjectionSelectionControllerOptions,
  clientX: number,
  clientY: number,
): { hit: boolean; nodeId: string | null } {
  const rect = options.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const pick = typeof options.scene.pick === 'function' ? options.scene.pick(x, y) : null;
  const pickedNode = pick?.pickedMesh ?? null;
  return {
    hit: !!pick?.hit,
    nodeId: options.projection.resolveProjectionNodeId(pickedNode),
  };
}

function dispatchPointerSelection(
  options: BabylonProjectionSelectionControllerOptions,
  nodeId: string,
  drag: PointerDragState,
): void {
  const command = resolveEditorSelectionCommand({
    selection: options.getSelection(),
    targetIds: [nodeId],
    activeId: nodeId,
    gesture: 'click',
    modifier: drag.toggle ? 'toggle' : drag.additive ? 'additive' : 'replace',
  });
  if (command) options.onSelectionCommand?.(command);
}

function dispatchBoxSelection(
  options: BabylonProjectionSelectionControllerOptions,
  selectedIds: string[],
  drag: PointerDragState,
): void {
  const command = resolveEditorSelectionCommand({
    selection: options.getSelection(),
    targetIds: selectedIds,
    activeId: selectedIds[selectedIds.length - 1] ?? null,
    gesture: 'box',
    modifier: drag.toggle ? 'toggle' : drag.additive ? 'additive' : 'replace',
  });
  if (command) options.onSelectionCommand?.(command);
}

function isSelectable(
  options: BabylonProjectionSelectionControllerOptions,
  nodeId: string,
): boolean {
  if (options.isLocked?.(nodeId)) return false;
  return options.isSelectable?.(nodeId) ?? true;
}

function pointerDistance(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): number {
  return Math.hypot(currentX - startX, currentY - startY);
}

function toBoxOverlay(drag: PointerDragState): BabylonProjectionSelectionBox {
  const left = Math.min(drag.startX, drag.currentX);
  const top = Math.min(drag.startY, drag.currentY);
  return {
    active: true,
    left,
    top,
    width: Math.abs(drag.currentX - drag.startX),
    height: Math.abs(drag.currentY - drag.startY),
  };
}

function toScreenRect(drag: PointerDragState): BabylonEditorProjectionScreenRect {
  const left = Math.min(drag.startX, drag.currentX);
  const top = Math.min(drag.startY, drag.currentY);
  return {
    left,
    top,
    right: Math.max(drag.startX, drag.currentX),
    bottom: Math.max(drag.startY, drag.currentY),
  };
}
