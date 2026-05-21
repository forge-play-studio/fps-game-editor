import type { DebugPanelLiveBindingState, DebugPanelRuntimeController, IDebugPanel, PanelLiveState, ParamDSL } from './types';

type HostGameWithDebugControllers = {
  scene?: {
    metadata?: {
      debugControllers?: Record<string, DebugPanelRuntimeController>;
    } & Record<string, unknown>;
  };
};

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

export class LiveBindingRegistry {
  private state: DebugPanelLiveBindingState = 'unbound';

  constructor(private readonly getGame: () => unknown) {}

  getState(): DebugPanelLiveBindingState {
    return this.state;
  }

  applyPanel(panel: IDebugPanel, changedKey?: string): PanelLiveState {
    const controllerId = panel.controller;
    if (!controllerId) return 'idle';

    const controller = this.getController(controllerId);
    if (!controller) {
      console.warn(`[LiveBindingRegistry] Runtime controller "${controllerId}" not found`);
      return 'no-controller';
    }

    const values = panel.snapshot();
    const patch: Record<string, unknown> = {};
    for (const param of panel.params) {
      if (!this.shouldBindParam(param, changedKey)) continue;
      setPath(patch, param.runtimePath!, values[param.key]);
    }

    if (Object.keys(patch).length === 0) return 'idle';

    try {
      if (typeof controller.applyLivePatch === 'function') {
        controller.applyLivePatch(patch);
      } else {
        controller.updateConfig?.(patch);
      }
      this.state = 'bound';
      return 'applied';
    } catch (error) {
      console.error(`[LiveBindingRegistry] Failed to apply patch to "${controllerId}":`, error);
      return 'apply-failed';
    }
  }

  dispose(): void {
    this.state = 'disposed';
  }

  invokeAction(panel: IDebugPanel, actionKey: string, value: unknown): PanelLiveState {
    const controllerId = panel.controller;
    if (!controllerId) return 'idle';
    const param = panel.params.find(item => item.key === actionKey);
    if (!param || param.type !== 'action' || !param.action) return 'idle';

    const controller = this.getController(controllerId);
    if (!controller?.invokeAction) {
      console.warn(`[LiveBindingRegistry] Runtime controller "${controllerId}" has no invokeAction() handler`);
      return 'no-controller';
    }

    try {
      controller.invokeAction({
        action: param.action,
        args: this.interpolateActionArgs(param.actionArgs ?? {}, panel.snapshot(), value),
      });
      this.state = 'bound';
      return 'applied';
    } catch (error) {
      console.error(`[LiveBindingRegistry] Failed to invoke action "${param.action}" on "${controllerId}":`, error);
      return 'apply-failed';
    }
  }

  private shouldBindParam(param: ParamDSL, changedKey?: string): boolean {
    if (param.type === 'action') return false;
    if (!param.runtimePath) return false;
    return changedKey == null || param.key === changedKey;
  }

  private interpolateActionArgs(args: Record<string, unknown>, values: Record<string, unknown>, value: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, arg] of Object.entries(args)) {
      if (arg === '$value') {
        result[key] = value;
        continue;
      }
      if (typeof arg === 'string' && arg.startsWith('$values.')) {
        result[key] = values[arg.slice('$values.'.length)];
        continue;
      }
      result[key] = arg;
    }
    return result;
  }

  private getController(id: string): DebugPanelRuntimeController | null {
    const game = this.getGame() as HostGameWithDebugControllers | null | undefined;
    const metadata = game?.scene?.metadata;
    const controllers = metadata?.debugControllers;
    const controller = controllers?.[id] ?? (metadata?.[id] as DebugPanelRuntimeController | undefined);
    if (!controller || typeof controller !== 'object') return null;
    if (
      typeof controller.applyLivePatch !== 'function'
      && typeof controller.updateConfig !== 'function'
      && typeof controller.invokeAction !== 'function'
    ) return null;
    return controller;
  }
}
