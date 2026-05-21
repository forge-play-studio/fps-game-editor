/**
 * FloatingUIManager — 3D 坐标跟随悬浮 UI
 *
 * 模块：
 * - 漂浮数值反馈（+$N, +N木板 等）
 *
 * 核心：在每帧 update() 中使用 Vector3.Project 将 3D 世界坐标转换为屏幕 2D 坐标。
 */

import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';

import type { Game } from '../core/Game';

// ─── 样式 ─────────────────────────────────────────────────────────────────────
const FLOAT_STYLE_ID = 'game-float-styles';

function injectFloatStyles(): void {
  if (document.getElementById(FLOAT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FLOAT_STYLE_ID;
  style.textContent = `
/* ── 漂浮数值 ── */
.float-number {
  position: fixed;
  pointer-events: none;
  z-index: 26;
  font-family: sans-serif;
  font-size: 16px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5);
  transform: translate(-50%, -50%);
  white-space: nowrap;
  will-change: transform, opacity;
}
.float-number.cash   { color: #3bc56f; }
.float-number.planks { color: #ffd800; }
.float-number.max    { color: #ff6b6b; }
  `;
  document.head.appendChild(style);
}

// ─── FloatingUIManager ───────────────────────────────────────────────────────
interface FloatNumberItem {
  el: HTMLDivElement;
  worldPos: Vector3;
  screenYOffset: number; // 屏幕像素偏移（上升）
  age: number;           // 秒
  lifetime: number;      // 秒
  baseScreenX: number;
  baseScreenY: number;
  inUse: boolean;
}

export class FloatingUIManager {
  private scene: Scene;
  private camera: ArcRotateCamera | null;
  private engine: Engine;
  private game: Game;

  private floatPool: FloatNumberItem[] = [];
  private readonly POOL_SIZE = 12;

  private container: HTMLDivElement;
  private visible = true;

  constructor(game: Game) {
    this.game = game;
    this.scene = game.getScene();
    this.camera = game.getCamera();
    this.engine = game.getEngine();

    injectFloatStyles();

    this.container = document.createElement('div');
    this.container.id = 'game-floating-layer';
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:25;overflow:visible;';
    document.body.appendChild(this.container);

    // 初始化漂浮数值对象池
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'float-number';
      el.style.display = 'none';
      this.container.appendChild(el);
      this.floatPool.push({
        el,
        worldPos: Vector3.Zero(),
        screenYOffset: 0,
        age: 0,
        lifetime: 1.2,
        baseScreenX: 0,
        baseScreenY: 0,
        inUse: false,
      });
    }
  }

  // ── 生成漂浮数值 ───────────────────────────────────────────────────────────
  spawnFloatNumber(text: string, worldPos: Vector3, kind: 'cash' | 'planks' | 'max' = 'cash'): void {
    const item = this.floatPool.find((f) => !f.inUse);
    if (!item) return; // 对象池满了

    const projected = this.projectToScreen(worldPos);
    if (!projected) return;

    // 堆叠检测：与现有活跃数值太近则初始向上偏移
    let extraOffset = 0;
    for (const other of this.floatPool) {
      if (!other.inUse) continue;
      const dy = Math.abs(other.baseScreenY - projected.y - other.screenYOffset);
      const dx = Math.abs(other.baseScreenX - projected.x);
      if (dx < 60 && dy < 30) {
        extraOffset += 30;
      }
    }

    item.inUse = true;
    item.worldPos = worldPos.clone();
    item.screenYOffset = extraOffset;
    item.age = 0;
    item.lifetime = 1.2;
    item.baseScreenX = projected.x;
    item.baseScreenY = projected.y;

    item.el.textContent = text;
    item.el.className = `float-number ${kind}`;
    item.el.style.display = 'block';
    item.el.style.opacity = '1';
    item.el.style.left = `${projected.x}px`;
    item.el.style.top = `${projected.y}px`;
  }

  // ── 每帧更新 ──────────────────────────────────────────────────────────────
  update(deltaTime: number): void {
    if (!this.visible) return;
    this.camera = this.game.getCamera();
    if (!this.camera) return;

    this.updateFloatNumbers(deltaTime);
    this.updateUnlockTriggers();
  }

  private updateFloatNumbers(deltaTime: number): void {
    for (const item of this.floatPool) {
      if (!item.inUse) continue;

      item.age += deltaTime;
      item.screenYOffset += 40 * deltaTime; // 每秒上升 40px

      const t = item.age / item.lifetime;
      const opacity = 1 - Math.pow(t, 2);

      if (t >= 1) {
        item.inUse = false;
        item.el.style.display = 'none';
        continue;
      }

      // 重新投影
      const projected = this.projectToScreen(item.worldPos);
      const screenX = projected ? projected.x : item.baseScreenX;
      const screenY = projected ? projected.y : item.baseScreenY;

      item.el.style.left = `${screenX}px`;
      item.el.style.top = `${screenY - item.screenYOffset}px`;
      item.el.style.opacity = String(Math.max(0, opacity));
    }
  }

  private updateUnlockTriggers(): void {
    const player = this.game.getPlayer();
    if (!player) return;

    // 监测现金捡取 → 生成漂浮数值
    const cashPending = (player as any).collectedCashPending as number | undefined;
    if (cashPending && cashPending > 0) {
      const pos = player.position.clone();
      pos.y += 1.5;
      const guide = this.game.getNewbieGuideSystem() as any;
      const amount = cashPending * ((guide?.rewardCashPerBill as number | undefined) ?? 15);
      this.spawnFloatNumber(`+$${amount}`, pos, 'cash');
    }

    // 监测木板交付 → 生成漂浮数值
    const boardsPending = (player as any).deliveredToTruckPending as number | undefined;
    if (boardsPending && boardsPending > 0) {
      const pos = player.position.clone();
      pos.y += 1.5;
      this.spawnFloatNumber(`+${boardsPending} 木板`, pos, 'planks');
    }
  }

  // ── 3D→2D 投影 ────────────────────────────────────────────────────────────
  private projectToScreen(worldPos: Vector3): { x: number; y: number } | null {
    if (!this.camera) return null;

    const engine = this.engine;
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const viewport = this.camera.viewport.toGlobal(width, height);

    const projected = Vector3.Project(
      worldPos,
      Matrix.IdentityReadOnly,
      this.scene.getTransformMatrix(),
      viewport,
    );

    // 视锥剔除
    if (projected.z < 0 || projected.z > 1) return null;

    const margin = 80;
    if (
      projected.x < -margin || projected.x > width + margin ||
      projected.y < -margin || projected.y > height + margin
    ) {
      return null;
    }

    // 渲染分辨率 → CSS 像素
    const dpr = window.devicePixelRatio || 1;
    return {
      x: projected.x / dpr,
      y: projected.y / dpr,
    };
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  // ── Dispose ───────────────────────────────────────────────────────────────
  dispose(): void {
    this.container.parentNode?.removeChild(this.container);
    const styleEl = document.getElementById(FLOAT_STYLE_ID);
    styleEl?.parentNode?.removeChild(styleEl);
  }
}
