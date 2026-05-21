import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = (path) => {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, 'utf8');
};

const typesSource = read('src/debug/framework/types.ts');
const frameworkSource = read('src/debug/framework/index.ts');
const sessionSource = read('src/debug/framework-session.ts');
const configSource = read('src/debug/framework-config.ts');
const mainSource = read('src/main.ts');
const panelRegistrySource = read('src/debug/framework/PanelRegistry.ts');
const liveBindingRegistrySource = read('src/debug/framework/LiveBindingRegistry.ts');
const codeGeneratorSource = read('src/debug/framework/CodeGenerator.ts');
const abilityFiles = existsSync('src/debug/abilities')
  ? readdirSync('src/debug/abilities').filter((file) => file.endsWith('.ability.ts'))
  : [];

// This script is intentionally structural. It catches regressions where a
// future agent accidentally reintroduces global framework imports, top-level
// auto-start, or lifecycle methods without running the browser.
assert.match(
  typesSource,
  /export type DebugPanelSessionState\s*=[\s\S]*?'created'[\s\S]*?'initializing'[\s\S]*?'ready'[\s\S]*?'disposing'[\s\S]*?'disposed'/,
  'types should define DebugPanelSessionState with explicit lifecycle stages',
);

assert.match(
  typesSource,
  /'failed'/,
  'DebugPanelSessionState should include failed for init error cleanup',
);

assert.match(
  typesSource,
  /export type PanelPersistence\s*=[\s\S]*?'config'[\s\S]*?'runtime'[\s\S]*?'none'/,
  'types should define PanelPersistence for config/runtime/transient panels',
);

assert.match(
  typesSource,
  /export type DebugPanelLiveBindingState\s*=[\s\S]*?'unbound'[\s\S]*?'bound'[\s\S]*?'disposed'/,
  'types should define DebugPanelLiveBindingState for runtime controller bindings',
);

assert.match(
  typesSource,
  /export type DebugPanelRuntimeState\s*=[\s\S]*?'unmounted'[\s\S]*?'mounted'[\s\S]*?'active'/,
  'types should define DebugPanelRuntimeState for UI/input ownership',
);

assert.match(
  typesSource,
  /export type DebugPanelInstanceState\s*=[\s\S]*?'registered'[\s\S]*?'collapsed'[\s\S]*?'expanded'[\s\S]*?'suspended'[\s\S]*?'disposed'/,
  'types should define DebugPanelInstanceState for panel DOM states',
);

assert.doesNotMatch(typesSource, /AbilitySpec|AbilityContext|PreviewRule|PreviewPhase/, 'framework types should not expose legacy ability/preview APIs');

assert.match(
  typesSource,
  /type ParamType = [\s\S]*?'action'/,
  'ParamType should support explicit action controls',
);

assert.match(
  typesSource,
  /runtimePath\?: string/,
  'ParamDSL should support explicit runtimePath live bindings',
);

assert.match(
  typesSource,
  /action\?: string/,
  'ParamDSL should support explicit runtime actions',
);

assert.match(
  typesSource,
  /readonly instanceState: DebugPanelInstanceState/,
  'IDebugPanel should expose its instanceState',
);

assert.match(
  typesSource,
  /readonly controller\?: string/,
  'IDebugPanel should expose its runtime controller id',
);

assert.match(
  frameworkSource,
  /private sessionState: DebugPanelSessionState = 'created'/,
  'DebugPanelFramework should track session lifecycle state',
);

assert.match(
  frameworkSource,
  /private runtimeState: DebugPanelRuntimeState = 'unmounted'/,
  'DebugPanelFramework should track runtime lifecycle state',
);

assert.match(
  frameworkSource,
  /export function createDebugPanelFramework\(\): DebugPanelFramework/,
  'framework module should expose a factory for independent framework instances',
);

assert.doesNotMatch(frameworkSource, /CapabilityRegistry|loadAbilitiesFromDir|registerAbility/, 'framework should not load or register legacy ability modules');

assert.doesNotMatch(
  frameworkSource,
  /createDebugPanelFramework\(\);\s*$/,
  'framework module should not create a hidden singleton at import time',
);

for (const method of ['markInitializing', 'markReady', 'activate', 'deactivate', 'unmount', 'dispose']) {
  assert.match(
    frameworkSource,
    new RegExp(`${method}\\(`),
    `DebugPanelFramework should expose ${method} lifecycle method`,
  );
}

assert.match(
  frameworkSource,
  /markFailed\(\): void/,
  'DebugPanelFramework should expose markFailed for init failures',
);

assert.match(
  frameworkSource,
  /setGetGame\(fn: \(\) => unknown\): void/,
  'DebugPanelFramework should accept a session-owned getGame provider',
);

assert.match(
  frameworkSource,
  /if \(panel\.persistence !== 'config'\) continue/,
  'save and dirty tracking should skip runtime/non-persistent panels',
);

assert.match(
  frameworkSource,
  /private liveBindingRegistry: LiveBindingRegistry/,
  'DebugPanelFramework should own a LiveBindingRegistry',
);

assert.match(
  frameworkSource,
  /this\.liveBindingRegistry\.applyPanel\(panel\)/,
  'DebugPanelFramework should live-apply panel values after hydration',
);

assert.match(
  frameworkSource,
  /this\.liveBindingRegistry\.invokeAction\(livePanel, key, value\)/,
  'DebugPanelFramework should route action controls to the live binding registry',
);

assert.match(
  liveBindingRegistrySource,
  /export class LiveBindingRegistry/,
  'LiveBindingRegistry should exist as the fourth lifecycle/data-flow layer',
);

assert.match(
  liveBindingRegistrySource,
  /applyLivePatch/,
  'LiveBindingRegistry should apply patches through runtime controllers',
);

assert.match(
  frameworkSource,
  /if \(this\.runtimeState !== 'unmounted'\) return/,
  'mount should be idempotent and skip duplicate root creation',
);

assert.match(
  frameworkSource,
  /if \(this\.runtimeState === 'active'\)[\s\S]*?this\.deactivate\(\)/,
  'unmount should deactivate input before removing DOM',
);

assert.match(
  panelRegistrySource,
  /disposeAll\(\): void/,
  'PanelRegistry should dispose panel instances separately from DOM unmounting',
);

assert.deepEqual(abilityFiles, [], 'debug panel framework should not use legacy .ability.ts modules');

// Generated panels are the highest-risk place for lifecycle drift because they
// own DOM nodes, control maps, and value snapshots at the same time.
assert.match(
  codeGeneratorSource,
  /let _instanceState: DebugPanelInstanceState = 'registered'/,
  'generated panels should start in registered instance state',
);

assert.match(
  codeGeneratorSource,
  /get instanceState\(\): DebugPanelInstanceState/,
  'generated panels should expose instanceState getter',
);

assert.match(
  sessionSource,
  /export class DebugPanelSession/,
  'framework-session should export DebugPanelSession',
);

assert.match(
  sessionSource,
  /framework: DebugPanelFramework;/,
  'DebugPanelSessionOptions should require an owned framework instance',
);

assert.doesNotMatch(
  sessionSource,
  /debugPanelFramework/,
  'DebugPanelSession should not fall back to the global active framework singleton',
);

assert.doesNotMatch(
  sessionSource,
  /abilityModules|loadAbilitiesFromDir/,
  'DebugPanelSession should initialize panels directly without an ability module phase',
);

assert.match(
  sessionSource,
  /private initPromise: Promise<void> \| null = null/,
  'DebugPanelSession init should be guarded against duplicate calls',
);

assert.match(
  sessionSource,
  /this\.framework\.markInitializing\(\)/,
  'DebugPanelSession should move framework to initializing during init',
);

assert.match(
  sessionSource,
  /this\.framework\.markReady\(\)/,
  'DebugPanelSession should move framework to ready after loading panels',
);

assert.match(
  sessionSource,
  /this\.framework\.setGetGame\(this\.getGame\)/,
  'DebugPanelSession should inject its getGame provider into the framework',
);

assert.match(
  sessionSource,
  /this\.framework\.markFailed\(\)/,
  'DebugPanelSession should mark the framework failed when init throws',
);

assert.match(
  sessionSource,
  /onDisposeObservable/,
  'DebugPanelSession should bind to the host scene dispose lifecycle',
);

assert.match(
  sessionSource,
  /this\.hostDisposeObserver = observable\.addOnce\(\(\) => this\.dispose\(\)\)/,
  'DebugPanelSession should retain addOnce observers so manual dispose can unbind host lifecycle listeners',
);

assert.match(
  configSource,
  /export function createDebugPanelSession/,
  'framework-config should export an explicit session factory',
);

assert.match(
  configSource,
  /const framework = createDebugPanelFramework\(\)/,
  'createDebugPanelSession should allocate a fresh framework instance per session',
);

assert.match(
  configSource,
  /framework: framework,/,
  'createDebugPanelSession should pass its owned framework into DebugPanelSession',
);

assert.doesNotMatch(
  configSource,
  /abilityModules|\.ability\.ts/,
  'framework-config should not glob legacy ability modules',
);

assert.doesNotMatch(
  configSource,
  /\ninit\(\);\s*$/,
  'framework-config should not auto-start from a top-level init() call',
);

assert.match(
  mainSource,
  /let debugPanelSession[\s\S]*DebugPanelSession/,
  'main should hold the debug panel session',
);

assert.match(
  mainSource,
  /createDebugPanelSession/,
  'main should create the debug panel session explicitly',
);

assert.match(
  mainSource,
  /debugPanelSession\?\.dispose\(\)/,
  'main cleanup should dispose the debug panel session',
);

console.log('debug panel lifecycle checks passed');
