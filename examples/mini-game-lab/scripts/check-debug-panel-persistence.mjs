import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const panelDir = 'src/debug/panels';
const panels = existsSync(panelDir)
  ? readdirSync(panelDir)
    .filter((name) => name.endsWith('.panel.json'))
    .map((name) => {
      const file = join(panelDir, name);
      return { file, dsl: JSON.parse(readFileSync(file, 'utf8')) };
    })
  : [];

assert.ok(panels.length > 0, 'debug panel framework should have at least one project panel');

const supportedConfigFiles = new Set([
  'panel-framework.json',
  'scene.json',
  'rendering.json',
]);

for (const { file, dsl } of panels) {
  assert.ok(
    supportedConfigFiles.has(dsl.configFile),
    `${file} uses unsupported configFile "${dsl.configFile}"`,
  );

  const persistence = dsl.persistence ?? (dsl.configFile === 'runtime' ? 'runtime' : 'config');
  for (const param of dsl.params) {
    if (param.type === 'action') {
      assert.deepEqual(param.configPaths, [], `${file}:${param.key} action params should not persist config paths`);
      continue;
    }
    if (persistence === 'config') {
      assert.ok(
        Array.isArray(param.configPaths) && param.configPaths.length > 0,
        `${file}:${param.key} config-persistent params must declare configPaths`,
      );
    }
  }
}

const configBridgeSource = readFileSync('src/debug/framework/ConfigBridge.ts', 'utf8');
assert.match(
  configBridgeSource,
  /DebugPanelPersistenceAdapter/,
  'ConfigBridge should persist through a project-provided adapter',
);
assert.doesNotMatch(
  configBridgeSource,
  /__live_panel_config|\/src\/config\//,
  'ConfigBridge core should not hardcode the project Vite config endpoint or src/config path',
);

const frameworkConfigSource = readFileSync('src/debug/framework-config.ts', 'utf8');
assert.match(
  frameworkConfigSource,
  /class ViteDebugPanelPersistenceAdapter/,
  'framework-config should provide the lumber_order Vite persistence adapter',
);
assert.match(
  frameworkConfigSource,
  /__debug_panel_config/,
  'lumber_order adapter should use the project-owned debug panel config endpoint',
);

console.log('debug panel persistence checks passed');
