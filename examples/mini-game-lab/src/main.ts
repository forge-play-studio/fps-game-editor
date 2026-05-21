/**
 * 应用入口
 * 初始化游戏应用（新系统）
 */

import { LoadingScreen } from './ui';
import { Game } from './core/Game';
import type { DebugPanelSession } from './debug/framework-session';
import type { LivePanelSession } from './debug/live-panel';
import type { LocalEditorModeSwitcher } from './debug/local-editor-mode-switcher';

async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '1');

  try {
    const loadSentry = Function('return import("@sentry/browser")') as () => Promise<any>;
    const Sentry = await loadSentry();
    Sentry.init({
      dsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 1,
      tracePropagationTargets: ['localhost', /^https:\/\/.+\/api/, /^\//],
      sendDefaultPii: true,
    });
  } catch (error) {
    console.warn('Sentry disabled: @sentry/browser is not available.', error);
  }
}

void initSentry();

// ============================================================
// 全局实例
// ============================================================

/** 游戏实例 */
let game: Game | null = null;

/** 加载屏幕 */
let loadingScreen: LoadingScreen | null = null;

/** DEV-only debug panel session */
let debugPanelSession: DebugPanelSession | null = null;

/** DEV-only dat.GUI live tuning panel session */
let livePanelSession: LivePanelSession | null = null;

/** DEV-only local editor/game mode switcher */
let localEditorModeSwitcher: LocalEditorModeSwitcher | null = null;

async function registerLegacyRuntimeEditorBridge(): Promise<void> {
  const editorModule = await import('./fps-game-editor-adapter/runtime');
  editorModule.registerLumberOrderFpsGameEditorRuntimeBridge();
}

function disposeDebugPanelSession(): void {
  debugPanelSession?.dispose();
  debugPanelSession = null;
}

function disposeLivePanelSession(): void {
  livePanelSession?.dispose();
  livePanelSession = null;
}

function disposeLocalEditorModeSwitcher(): void {
  localEditorModeSwitcher?.dispose();
  localEditorModeSwitcher = null;
}

// ============================================================
// 初始化函数
// ============================================================

/**
 * 主初始化函数
 */
async function init(): Promise<void> {
  try {
    // 开发模式：暴露 BABYLON 供 AI 调试脚本使用
    if (import.meta.env.DEV) {
      const BABYLON = await import('@babylonjs/core');
      (window as any).BABYLON = BABYLON;
    }

    // 创建并显示加载页面
    loadingScreen = new LoadingScreen();

    // 创建游戏实例
    game = new Game({
      canvasId: 'renderCanvas',
      debug: true,
      enableAudio: true,
    });

    // 初始化游戏（包括资源加载和场景构建）
    await game.init();

    if (import.meta.env.VITE_ENABLE_LEGACY_RUNTIME_EDITOR === 'true') {
      await registerLegacyRuntimeEditorBridge();
    }

    // 隐藏加载页面
    loadingScreen?.hide();

    // 启动游戏循环
    game.start();

    // 暴露给调试
    window.gameInstance = game;

    if (import.meta.env.DEV) {
      const sandboxId = new URLSearchParams(window.location.search).get('sandboxId') ?? '';
      void import('./debug/live-panel')
        .then(async ({ mountLivePanel }) => {
          const scene = game?.getScene();
          if (!scene) return;
          disposeLivePanelSession();
          const session = await mountLivePanel(scene, { sandboxId });
          if (!game || game.getScene() !== scene) {
            session.dispose();
            return;
          }
          livePanelSession = session;
        })
        .catch((error) => console.warn('[live-panel] mount failed', error));

      void import('./debug/framework-config')
        .then((module) => {
          disposeDebugPanelSession();
          debugPanelSession = module.createDebugPanelSession({
            root: document.body,
            getGame: () => game,
          });
          return debugPanelSession.init();
        })
        .catch((error) => console.warn('[debug-panel-framework] mount failed', error));

      void import('./debug/local-editor-mode-switcher')
        .then(({ mountLocalEditorModeSwitcher }) => {
          disposeLocalEditorModeSwitcher();
          localEditorModeSwitcher = mountLocalEditorModeSwitcher({
            root: document.body,
            disposeGameWorld: () => {
              disposeLivePanelSession();
              disposeDebugPanelSession();
              game?.dispose();
              game = null;
              window.gameInstance = null;
              (window as any).game = null;
              (window as any).__bridgeProjectRuntime = null;
              (window as any).__pendingEditorRuntime = null;
            },
            onBeforeReload: () => {
              disposeLocalEditorModeSwitcher();
              disposeLivePanelSession();
              disposeDebugPanelSession();
            },
          });
        })
        .catch((error) => console.warn('[local-editor-mode-switcher] mount failed', error));
    }

  } catch (error) {
    console.error('[Main] Failed to initialize game:', error);
    // 发生错误时也隐藏加载页面
    loadingScreen?.hide();
  }
}

// ============================================================
// 启动
// ============================================================

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (import.meta.env.DEV) {
  const disposeDevTools = () => {
    disposeLocalEditorModeSwitcher();
    disposeLivePanelSession();
    disposeDebugPanelSession();
  };
  window.addEventListener('beforeunload', disposeDevTools);
  import.meta.hot?.dispose(disposeDevTools);
}

// ============================================================
// 调试接口
// ============================================================

declare global {
  interface Window {
    /** 游戏实例 */
    gameInstance: Game | null;
    /** Babylon.js 命名空间 (仅开发模式) */
    BABYLON?: any;
    ensureInspectorReady?: () => Promise<any>;
    INSPECTOR?: any;
  }
}

export { game };
