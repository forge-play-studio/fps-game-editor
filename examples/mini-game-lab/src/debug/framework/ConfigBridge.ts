import type { DebugPanelPersistenceAdapter, PanelDSL, ConfigPatch } from './types';

class NoopPersistenceAdapter implements DebugPanelPersistenceAdapter {
  async load(): Promise<Record<string, unknown>> {
    return {};
  }

  async commit(patches: ConfigPatch[]): Promise<void> {
    if (patches.length === 0) return;
    throw new Error('[ConfigBridge] No DebugPanelPersistenceAdapter configured');
  }
}

export class ConfigBridge {
  private readonly frameworkConfigFile = 'panel-framework.json';
  private persistenceAdapter: DebugPanelPersistenceAdapter;

  constructor(persistenceAdapter: DebugPanelPersistenceAdapter = new NoopPersistenceAdapter()) {
    this.persistenceAdapter = persistenceAdapter;
  }

  setPersistenceAdapter(adapter: DebugPanelPersistenceAdapter): void {
    this.persistenceAdapter = adapter;
  }

  resolvePersistence(dsl: Pick<PanelDSL, 'configFile' | 'params' | 'persistence'>): NonNullable<PanelDSL['persistence']> {
    if (dsl.persistence) return dsl.persistence;
    if (dsl.configFile === 'runtime') return 'runtime';
    if (dsl.params.every(param => param.configPaths.length === 0)) return 'none';
    return 'config';
  }

  /** 从 JSON 文件加载已保存的值 */
  async loadFromFile(configFile = this.frameworkConfigFile): Promise<Record<string, unknown>> {
    try {
      return await this.persistenceAdapter.load(configFile);
    } catch {
      return {};
    }
  }

  /** 构建保存用的 patch */
  buildPatch(
    dsl: PanelDSL,
    currentValues: Record<string, unknown>,
  ): ConfigPatch | null {
    if (this.resolvePersistence(dsl) !== 'config') return null;

    const changes: Record<string, unknown> = {};
    for (const param of dsl.params) {
      const value = currentValues[param.key];
      if (param.type === 'vector3' && Array.isArray(value) && param.configPaths.length >= 3) {
        param.configPaths.slice(0, 3).forEach((configPath, index) => {
          if (!configPath) return;
          changes[configPath] = value[index];
        });
        continue;
      }
      for (const configPath of param.configPaths) {
        if (!configPath) continue;
        changes[configPath] = value;
      }
    }
    if (Object.keys(changes).length === 0) return null;
    return { configFile: dsl.configFile || this.frameworkConfigFile, changes };
  }

  /** 通过项目侧 adapter 保存 */
  async commit(patches: ConfigPatch[]): Promise<void> {
    const grouped = new Map<string, Record<string, unknown>>();
    for (const patch of patches) {
      const existing = grouped.get(patch.configFile) ?? {};
      Object.assign(existing, patch.changes);
      grouped.set(patch.configFile, existing);
    }

    for (const [configFile, changes] of grouped) {
      if (Object.keys(changes).length === 0) continue;

      await this.persistenceAdapter.commit([{ configFile, changes }]);
      console.log(`[ConfigBridge] ${configFile} 已保存`);
    }
  }
}
