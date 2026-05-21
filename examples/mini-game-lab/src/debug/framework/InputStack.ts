export class InputStack {
  private active = false;
  private redispatching = false;
  private panelRootSelector: string;
  private hideSelectors: string[];
  private onToggle?: (active: boolean) => void;
  private handlers: {
    pointerdown: (e: PointerEvent) => void;
    pointermove: (e: PointerEvent) => void;
    pointerup: (e: PointerEvent) => void;
    pointercancel: (e: PointerEvent) => void;
    keydown: (e: KeyboardEvent) => void;
    keyup: (e: KeyboardEvent) => void;
    wheel: (e: WheelEvent) => void;
  };

  constructor(
    panelRootSelector = '#debug-panel-framework-root',
    hideSelectors: string[] = [],
    onToggle?: (active: boolean) => void,
  ) {
    this.panelRootSelector = panelRootSelector;
    this.hideSelectors = hideSelectors;
    this.onToggle = onToggle;

    this.handlers = {
      pointerdown: this.onPointer.bind(this),
      pointermove: this.onPointer.bind(this),
      pointerup: this.onPointer.bind(this),
      pointercancel: this.onPointer.bind(this),
      keydown: this.onKey.bind(this),
      keyup: this.onKey.bind(this),
      wheel: this.onWheel.bind(this),
    };
  }

  /** 进入调试模式——安装捕获阶段监听器，隐藏游戏 UI */
  enter(): void {
    if (this.active) return;
    this.active = true;

    this.hideSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) el.style.display = 'none';
    });

    this.onToggle?.(true);

    const opts = { capture: true, passive: false };
    document.addEventListener('pointerdown', this.handlers.pointerdown, opts);
    document.addEventListener('pointermove', this.handlers.pointermove, opts);
    document.addEventListener('pointerup', this.handlers.pointerup, opts);
    document.addEventListener('pointercancel', this.handlers.pointercancel, opts);
    document.addEventListener('keydown', this.handlers.keydown, opts);
    document.addEventListener('keyup', this.handlers.keyup, opts);
    document.addEventListener('wheel', this.handlers.wheel, opts);

    console.log('[InputStack] 调试模式已激活');
  }

  /** 退出调试模式——卸载监听器，恢复游戏 UI */
  exit(): void {
    if (!this.active) return;
    this.active = false;

    this.hideSelectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) el.style.display = '';
    });

    this.onToggle?.(false);

    const opts = { capture: true, passive: false };
    document.removeEventListener('pointerdown', this.handlers.pointerdown, opts);
    document.removeEventListener('pointermove', this.handlers.pointermove, opts);
    document.removeEventListener('pointerup', this.handlers.pointerup, opts);
    document.removeEventListener('pointercancel', this.handlers.pointercancel, opts);
    document.removeEventListener('keydown', this.handlers.keydown, opts);
    document.removeEventListener('keyup', this.handlers.keyup, opts);
    document.removeEventListener('wheel', this.handlers.wheel, opts);

    console.log('[InputStack] 调试模式已退出');
  }

  get isActive(): boolean {
    return this.active;
  }

  setOnToggle(fn: (active: boolean) => void): void {
    this.onToggle = fn;
  }

  setHideSelectors(selectors: string[]): void {
    this.hideSelectors = selectors;
  }

  private onPointer(e: PointerEvent): void {
    if (!this.active) return;
    if (this.redispatching) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // 面板区域 → 放行
    if (this.isInPanel(target)) return;

    // canvas 区域 → clone 并仅发给 canvas
    const canvas = target.closest('canvas');
    if (canvas) {
      this.redispatching = true;
      try {
        const cloned = new PointerEvent(e.type, e);
        canvas.dispatchEvent(cloned);
      } finally {
        this.redispatching = false;
      }
    }

    e.stopImmediatePropagation();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.active) return;
    const target = e.target as HTMLElement | null;

    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )) return;

    if (target && this.isInPanel(target)) return;

    e.stopImmediatePropagation();
  }

  private onWheel(e: WheelEvent): void {
    if (!this.active) return;
    if (this.redispatching) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (this.isInPanel(target)) return;

    const canvas = target.closest('canvas');
    if (canvas) {
      this.redispatching = true;
      try {
        const cloned = new WheelEvent(e.type, e);
        canvas.dispatchEvent(cloned);
      } finally {
        this.redispatching = false;
      }
    }

    e.stopImmediatePropagation();
  }

  private isInPanel(target: HTMLElement): boolean {
    return target.closest(this.panelRootSelector) !== null;
  }
}
