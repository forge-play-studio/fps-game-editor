/**
 * GameUI — 静态屏幕 UI 层
 *
 * 模块：
 * 1. 右上角资源背包（现金 + 木板）
 * 2. 闲置引导提示 Idle Guide（CLICK TO CHOP）
 * 3. 点击落点波纹反馈
 */

import type { Game } from '../core/Game';
import cashPngUrl from '../assets/钱2.png?url';

// ─── 样式常量 ────────────────────────────────────────────────────────────────
const STYLE_ID = 'game-ui-styles';

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* ── 背包响应式容器 ── */
#game-backpack {
  position: fixed;
  top: calc(12px + env(safe-area-inset-top, 0px));
  right: 12px;
  pointer-events: none;
  z-index: 20;
  transform-origin: top right;
}
.backpack-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.backpack-row {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  background: rgba(0,0,0,0.55);
  border-radius: 22px;
  padding: 10px 18px 10px 12px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  min-width: 156px;
  min-height: 64px;
  justify-content: flex-end;
  overflow: visible;
}
.backpack-icon-slot {
  position: absolute;
  left: 0;
  top: 50%;
  width: 52px;
  height: 52px;
  transform: translateY(-50%);
  pointer-events: none;
}
.backpack-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 260px;
  height: 260px;
  transform: translate(-20%, -75%);
  object-fit: contain;
  flex-shrink: 0;
  image-rendering: auto;
}
.backpack-value {
  font-family: sans-serif;
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
  min-width: 68px;
  text-align: right;
  position: relative;
  z-index: 1;
}
.backpack-value.cash { color: #3bc56f; }
.backpack-value.planks { color: #ffd800; }

/* 背包数值跳动动画 */
@keyframes backpack-bump {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.25); }
  60%  { transform: scale(0.93); }
  100% { transform: scale(1); }
}
.backpack-bump {
  animation: backpack-bump 0.35s ease-out forwards;
}

/* ── Idle Guide ── */
#game-idle-guide {
  position: fixed;
  top: 44vh;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  opacity: 0;
  transition: opacity 0.3s ease;
}
#game-idle-guide.visible { opacity: 1; }

.idle-text {
  font-family: sans-serif;
  font-size: clamp(22px, 5vw, 36px);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.7);
  letter-spacing: 1.5px;
  animation: game-idle-pulse 2s ease-in-out infinite;
}
.idle-hand-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.idle-hand {
  font-size: 48px;
  line-height: 1;
  animation: game-idle-tap 1.6s ease-in-out infinite;
  display: block;
}
.idle-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.7);
  transform: translate(-50%, -50%);
  animation: game-idle-ring 1.6s ease-out infinite;
}

@keyframes game-idle-pulse {
  0%, 100% { transform: scale(0.97); opacity: 0.9; }
  50%       { transform: scale(1.04); opacity: 1; }
}
@keyframes game-idle-tap {
  0%, 100% { transform: rotate(-10deg) scale(1); }
  40%       { transform: rotate(10deg) scale(0.88); }
  60%       { transform: rotate(10deg) scale(0.88); }
}
@keyframes game-idle-ring {
  0%   { width: 0; height: 0; opacity: 0.8; }
  100% { width: 72px; height: 72px; opacity: 0; }
}

/* ── 点击波纹 ── */
.press-ring {
  position: fixed;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.75);
  pointer-events: none;
  z-index: 50;
  width: 0;
  height: 0;
  transform: translate(-50%, -50%);
  animation: game-ripple 0.55s ease-out forwards;
}
@keyframes game-ripple {
  0%   { width: 0;    height: 0;    opacity: 0.85; }
  100% { width: 72px; height: 72px; opacity: 0; }
}
  `;
  document.head.appendChild(style);
}

// ─── GameUI ──────────────────────────────────────────────────────────────────
export class GameUI {
  private game: Game;
  private visible = true;

  // 背包
  private backpackEl!: HTMLDivElement;
  private cashValueEl!: HTMLSpanElement;

  // Idle Guide
  private idleGuideEl!: HTMLDivElement;
  private idleTimer = 0;
  private readonly idleDelay = 2.0; // 秒
  private idleVisible = false;
  private hasEverMoved = false;    // 至少移动过一次才会激活引导

  // 状态缓存（防无效刷新）
  private lastCash = -1;

  // 波纹监听
  private readonly onPointerDown: (e: PointerEvent) => void;

  constructor(game: Game) {
    this.game = game;

    injectStyles();
    this.buildBackpack();
    this.buildIdleGuide();

    // 注册波纹 + 点击隐藏 Idle Guide
    this.onPointerDown = (e) => {
      this.spawnRipple(e.clientX, e.clientY);
      this.hideIdleGuide();
    };
    const canvas = document.getElementById('renderCanvas');
    canvas?.addEventListener('pointerdown', this.onPointerDown);
  }

  // ── 构建 DOM ────────────────────────────────────────────────────────────────
  private buildBackpack(): void {
    const el = document.createElement('div');
    el.id = 'game-backpack';
    el.dataset.inputLayer = 'ui';

    const inner = document.createElement('div');
    inner.className = 'backpack-inner';

    // 现金行
    const cashRow = document.createElement('div');
    cashRow.className = 'backpack-row';
    const cashIconSlot = document.createElement('div');
    cashIconSlot.className = 'backpack-icon-slot';
    const cashIcon = document.createElement('img');
    cashIcon.className = 'backpack-icon';
    cashIcon.src = cashPngUrl;
    cashIcon.alt = 'cash';
    this.cashValueEl = document.createElement('span');
    this.cashValueEl.className = 'backpack-value cash';
    this.cashValueEl.textContent = '$0';
    cashIconSlot.appendChild(cashIcon);
    cashRow.appendChild(cashIconSlot);
    cashRow.appendChild(this.cashValueEl);

    inner.appendChild(cashRow);
    el.appendChild(inner);
    document.body.appendChild(el);
    this.backpackEl = el;

    this.refreshBackpackScale();
    window.addEventListener('resize', () => this.refreshBackpackScale());
  }

  private buildIdleGuide(): void {
    const el = document.createElement('div');
    el.id = 'game-idle-guide';
    el.dataset.inputLayer = 'ui';

    const text = document.createElement('div');
    text.className = 'idle-text';
    text.textContent = 'CLICK TO CHOP';

    const handWrap = document.createElement('div');
    handWrap.className = 'idle-hand-wrap';

    const hand = document.createElement('span');
    hand.className = 'idle-hand';
    hand.textContent = '👆';

    const ring = document.createElement('div');
    ring.className = 'idle-ring';

    handWrap.appendChild(hand);
    handWrap.appendChild(ring);
    el.appendChild(text);
    el.appendChild(handWrap);

    document.body.appendChild(el);
    this.idleGuideEl = el;
  }

  // ── 每帧更新 ────────────────────────────────────────────────────────────────
  update(deltaTime: number): void {
    if (!this.visible) return;
    this.updateBackpack();
    this.updateIdleGuide(deltaTime);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.backpackEl.style.display = visible ? 'block' : 'none';
    this.idleGuideEl.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      this.hideIdleGuide();
    }
  }

  private updateBackpack(): void {
    const economy = this.game.getEconomySystem();
    if (!economy) return;

    const cash = economy.cash;

    if (cash !== this.lastCash) {
      this.cashValueEl.textContent = `$${cash}`;
      this.bumpValue(this.cashValueEl);

      this.lastCash = cash;
    }
  }

  private updateIdleGuide(deltaTime: number): void {
    // 通过 InputService 判断玩家是否在移动
    const inputService = this.game.getInputService();
    const isMoving = inputService ? inputService.getInput().isActive : false;
    const guide = this.game.getNewbieGuideSystem();
    const inBlockingInteraction = guide?.isPlayerInBlockingInteractionZone?.() ?? false;

    if (isMoving || inBlockingInteraction) {
      // 记录已经移动过
      if (!this.hasEverMoved) this.hasEverMoved = true;
      this.idleTimer = 0;
      if (this.idleVisible) {
        this.hideIdleGuide();
      }
    } else {
      // 只有行动过以后才计时
      if (!this.hasEverMoved) return;

      this.idleTimer += deltaTime;
      if (!this.idleVisible && this.idleTimer >= this.idleDelay) {
        this.idleVisible = true;
        this.idleGuideEl.classList.add('visible');
      }
    }
  }

  private hideIdleGuide(): void {
    if (!this.idleVisible) return;
    this.idleVisible = false;
    this.idleGuideEl.classList.remove('visible');
    // 重置计时器，下次需要重新等待 idleDelay
    this.idleTimer = 0;
  }

  /** 在屏幕坐标处生成波纹 */
  spawnRipple(x: number, y: number): void {
    if (!this.visible) return;
    const ring = document.createElement('div');
    ring.className = 'press-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    document.body.appendChild(ring);
    window.setTimeout(() => {
      ring.parentNode?.removeChild(ring);
    }, 600);
  }

  // ── 内部工具 ─────────────────────────────────────────────────────────────────
  private refreshBackpackScale(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / 375, vh / 667, 1.0);
    this.backpackEl.style.transform = `scale(${scale})`;
  }

  private bumpValue(el: HTMLElement): void {
    el.classList.remove('backpack-bump');
    void el.offsetWidth; // reflow
    el.classList.add('backpack-bump');
    window.setTimeout(() => el.classList.remove('backpack-bump'), 400);
  }

  // ── Dispose ──────────────────────────────────────────────────────────────────
  dispose(): void {
    const canvas = document.getElementById('renderCanvas');
    canvas?.removeEventListener('pointerdown', this.onPointerDown);

    this.backpackEl?.parentNode?.removeChild(this.backpackEl);
    this.idleGuideEl?.parentNode?.removeChild(this.idleGuideEl);

    const styleEl = document.getElementById(STYLE_ID);
    styleEl?.parentNode?.removeChild(styleEl);
  }
}
