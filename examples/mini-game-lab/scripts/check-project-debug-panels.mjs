import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPanelsFromJSONModules } from '../src/debug/framework/PanelDSLLoader.ts';

const panelDir = 'src/debug/panels';
const modules = {};

for (const name of readdirSync(panelDir).filter((item) => item.endsWith('.panel.json'))) {
  modules[join(panelDir, name)] = readFileSync(join(panelDir, name), 'utf8');
}

const panels = await loadPanelsFromJSONModules(modules);
assert.ok(panels.some((panel) => panel.id === 'mock-platform-assets'), 'mock-platform-assets panel should load');
assert.ok(panels.some((panel) => panel.controller === 'mockPlatformAssets'), 'mockPlatformAssets controller binding should load');

console.log(`project debug panel checks passed (${panels.length} panels)`);
