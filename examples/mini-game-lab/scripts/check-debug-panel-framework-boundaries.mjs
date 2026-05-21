import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const read = (path) => {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, 'utf8');
};

const frameworkSource = read('src/debug/framework/index.ts');
const codeGeneratorSource = read('src/debug/framework/CodeGenerator.ts');
const configBridgeSource = read('src/debug/framework/ConfigBridge.ts');
const dslLoaderSource = read('src/debug/framework/PanelDSLLoader.ts');
const liveBindingSource = read('src/debug/framework/LiveBindingRegistry.ts');
const mainSource = read('src/main.ts');
const docsSource = read('docs/debug-panel-framework-design.md');

assert.match(
  configBridgeSource,
  /resolvePersistence\(dsl: Pick<PanelDSL, 'configFile' \| 'params' \| 'persistence'>\)/,
  'ConfigBridge should own persistence resolution instead of scattering config/runtime checks',
);

assert.match(
  frameworkSource,
  /const saved = persistence === 'config'/,
  'DebugPanelFramework should only fetch saved config for persistent panels',
);

assert.match(
  frameworkSource,
  /if \(panel\.persistence !== 'config'\) continue/,
  'DebugPanelFramework should skip runtime/non-persistent panels when saving and dirty-checking',
);

assert.match(
  dslLoaderSource,
  /ALLOWED_PERSISTENCE/,
  'PanelDSLLoader should validate persistence modes',
);

assert.match(
  dslLoaderSource,
  /param\.type="action"/,
  'PanelDSLLoader should validate action params',
);

assert.match(
  dslLoaderSource,
  /is deprecated; use controller \+ runtimePath/,
  'PanelDSLLoader should reject legacy preview rules',
);

assert.match(
  liveBindingSource,
  /invokeAction\(panel: IDebugPanel, actionKey: string, value: unknown\)/,
  'LiveBindingRegistry should own explicit runtime actions',
);

assert.match(
  mainSource,
  /debug\/live-panel[\s\S]*mountLivePanel/,
  'main should keep mounting the legacy live panel so framework testing does not break existing debug workflows',
);

assert.doesNotMatch(
  frameworkSource + configBridgeSource + dslLoaderSource + liveBindingSource + codeGeneratorSource,
  /debug\/live-panel|mountLivePanel/,
  'debug panel framework core should not depend on the legacy live panel',
);

assert.match(
  codeGeneratorSource,
  /persistence: dsl\.persistence \?\? 'config'/,
  'Generated panels should expose resolved persistence to framework save/dirty flows',
);

assert.match(
  docsSource,
  /AI 不能修改 Layer 1-3 框架代码/,
  'Debug panel docs should state the framework/user-space boundary',
);

assert.match(
  docsSource,
  /CodeGenerator.*control renderer registry/,
  'Debug panel docs should preserve the next-step control renderer registry direction',
);

const panelFiles = readdirSync('src/debug/panels').filter(file => file.endsWith('.panel.json'));
for (const file of panelFiles) {
  const panel = JSON.parse(read(`src/debug/panels/${file}`));
  if (panel.configFile === 'runtime') {
    assert.equal(
      panel.persistence,
      'runtime',
      `${file} should declare persistence="runtime" when configFile is runtime`,
    );
  }
  if (panel.controller) {
    assert.ok(
      panel.params.some(param => typeof param.runtimePath === 'string' || param.type === 'action'),
      `${file} should declare runtimePath or action params when it has a controller`,
    );
  }
  assert.equal(panel.preview, undefined, `${file} should not use legacy preview rules`);
  const actionArgRefs = new Set(
    panel.params
      .filter(param => param.type === 'action' && param.actionArgs && typeof param.actionArgs === 'object')
      .flatMap(param => Object.values(param.actionArgs)
        .filter(value => typeof value === 'string' && value.startsWith('$values.'))
        .map(value => value.slice('$values.'.length))),
  );
  for (const param of panel.params) {
    if (param.type === 'action') continue;
    if (actionArgRefs.has(param.key) && typeof param.runtimePath !== 'string') {
      assert.deepEqual(param.configPaths, [], `${file}:${param.key} should remain UI-only when it only feeds actionArgs`);
      continue;
    }
    assert.equal(typeof param.runtimePath, 'string', `${file}:${param.key} should live-bind through runtimePath`);
  }
}

console.log('debug panel framework boundary checks passed');
