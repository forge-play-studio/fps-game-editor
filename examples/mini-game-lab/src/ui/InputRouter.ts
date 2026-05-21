import type { PointerEventHandler } from './VirtualJoystick';

export class InputRouter {
  private gameHandler: PointerEventHandler | null = null;
  private activePointerId: number | null = null;
  private enabled = true;

  private readonly onPointerDown = (event: PointerEvent) => {
    if (!this.enabled) return;
    if (event.button !== 0) return;
    if (this.isUIElement(event.target)) return;
    if (this.activePointerId !== null) return;

    this.activePointerId = event.pointerId;
    event.preventDefault();
    event.stopPropagation();
    this.gameHandler?.handlePointerDown(event);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.enabled) return;
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.gameHandler?.handlePointerMove(event);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (!this.enabled) return;
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.gameHandler?.handlePointerUp(event);
    this.activePointerId = null;
  };

  constructor() {
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('pointermove', this.onPointerMove, true);
    document.addEventListener('pointerup', this.onPointerUp, true);
    document.addEventListener('pointercancel', this.onPointerUp, true);
  }

  setGameHandler(handler: PointerEventHandler | null): void {
    this.gameHandler = handler;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.activePointerId = null;
    }
  }

  private isUIElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.closest('[data-input-layer]')) return true;

    const tag = target.tagName;
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'LABEL'].includes(tag)) return true;
    if (target.getAttribute('role') === 'button') return true;
    return false;
  }

  dispose(): void {
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('pointermove', this.onPointerMove, true);
    document.removeEventListener('pointerup', this.onPointerUp, true);
    document.removeEventListener('pointercancel', this.onPointerUp, true);
    this.gameHandler = null;
    this.activePointerId = null;
  }
}
