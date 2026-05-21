import { createBrowserHost, type BrowserHost } from '@fps-games/editor-browser';

const POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;

export interface EditorEventGuardOptions {
  host?: BrowserHost;
  interactiveRootSelector?: string;
}
export interface EditorEventGuard {
  activate(canvas: HTMLCanvasElement): void;
  deactivate(): void;
  dispose(): void;
  isActive(): boolean;
}

export function createEditorEventGuard(options: EditorEventGuardOptions = {}): EditorEventGuard {
  const host = options.host ?? createBrowserHost();
  const interactiveRootSelector = options.interactiveRootSelector ?? '';
  const forwarded = new WeakSet<Event>();
  const state: { active: boolean; canvas: HTMLCanvasElement | null } = {
    active: false,
    canvas: null,
  };
  const disposers: Array<() => void> = [];

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!interactiveRootSelector) return false;
    return !!(target as Element | null)?.closest?.(interactiveRootSelector);
  }

  function isWithinCanvasViewport(event: PointerEvent | WheelEvent): boolean {
    const canvas = state.canvas;
    if (!canvas) return false;
    if (event.target === canvas) return true;
    const rect = canvas.getBoundingClientRect();
    return event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  }

  function isOutsideCanvasContainer(target: EventTarget | null): boolean {
    const container = state.canvas?.parentElement;
    if (!container || !target) return false;
    return !container.contains(target as Node);
  }

  function handlePointer(event: PointerEvent): void {
    if (!state.active) return;
    if (forwarded.has(event)) return;
    if (isInteractiveTarget(event.target)) return;
    if (isOutsideCanvasContainer(event.target)) return;

    if (state.canvas && isWithinCanvasViewport(event)) {
      event.stopImmediatePropagation();
      const clone = new PointerEvent(event.type, event);
      forwarded.add(clone);
      state.canvas.dispatchEvent(clone);
      return;
    }

    event.stopImmediatePropagation();
    event.preventDefault();
  }

  function handleWheel(event: WheelEvent): void {
    if (!state.active) return;
    if (isInteractiveTarget(event.target)) return;
    if (isOutsideCanvasContainer(event.target)) return;
    if (state.canvas && isWithinCanvasViewport(event)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  function handleKey(event: KeyboardEvent): void {
    if (!state.active) return;
    if (isInteractiveTarget(event.target)) return;
    if (isOutsideCanvasContainer(event.target)) return;
    if (state.canvas && event.target === state.canvas) return;
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  for (const type of POINTER_EVENTS) {
    disposers.push(host.addDocumentEvent(type, handlePointer, true));
  }
  disposers.push(
    host.addDocumentEvent('wheel', handleWheel, true),
    host.addWindowEvent('keydown', handleKey, true),
    host.addWindowEvent('keyup', handleKey, true),
  );

  return {
    activate(canvas: HTMLCanvasElement): void {
      state.canvas = canvas;
      state.active = true;
    },

    deactivate(): void {
      state.active = false;
      state.canvas = null;
    },

    dispose(): void {
      this.deactivate();
      while (disposers.length) disposers.pop()?.();
    },

    isActive(): boolean {
      return state.active;
    },
  };
}
