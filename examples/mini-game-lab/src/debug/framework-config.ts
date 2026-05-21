import { createDebugPanelFramework } from './framework';
import { DebugPanelSession, type DebugPanelSessionOptions } from './framework-session';
import type { ConfigPatch, DebugPanelPersistenceAdapter } from './framework';

type CreateDebugPanelSessionOptions = Partial<Pick<DebugPanelSessionOptions, 'root' | 'getGame' | 'pollIntervalMs'>>;

type GameLike = {
  onEditEnter?: () => void;
  onEditExit?: () => void;
};

class ViteDebugPanelPersistenceAdapter implements DebugPanelPersistenceAdapter {
  async load(configFile: string): Promise<Record<string, unknown>> {
    const response = await fetch(`/__debug_panel_config?file=${encodeURIComponent(configFile)}`);
    if (!response.ok) return {};
    return await response.json() as Record<string, unknown>;
  }

  async commit(patches: ConfigPatch[]): Promise<void> {
    for (const patch of patches) {
      const response = await fetch(`/__debug_panel_config?file=${encodeURIComponent(patch.configFile)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: patch.changes }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save debug panel config ${patch.configFile}: ${response.status}`);
      }
    }
  }
}

export { DebugPanelSession };

export function createDebugPanelSession(options: CreateDebugPanelSessionOptions = {}): DebugPanelSession {
  const getGame = options.getGame ?? (() => (window as typeof window & { gameInstance?: unknown }).gameInstance);
  const framework = createDebugPanelFramework();

  framework.setPersistenceAdapter(new ViteDebugPanelPersistenceAdapter());
  framework.setHideSelectors([
    '#virtual-joystick-outer',
    '.game-hud',
    '#debug-hud',
  ]);
  framework.setOnToggle((active) => {
    const game = getGame() as GameLike | null | undefined;
    if (active) game?.onEditEnter?.();
    else game?.onEditExit?.();
  });

  return new DebugPanelSession({
    framework: framework,
    root: options.root ?? document.body,
    getGame,
    pollIntervalMs: options.pollIntervalMs,
    panelModules: import.meta.glob('./panels/*.panel.json', { eager: true, query: '?raw', import: 'default' }),
  });
}
