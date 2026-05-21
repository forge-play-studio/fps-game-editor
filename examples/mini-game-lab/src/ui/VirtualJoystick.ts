import type { MovementInputState, MovementInputSource } from '../services';

export interface PointerEventHandler {
  handlePointerDown(event: PointerEvent): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
}

const DEADZONE = 0.08;
const MAX_DISTANCE = 70;

export class VirtualJoystick implements MovementInputSource, PointerEventHandler {
  private container: HTMLElement;
  private outer: HTMLDivElement;
  private inner: HTMLDivElement;
  private enabled = true;
  private pointerId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private isPointerDown = false;
  private input: MovementInputState = {
    x: 0,
    y: 0,
    magnitude: 0,
    isActive: false,
  };

  constructor(container: HTMLElement) {
    this.container = container;

    this.outer = document.createElement('div');
    this.outer.id = 'virtual-joystick-outer';
    this.outer.style.cssText = [
      'position: fixed',
      'width: 140px',
      'height: 140px',
      'margin-left: -70px',
      'margin-top: -70px',
      'border-radius: 50%',
      'background: rgba(255,255,255,0.12)',
      'border: 2px solid rgba(255,255,255,0.22)',
      'display: none',
      'align-items: center',
      'justify-content: center',
      'z-index: 10000',
      'pointer-events: none',
      'touch-action: none',
      'backdrop-filter: blur(4px)',
      '-webkit-backdrop-filter: blur(4px)',
    ].join(';');

    this.inner = document.createElement('div');
    this.inner.id = 'virtual-joystick-inner';
    this.inner.style.cssText = [
      'width: 60px',
      'height: 60px',
      'border-radius: 50%',
      'background: rgba(255,255,255,0.75)',
      'box-shadow: 0 2px 10px rgba(0,0,0,0.25)',
      'transform: translate(0px, 0px)',
      'pointer-events: none',
    ].join(';');

    this.outer.appendChild(this.inner);
    this.container.appendChild(this.outer);
  }

  getInput(): Readonly<MovementInputState> {
    return this.input;
  }

  handlePointerDown(event: PointerEvent): void {
    if (!this.enabled) return;
    this.pointerId = event.pointerId;
    this.isPointerDown = true;
    this.input.isActive = true;
    this.showJoystickAt(event.clientX, event.clientY);
    this.updateJoystick(event.clientX, event.clientY);
  }

  handlePointerMove(event: PointerEvent): void {
    if (!this.enabled) return;
    if (!this.isPointerDown || event.pointerId !== this.pointerId) return;
    this.updateJoystick(event.clientX, event.clientY);
  }

  handlePointerUp(event: PointerEvent): void {
    if (!this.enabled) return;
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.isPointerDown = false;
    this.hideJoystick();
    this.resetInput();
  }

  private showJoystickAt(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.outer.style.left = `${x}px`;
    this.outer.style.top = `${y}px`;
    this.outer.style.display = 'flex';
  }

  private hideJoystick(): void {
    this.outer.style.display = 'none';
    this.inner.style.transform = 'translate(0px, 0px)';
  }

  private updateJoystick(clientX: number, clientY: number): void {
    let dx = clientX - this.baseX;
    let dy = clientY - this.baseY;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_DISTANCE && dist > 0.0001) {
      const scale = MAX_DISTANCE / dist;
      dx *= scale;
      dy *= scale;
    }

    this.inner.style.transform = `translate(${dx}px, ${dy}px)`;

    const nx = dx / MAX_DISTANCE;
    const ny = -dy / MAX_DISTANCE;
    const mag = Math.sqrt(nx * nx + ny * ny);

    if (mag <= DEADZONE) {
      this.resetInput(true);
      return;
    }

    const normalizedX = nx / mag;
    const normalizedY = ny / mag;
    const remappedMagnitude = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));

    this.input.x = normalizedX;
    this.input.y = normalizedY;
    this.input.magnitude = remappedMagnitude;
    this.input.isActive = true;
  }

  private resetInput(keepActive = false): void {
    this.input.x = 0;
    this.input.y = 0;
    this.input.magnitude = 0;
    this.input.isActive = keepActive;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.pointerId = null;
      this.isPointerDown = false;
      this.hideJoystick();
      this.resetInput();
    }
  }

  dispose(): void {
    this.outer.parentNode?.removeChild(this.outer);
    this.pointerId = null;
    this.isPointerDown = false;
    this.resetInput();
  }
}
