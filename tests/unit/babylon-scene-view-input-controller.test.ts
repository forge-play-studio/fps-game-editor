import { describe, expect, it, vi } from 'vitest';
import { createBabylonSceneViewInputController } from '../../packages/editor-babylon/src/scene-view-input-controller';

type Listener = (event: any) => void;

class ListenerTargetStub {
  readonly addEventListener = vi.fn((type: string, listener: Listener) => {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  });

  readonly removeEventListener = vi.fn((type: string, listener: Listener) => {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((entry) => entry !== listener));
  });

  private readonly listeners = new Map<string, Listener[]>();

  dispatch(type: string, event: any): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
      if (event.immediatePropagationStopped) return;
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.length ?? 0;
  }
}

function createCanvasStub() {
  const win = new ListenerTargetStub();
  const doc = new ListenerTargetStub() as ListenerTargetStub & { defaultView: ListenerTargetStub };
  doc.defaultView = win;
  const canvasTarget = new ListenerTargetStub();
  const canvas = {
    ownerDocument: doc,
    tabIndex: 0,
    hasAttribute: () => true,
    addEventListener: canvasTarget.addEventListener,
    removeEventListener: canvasTarget.removeEventListener,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    focus: vi.fn(),
    dispatch(type: string, event: any) {
      canvasTarget.dispatch(type, event);
    },
    dispatchWindow(type: string, event: any) {
      win.dispatch(type, event);
    },
    dispatchDocumentKeyDown(event: any) {
      win.dispatch('keydown', event);
      if (!event.propagationStopped) doc.dispatch('keydown', event);
    },
    dispatchDocumentOnly(type: string, event: any) {
      doc.dispatch(type, event);
    },
    getWindowListenerCount(type: string) {
      return win.listenerCount(type);
    },
    getDocumentListenerCount(type: string) {
      return doc.listenerCount(type);
    },
    addDocumentKeyDownListener(listener: Listener) {
      doc.addEventListener('keydown', listener);
    },
  };
  return canvas as unknown as HTMLCanvasElement & typeof canvas;
}

function createPointerEvent(type: string, pointerId: number, button: number): PointerEvent {
  const event = {
    type,
    pointerId,
    button,
    clientX: 10,
    clientY: 20,
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  return event as unknown as PointerEvent;
}

function createKeyboardEvent(
  key: string,
  code = `Key${key.toUpperCase()}`,
  overrides: Partial<Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>> = {},
): KeyboardEvent {
  const event = {
    key,
    code,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(() => {
      event.propagationStopped = true;
    }),
    stopImmediatePropagation: vi.fn(() => {
      event.propagationStopped = true;
      event.immediatePropagationStopped = true;
    }),
  };
  return event as unknown as KeyboardEvent;
}

describe('Babylon scene view input controller', () => {
  it('exposes flythrough keyboard ownership without reserving modified shortcuts', () => {
    const canvas = createCanvasStub();
    const changes: string[][] = [];
    const controller = createBabylonSceneViewInputController({
      canvas,
      onMovementKeysChange(event) {
        changes.push(event.pressedMovementKeys);
      },
    });

    const plainW = createKeyboardEvent('w');
    expect(controller.ownsKeyboardEvent(plainW)).toBe(false);
    expect(controller.getState().keyboardCapture).toBeNull();

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 1, 2));

    expect(controller.ownsKeyboardEvent(plainW)).toBe(true);
    expect(controller.ownsKeyboardEvent(createKeyboardEvent('Unidentified', 'KeyE'))).toBe(true);
    expect(controller.ownsKeyboardEvent(createKeyboardEvent('f'))).toBe(false);
    expect(controller.ownsKeyboardEvent(createKeyboardEvent('Escape'))).toBe(false);
    expect(controller.ownsKeyboardEvent(createKeyboardEvent('w', 'KeyW', { ctrlKey: true }))).toBe(false);
    expect(controller.ownsKeyboardEvent(createKeyboardEvent('w', 'KeyW', { metaKey: true }))).toBe(false);
    expect(controller.ownsKeyboardEvent(createKeyboardEvent('w', 'KeyW', { altKey: true }))).toBe(false);
    expect(controller.getState().keyboardCapture).toEqual({
      owner: 'scene-view',
      intent: 'flythrough',
      keys: ['a', 'd', 'e', 'q', 's', 'w'],
      pressedKeys: [],
    });

    const ctrlW = createKeyboardEvent('w', 'KeyW', { ctrlKey: true });
    canvas.dispatchWindow('keydown', ctrlW);
    expect(ctrlW.preventDefault).not.toHaveBeenCalled();
    expect(ctrlW.stopPropagation).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
    expect(controller.getState().pressedMovementKeys).toEqual([]);

    const shiftedW = createKeyboardEvent('W', 'KeyW', { shiftKey: true });
    canvas.dispatchWindow('keydown', shiftedW);
    expect(changes).toEqual([['w']]);
    expect(controller.getState().keyboardCapture?.pressedKeys).toEqual(['w']);
    expect(shiftedW.preventDefault).toHaveBeenCalled();

    controller.dispose();
  });

  it('captures flythrough movement keys at window capture scope and blocks editor shortcuts', () => {
    const canvas = createCanvasStub();
    const documentShortcut = vi.fn();
    canvas.addDocumentKeyDownListener(documentShortcut);
    const changes: string[][] = [];
    const controller = createBabylonSceneViewInputController({
      canvas,
      onMovementKeysChange(event) {
        changes.push(event.pressedMovementKeys);
      },
    });

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 1, 2));
    expect(controller.getState().activeIntent).toBe('flythrough');
    expect(canvas.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(canvas.getWindowListenerCount('keydown')).toBe(1);
    expect(canvas.getWindowListenerCount('keyup')).toBe(1);
    expect(canvas.getWindowListenerCount('blur')).toBe(1);
    expect(canvas.getDocumentListenerCount('keydown')).toBe(2);
    expect(canvas.getDocumentListenerCount('keyup')).toBe(1);

    const keyDown = createKeyboardEvent('w');
    canvas.dispatchDocumentKeyDown(keyDown);

    expect(changes).toEqual([['w']]);
    expect(controller.getState().pressedMovementKeys).toEqual(['w']);
    expect(keyDown.preventDefault).toHaveBeenCalled();
    expect(keyDown.stopPropagation).toHaveBeenCalled();
    expect(keyDown.stopImmediatePropagation).toHaveBeenCalled();
    expect(documentShortcut).not.toHaveBeenCalled();

    controller.dispose();
  });

  it('also captures flythrough movement keys at document capture scope', () => {
    const canvas = createCanvasStub();
    const changes: string[][] = [];
    const controller = createBabylonSceneViewInputController({
      canvas,
      onMovementKeysChange(event) {
        changes.push(event.pressedMovementKeys);
      },
    });

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 1, 2));
    const keyDown = createKeyboardEvent('q');
    canvas.dispatchDocumentOnly('keydown', keyDown);

    expect(changes).toEqual([['q']]);
    expect(controller.getState().pressedMovementKeys).toEqual(['q']);
    expect(keyDown.preventDefault).toHaveBeenCalled();
    expect(keyDown.stopPropagation).toHaveBeenCalled();
    expect(keyDown.stopImmediatePropagation).toHaveBeenCalled();

    controller.dispose();
  });

  it('clears flythrough movement keys on keyup, pointer end, blur, and dispose', () => {
    const canvas = createCanvasStub();
    const changes: string[][] = [];
    const controller = createBabylonSceneViewInputController({
      canvas,
      onMovementKeysChange(event) {
        changes.push(event.pressedMovementKeys);
      },
    });

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 1, 2));
    canvas.dispatchWindow('keydown', createKeyboardEvent('w'));
    canvas.dispatchWindow('keyup', createKeyboardEvent('w'));
    expect(controller.getState().pressedMovementKeys).toEqual([]);
    expect(changes).toEqual([['w'], []]);

    canvas.dispatchWindow('keydown', createKeyboardEvent('a'));
    canvas.dispatchWindow('blur', { type: 'blur' });
    expect(controller.getState().pressedMovementKeys).toEqual([]);
    expect(changes).toEqual([['w'], [], ['a'], []]);

    canvas.dispatchWindow('keydown', createKeyboardEvent('d'));
    canvas.dispatch('pointerup', createPointerEvent('pointerup', 1, 2));
    expect(controller.getState().activeIntent).toBeNull();
    expect(controller.getState().pressedMovementKeys).toEqual([]);
    expect(canvas.getWindowListenerCount('keydown')).toBe(0);
    expect(canvas.getWindowListenerCount('keyup')).toBe(0);
    expect(canvas.getWindowListenerCount('blur')).toBe(0);
    expect(canvas.getDocumentListenerCount('keydown')).toBe(0);
    expect(canvas.getDocumentListenerCount('keyup')).toBe(0);
    expect(changes).toEqual([['w'], [], ['a'], [], ['d'], []]);

    canvas.dispatch('pointerdown', createPointerEvent('pointerdown', 2, 2));
    canvas.dispatchWindow('keydown', createKeyboardEvent('e'));
    controller.dispose();
    expect(controller.getState().pressedMovementKeys).toEqual([]);
    expect(canvas.getWindowListenerCount('keydown')).toBe(0);
    expect(canvas.getWindowListenerCount('keyup')).toBe(0);
    expect(canvas.getWindowListenerCount('blur')).toBe(0);
    expect(canvas.getDocumentListenerCount('keydown')).toBe(0);
    expect(canvas.getDocumentListenerCount('keyup')).toBe(0);
    expect(changes).toEqual([['w'], [], ['a'], [], ['d'], [], ['e'], []]);
  });
});
