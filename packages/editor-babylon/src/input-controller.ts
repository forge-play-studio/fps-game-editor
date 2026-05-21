import { createBrowserHost } from '@fps-games/editor-browser';
import type { EditorTool } from '@fps-games/editor-protocol';
import type { EditorInputControllerApi, EditorInputOptions, ViewportNavigationButton } from './types';

const TOOL_KEYS: Record<string, EditorTool> = {
  q: 'pick',
  w: 'move',
  e: 'rotate',
  r: 'scale',
};

const VIEWPORT_MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e']);
const VIEWPORT_DRAG_THRESHOLD_PX = 4;

function isHostHTMLElement(target: EventTarget | null, win: Window): target is HTMLElement {
  const ElementCtor = (win as Window & typeof globalThis).HTMLElement ?? HTMLElement;
  return typeof ElementCtor === 'function' && target instanceof ElementCtor;
}

function isTextEditingTarget(target: EventTarget | null, win: Window): boolean {
  const el = isHostHTMLElement(target, win) ? target : null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function navigationButtonFromPointer(button: number): ViewportNavigationButton | null {
  if (button === 0) return 'left';
  if (button === 1) return 'middle';
  if (button === 2) return 'right';
  return null;
}

export function createEditorInputController(): EditorInputControllerApi {
  let options: EditorInputOptions | null = null;
  let initialized = false;
  let viewportNavigationActive = false;
  let viewportNavigationButton: ViewportNavigationButton | null = null;
  let viewportPointerStart: { x: number; y: number } | null = null;
  let lastViewportPointer: { x: number; y: number } | null = null;
  let viewportPointerDragActive = false;
  const viewportPointerDelta = { dx: 0, dy: 0 };
  const pressedViewportKeys = new Set<string>();
  const disposers: Array<() => void> = [];

  function resetViewportNavigation(): void {
    viewportNavigationActive = false;
    viewportNavigationButton = null;
    viewportPointerStart = null;
    lastViewportPointer = null;
    viewportPointerDragActive = false;
    viewportPointerDelta.dx = 0;
    viewportPointerDelta.dy = 0;
    pressedViewportKeys.clear();
  }

  const api: EditorInputControllerApi = {
    init(nextOptions: EditorInputOptions): void {
      api.dispose();
      options = nextOptions;
      const host = nextOptions.host ?? createBrowserHost();

      const onKeyDown = (event: KeyboardEvent) => {
        if (!options?.isEditActive()) return;
        if (isTextEditingTarget(event.target, host.window)) return;

        const key = event.key.toLowerCase();
        const primaryModifier = event.ctrlKey || event.metaKey;

        if (primaryModifier && !event.altKey && key === 'z') {
          event.preventDefault();
          if (event.shiftKey) options.onRedo?.();
          else options.onUndo?.();
          return;
        }

        if (primaryModifier && !event.altKey && !event.shiftKey && key === 'd') {
          event.preventDefault();
          void options.onDuplicateSelected?.();
          return;
        }

        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && key === 'f') {
          event.preventDefault();
          options.onFocusSelected();
          return;
        }

        if (viewportNavigationActive && VIEWPORT_MOVE_KEYS.has(key)) {
          pressedViewportKeys.add(key);
          event.preventDefault();
          return;
        }

        if (viewportNavigationActive) return;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

        const tool = TOOL_KEYS[key];
        if (!tool) return;
        event.preventDefault();
        options.onSetTool(tool);
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (!options?.isEditActive()) return;
        pressedViewportKeys.delete(event.key.toLowerCase());
      };

      const onPointerDown = (event: PointerEvent) => {
        if (!options?.isEditActive()) return;
        const canvas = options.getCanvas();
        if (!canvas) return;
        const navButton = navigationButtonFromPointer(event.button);
        if (event.target === canvas && navButton && navButton !== 'left') {
          viewportNavigationActive = true;
          viewportNavigationButton = navButton;
          viewportPointerStart = { x: event.clientX, y: event.clientY };
          lastViewportPointer = { x: event.clientX, y: event.clientY };
          viewportPointerDragActive = false;
        }
      };

      const onPointerMove = (event: PointerEvent) => {
        if (!options?.isEditActive()) return;
        if (!viewportNavigationActive || !viewportNavigationButton) return;
        if (!lastViewportPointer) {
          lastViewportPointer = { x: event.clientX, y: event.clientY };
          return;
        }

        const dx = event.clientX - lastViewportPointer.x;
        const dy = event.clientY - lastViewportPointer.y;
        if ((viewportNavigationButton === 'left' || viewportNavigationButton === 'middle') && !viewportPointerDragActive) {
          const start = viewportPointerStart || lastViewportPointer;
          const totalDx = event.clientX - start.x;
          const totalDy = event.clientY - start.y;
          if (Math.hypot(totalDx, totalDy) < VIEWPORT_DRAG_THRESHOLD_PX) {
            lastViewportPointer = { x: event.clientX, y: event.clientY };
            return;
          }
          viewportPointerDragActive = true;
          lastViewportPointer = { x: event.clientX, y: event.clientY };
          return;
        }

        viewportPointerDelta.dx += dx;
        viewportPointerDelta.dy += dy;
        lastViewportPointer = { x: event.clientX, y: event.clientY };
      };

      const onPointerUp = (event: PointerEvent) => {
        if (!options?.isEditActive()) return;
        const navButton = navigationButtonFromPointer(event.button);
        if (!navButton || navButton !== viewportNavigationButton) return;
        resetViewportNavigation();
      };

      disposers.push(
        host.addWindowEvent('keydown', onKeyDown),
        host.addWindowEvent('keyup', onKeyUp),
        host.addWindowEvent('pointerdown', onPointerDown, true),
        host.addWindowEvent('pointermove', onPointerMove, true),
        host.addWindowEvent('pointerup', onPointerUp, true),
        host.addWindowEvent('blur', resetViewportNavigation),
      );
      initialized = true;
    },

    dispose(): void {
      if (!initialized) return;
      while (disposers.length) disposers.pop()?.();
      initialized = false;
      options = null;
      resetViewportNavigation();
    },

    isViewportNavigationActive(): boolean {
      return viewportNavigationActive;
    },

    activeViewportNavigationButton(): ViewportNavigationButton | null {
      return viewportNavigationButton;
    },

    consumeViewportPointerDelta(): { dx: number; dy: number } {
      const delta = { ...viewportPointerDelta };
      viewportPointerDelta.dx = 0;
      viewportPointerDelta.dy = 0;
      return delta;
    },

    pressedViewportMovementKeys(): Set<string> {
      return pressedViewportKeys;
    },

    resetViewportNavigation,
  };

  return api;
}
