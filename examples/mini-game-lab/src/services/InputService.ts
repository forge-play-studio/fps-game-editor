export interface MovementInputState {
  x: number;
  y: number;
  magnitude: number;
  isActive: boolean;
}

export interface MovementInputSource {
  getInput(): Readonly<MovementInputState>;
}

const IDLE_MOVEMENT_INPUT: Readonly<MovementInputState> = Object.freeze({
  x: 0,
  y: 0,
  magnitude: 0,
  isActive: false,
});

export class InputService implements MovementInputSource {
  private movementSource: MovementInputSource | null = null;
  private enabled = true;
  private canvas: HTMLCanvasElement | null = null;
  private pointerHeld = false;
  private pointerInput: MovementInputState = {
    x: 0,
    y: 0,
    magnitude: 0,
    isActive: false,
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerHeld = true;
    this.updatePointerInput(event);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (!this.pointerHeld) return;
    this.updatePointerInput(event);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerHeld = false;
    this.resetPointerInput();
  };

  private readonly onWindowBlur = () => {
    this.pointerHeld = false;
    this.resetPointerInput();
  };

  constructor(canvas?: HTMLCanvasElement | null) {
    this.setCanvas(canvas ?? null);
  }

  setCanvas(canvas: HTMLCanvasElement | null): void {
    if (this.canvas === canvas) return;

    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('blur', this.onWindowBlur);
    }

    this.canvas = canvas;
    this.pointerHeld = false;
    this.resetPointerInput();

    if (this.canvas) {
      this.canvas.addEventListener('pointerdown', this.onPointerDown);
      this.canvas.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('blur', this.onWindowBlur);
    }
  }

  setMovementSource(source: MovementInputSource | null): void {
    this.movementSource = source;
  }

  clearMovementSource(): void {
    this.movementSource = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getInput(): Readonly<MovementInputState> {
    if (!this.enabled) return IDLE_MOVEMENT_INPUT;

    const sourceInput = this.movementSource?.getInput();
    if (sourceInput?.isActive) {
      return sourceInput;
    }

    return this.pointerInput.isActive ? this.pointerInput : (sourceInput ?? IDLE_MOVEMENT_INPUT);
  }

  private updatePointerInput(event: PointerEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = event.clientX - cx;
    const dy = cy - event.clientY;
    const radius = Math.max(80, Math.min(rect.width, rect.height) * 0.25);

    const nx = dx / radius;
    const ny = dy / radius;
    const mag = Math.sqrt(nx * nx + ny * ny);

    if (mag <= 0.08) {
      this.resetPointerInput();
      return;
    }

    const clamped = Math.min(1, mag);
    this.pointerInput.x = -nx / mag;
    this.pointerInput.y = ny / mag;
    this.pointerInput.magnitude = clamped;
    this.pointerInput.isActive = true;
  }

  private resetPointerInput(): void {
    this.pointerInput.x = 0;
    this.pointerInput.y = 0;
    this.pointerInput.magnitude = 0;
    this.pointerInput.isActive = false;
  }

  dispose(): void {
    this.setCanvas(null);
    this.movementSource = null;
    this.enabled = false;
  }
}
