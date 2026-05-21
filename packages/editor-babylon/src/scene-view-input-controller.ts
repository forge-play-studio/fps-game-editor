import type {
  SceneViewInputModifiers,
  SceneViewInputState,
  SceneViewNavigationMode,
  SceneViewPointerButton,
  SceneViewPointerIntent,
  SceneViewPointerState,
} from '@fps-games/editor-core';

export interface BabylonSceneViewInputPointerEvent {
  state: SceneViewPointerState;
  originalEvent: PointerEvent;
}

export interface BabylonSceneViewInputWheelEvent {
  deltaY: number;
  flySpeed: number;
  originalEvent: WheelEvent;
}

export interface BabylonSceneViewInputKeyEvent {
  pressedMovementKeys: string[];
  originalEvent: KeyboardEvent;
}

export interface BabylonSceneViewInputControllerOptions {
  canvas: HTMLCanvasElement;
  isEnabled?: () => boolean;
  isGizmoDragCandidate?: (event: PointerEvent) => boolean;
  isViewPlaneMoveCandidate?: (event: PointerEvent) => boolean;
  isBoxSelectCandidate?: (event: PointerEvent) => boolean;
  boxSelectDragThresholdPx?: number;
  onPointerIntentStart?: (event: BabylonSceneViewInputPointerEvent) => void;
  onPointerIntentMove?: (event: BabylonSceneViewInputPointerEvent) => void;
  onPointerIntentEnd?: (event: BabylonSceneViewInputPointerEvent) => void;
  onPointerIntentCancel?: (event: BabylonSceneViewInputPointerEvent) => void;
  onDoubleClick?: (event: MouseEvent) => void;
  onWheel?: (event: BabylonSceneViewInputWheelEvent) => void;
  onMovementKeysChange?: (event: BabylonSceneViewInputKeyEvent) => void;
}

export interface BabylonSceneViewInputController {
  getState(): SceneViewInputState;
  cancelActiveIntent(): void;
  dispose(): void;
}

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e']);
const DEFAULT_FLY_SPEED = 1;
const MIN_FLY_SPEED = 0.1;
const MAX_FLY_SPEED = 20;
const DEFAULT_BOX_SELECT_DRAG_THRESHOLD_PX = 5;

interface ActivePointerState extends SceneViewPointerState {
  boxSelectCandidate: boolean;
}

export function createBabylonSceneViewInputController(
  options: BabylonSceneViewInputControllerOptions,
): BabylonSceneViewInputController {
  const canvas = options.canvas;
  const win = canvas.ownerDocument.defaultView ?? (typeof window !== 'undefined' ? window : null);
  let activePointer: ActivePointerState | null = null;
  let disposed = false;
  let flySpeed = DEFAULT_FLY_SPEED;
  let globalPointerListenersAttached = false;
  const movementKeys = new Set<string>();
  const handledPointerEvents = new WeakSet<PointerEvent>();
  const boxSelectDragThresholdPx = options.boxSelectDragThresholdPx ?? DEFAULT_BOX_SELECT_DRAG_THRESHOLD_PX;

  if (!canvas.hasAttribute('tabindex')) {
    canvas.tabIndex = 0;
  }

  function enabled(): boolean {
    return !disposed && (options.isEnabled?.() ?? true);
  }

  function makeState(): SceneViewInputState {
    return {
      activeIntent: activePointer?.intent ?? null,
      navigationMode: activePointer ? toNavigationMode(activePointer.intent) : 'none',
      activePointer: activePointer ? clonePointerState(activePointer) : null,
      pressedMovementKeys: [...movementKeys].sort(),
      flySpeed,
    };
  }

  function onPointerDown(event: PointerEvent): void {
    if (!enabled() || activePointer) return;
    const button = toPointerButton(event.button);
    if (!button) return;
    const intent = classifyPointerIntent(event, button, options);
    if (!intent) return;
    activePointer = {
      pointerId: event.pointerId,
      button,
      intent,
      start: { x: event.clientX, y: event.clientY },
      current: { x: event.clientX, y: event.clientY },
      delta: { x: 0, y: 0 },
      modifiers: readModifiers(event),
      boxSelectCandidate: button === 'left' && intent === 'selection-click' && (options.isBoxSelectCandidate?.(event) ?? false),
    };
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    attachGlobalPointerListeners();
    if (intent === 'flythrough') canvas.focus?.({ preventScroll: true });
    consumePointerEvent(event, intent);
    options.onPointerIntentStart?.({ state: clonePointerState(activePointer), originalEvent: event });
  }

  function onPointerMove(event: PointerEvent): void {
    if (handledPointerEvents.has(event)) return;
    handledPointerEvents.add(event);
    if (!activePointer || event.pointerId !== activePointer.pointerId || disposed) return;
    activePointer.delta = {
      x: event.clientX - activePointer.current.x,
      y: event.clientY - activePointer.current.y,
    };
    activePointer.current = { x: event.clientX, y: event.clientY };
    activePointer.modifiers = readModifiers(event);
    if (
      activePointer.intent === 'selection-click'
      && activePointer.boxSelectCandidate
      && pointerDistance(activePointer.start.x, activePointer.start.y, activePointer.current.x, activePointer.current.y) >= boxSelectDragThresholdPx
    ) {
      activePointer.intent = 'box-select';
    }
    consumePointerEvent(event, activePointer.intent);
    options.onPointerIntentMove?.({ state: clonePointerState(activePointer), originalEvent: event });
  }

  function onPointerUp(event: PointerEvent): void {
    if (handledPointerEvents.has(event)) return;
    handledPointerEvents.add(event);
    if (!activePointer || event.pointerId !== activePointer.pointerId || disposed) return;
    const ended = clonePointerState(activePointer);
    releasePointer(event.pointerId);
    detachGlobalPointerListeners();
    activePointer = null;
    consumePointerEvent(event, ended.intent);
    options.onPointerIntentEnd?.({ state: ended, originalEvent: event });
  }

  function onPointerCancel(event: PointerEvent): void {
    if (handledPointerEvents.has(event)) return;
    handledPointerEvents.add(event);
    if (!activePointer || event.pointerId !== activePointer.pointerId || disposed) return;
    const canceled = clonePointerState(activePointer);
    releasePointer(event.pointerId);
    detachGlobalPointerListeners();
    activePointer = null;
    options.onPointerIntentCancel?.({ state: canceled, originalEvent: event });
  }

  function onWheel(event: WheelEvent): void {
    if (!enabled()) return;
    if (activePointer?.intent === 'flythrough') {
      flySpeed = clamp(flySpeed + (-event.deltaY * 0.005), MIN_FLY_SPEED, MAX_FLY_SPEED);
    }
    event.preventDefault();
    options.onWheel?.({ deltaY: event.deltaY, flySpeed, originalEvent: event });
  }

  function onContextMenu(event: MouseEvent): void {
    if (!enabled()) return;
    event.preventDefault();
  }

  function onDoubleClick(event: MouseEvent): void {
    if (!enabled()) return;
    if (event.altKey || event.button !== 0) return;
    options.onDoubleClick?.(event);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!enabled() || activePointer?.intent !== 'flythrough') return;
    const key = event.key.toLowerCase();
    if (!MOVEMENT_KEYS.has(key)) return;
    if (!movementKeys.has(key)) {
      movementKeys.add(key);
      options.onMovementKeysChange?.({ pressedMovementKeys: [...movementKeys].sort(), originalEvent: event });
    }
    event.preventDefault();
  }

  function onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (!movementKeys.has(key)) return;
    movementKeys.delete(key);
    options.onMovementKeysChange?.({ pressedMovementKeys: [...movementKeys].sort(), originalEvent: event });
  }

  function releasePointer(pointerId: number): void {
    try {
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch {}
  }

  function attachGlobalPointerListeners(): void {
    if (globalPointerListenersAttached || !win) return;
    win.addEventListener('pointermove', onPointerMove, true);
    win.addEventListener('pointerup', onPointerUp, true);
    win.addEventListener('pointercancel', onPointerCancel, true);
    globalPointerListenersAttached = true;
  }

  function detachGlobalPointerListeners(): void {
    if (!globalPointerListenersAttached || !win) return;
    win.removeEventListener('pointermove', onPointerMove, true);
    win.removeEventListener('pointerup', onPointerUp, true);
    win.removeEventListener('pointercancel', onPointerCancel, true);
    globalPointerListenersAttached = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  canvas.addEventListener('pointermove', onPointerMove, { capture: true });
  canvas.addEventListener('pointerup', onPointerUp, { capture: true });
  canvas.addEventListener('pointercancel', onPointerCancel, { capture: true });
  canvas.addEventListener('wheel', onWheel, { capture: true, passive: false });
  canvas.addEventListener('contextmenu', onContextMenu, { capture: true });
  canvas.addEventListener('dblclick', onDoubleClick, { capture: true });
  canvas.addEventListener('keydown', onKeyDown, { capture: true });
  canvas.addEventListener('keyup', onKeyUp, { capture: true });

  return {
    getState: makeState,
    cancelActiveIntent() {
      const current = activePointer;
      if (!current) return;
      releasePointer(current.pointerId);
      detachGlobalPointerListeners();
      activePointer = null;
      options.onPointerIntentCancel?.({
        state: clonePointerState(current),
        originalEvent: new PointerEvent('pointercancel', { pointerId: current.pointerId }),
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      detachGlobalPointerListeners();
      activePointer = null;
      movementKeys.clear();
      canvas.removeEventListener('pointerdown', onPointerDown, { capture: true });
      canvas.removeEventListener('pointermove', onPointerMove, { capture: true });
      canvas.removeEventListener('pointerup', onPointerUp, { capture: true });
      canvas.removeEventListener('pointercancel', onPointerCancel, { capture: true });
      canvas.removeEventListener('wheel', onWheel, { capture: true });
      canvas.removeEventListener('contextmenu', onContextMenu, { capture: true });
      canvas.removeEventListener('dblclick', onDoubleClick, { capture: true });
      canvas.removeEventListener('keydown', onKeyDown, { capture: true });
      canvas.removeEventListener('keyup', onKeyUp, { capture: true });
    },
  };
}

function classifyPointerIntent(
  event: PointerEvent,
  button: SceneViewPointerButton,
  options: BabylonSceneViewInputControllerOptions,
): SceneViewPointerIntent | null {
  if (options.isGizmoDragCandidate?.(event)) return 'gizmo-drag';
  if (options.isViewPlaneMoveCandidate?.(event)) return 'view-plane-move';
  if (event.altKey && button === 'left') return 'orbit';
  if (event.altKey && button === 'middle') return 'pan';
  if (event.altKey && button === 'right') return 'dolly';
  if (button === 'middle') return 'pan';
  if (button === 'right') return 'flythrough';
  if (button === 'left') return 'selection-click';
  return null;
}

function toPointerButton(button: number): SceneViewPointerButton | null {
  if (button === 0) return 'left';
  if (button === 1) return 'middle';
  if (button === 2) return 'right';
  return null;
}

function readModifiers(event: PointerEvent | KeyboardEvent): SceneViewInputModifiers {
  return {
    alt: event.altKey,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
  };
}

function toNavigationMode(intent: SceneViewPointerIntent): SceneViewNavigationMode {
  if (intent === 'orbit' || intent === 'pan' || intent === 'dolly' || intent === 'flythrough') return intent;
  return 'none';
}

function clonePointerState(state: SceneViewPointerState): SceneViewPointerState {
  return {
    ...state,
    start: { ...state.start },
    current: { ...state.current },
    delta: { ...state.delta },
    modifiers: { ...state.modifiers },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointerDistance(startX: number, startY: number, currentX: number, currentY: number): number {
  return Math.hypot(currentX - startX, currentY - startY);
}

function consumePointerEvent(event: PointerEvent, intent: SceneViewPointerIntent): void {
  if (intent === 'selection-click' || intent === 'gizmo-drag') return;
  event.preventDefault();
  event.stopPropagation();
}
