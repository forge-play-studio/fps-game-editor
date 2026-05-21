import assert from 'node:assert/strict';
import { parsePanelDSLJSON, validatePanelDSL, loadPanelsFromJSONModules } from '../src/debug/framework/PanelDSLLoader.ts';

const validPanel = {
  id: 'panel-ok',
  title: 'Panel OK',
  configFile: 'panel-framework.json',
  persistence: 'config',
  category: 'VFX',
  params: [
    {
      key: 'amount',
      label: 'Amount',
      type: 'number',
      configPaths: ['foo.amount'],
      runtimePath: 'foo.amount',
      default: 1,
      range: [0, 5],
      step: 0.1,
    },
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      configPaths: ['foo.mode'],
      default: 'soft',
      options: [
        { label: 'Soft', value: 'soft' },
        { label: 'Sharp', value: 'sharp' },
      ],
    },
    {
      key: 'curve',
      label: 'Curve',
      type: 'curve',
      configPaths: ['foo.curve'],
      default: [[0, 0], [1, 1]],
      curveMaxPoints: 4,
    },
    {
      key: 'textureUrl',
      label: 'Texture',
      type: 'texture',
      group: 'Media',
      configPaths: ['foo.textureUrl'],
      default: '/foo.png',
    },
    {
      key: 'offset',
      label: 'Offset',
      type: 'vector3',
      group: 'Transform',
      configPaths: ['foo.offset.x', 'foo.offset.y', 'foo.offset.z'],
      default: [0, 1, 2],
      range: [-5, 5],
      step: 0.01,
    },
    {
      key: 'action.play',
      label: 'Play',
      type: 'action',
      configPaths: [],
      default: 0,
      action: 'playSomething',
      actionArgs: { amount: '$values.amount' },
    },
  ],
};

assert.equal(validatePanelDSL(validPanel, 'inline-valid').id, 'panel-ok');
assert.equal(validatePanelDSL(validPanel, 'inline-valid').persistence, 'config');
assert.equal(parsePanelDSLJSON(JSON.stringify(validPanel), 'inline-json').title, 'Panel OK');

await assert.doesNotReject(async () => {
  const panels = await loadPanelsFromJSONModules({
    'foo.panel.json': JSON.stringify(validPanel),
    'bar.panel.json': { default: JSON.stringify({ ...validPanel, id: 'panel-two', title: 'Panel Two' }) },
  });
  assert.equal(panels.length, 2);
  assert.equal(panels[1]?.id, 'panel-two');
});

assert.throws(
  () => validatePanelDSL({ ...validPanel, persistence: 'forever' }, 'bad-persistence'),
  /field: persistence/,
  'panel persistence should reject unknown modes',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    preview: [{ when: 'amount', use: 'applySomething', args: {} }],
  }, 'deprecated-preview'),
  /field: preview[\s\S]*deprecated/,
  'panel preview rules should be rejected in favor of runtime controllers',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], runtimePath: '' }],
  }, 'bad-runtime-path'),
  /params\[0\]\.runtimePath/,
  'runtimePath should reject empty strings',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[5], action: '' }],
  }, 'bad-action'),
  /params\[0\]\.action/,
  'action params should require an action name',
);

assert.throws(
  () => validatePanelDSL({ ...validPanel, params: [{ ...validPanel.params[0], type: 'number', range: [5, 1] }] }, 'bad-range'),
  /params\[0\]\.range[\s\S]*min <= max/,
  'number range should reject inverted values',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], key: 'curve', type: 'curve', default: [0, 1] }],
  }, 'bad-curve'),
  /params\[0\]\.default[\s\S]*array of \[x, y\] points/,
  'curve default should require point arrays',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], key: 'textureUrl', type: 'texture', default: 123 }],
  }, 'bad-texture'),
  /params\[0\]\.default[\s\S]*must be a string/,
  'texture default should require string values',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{
      ...validPanel.params[1],
      default: 'missing',
    }],
  }, 'bad-select-default'),
  /params\[0\]\.default[\s\S]*must match one of options\[\*\]\.value/,
  'select default should match an option value',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], key: 'enabled', type: 'boolean', default: 'yes' }],
  }, 'bad-boolean'),
  /params\[0\]\.default[\s\S]*must be a boolean/,
  'boolean default should require boolean values',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], key: 'tint', type: 'color', default: [1.2, 0.5, 0.5] }],
  }, 'bad-color'),
  /params\[0\]\.default[\s\S]*0\.\.1 numbers/,
  'color default should require normalized rgb arrays',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], key: 'note', type: 'string', default: false }],
  }, 'bad-string'),
  /params\[0\]\.default[\s\S]*must be a string/,
  'string default should require string values',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[4], configPaths: ['foo.offset.x'], default: [0, 1, 2] }],
  }, 'bad-vector3-paths'),
  /params\[0\]\.configPaths[\s\S]*must include three paths/,
  'vector3 params should require three config paths',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[4], default: [0, '1', 2] }],
  }, 'bad-vector3-default'),
  /params\[0\]\.default[\s\S]*must be \[x, y, z\]/,
  'vector3 default should require numeric xyz values',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{ ...validPanel.params[0], group: '' }],
  }, 'bad-param-group'),
  /params\[0\]\.group[\s\S]*non-empty string/,
  'param group should reject empty labels',
);

assert.throws(
  () => validatePanelDSL({
    ...validPanel,
    params: [{
      ...validPanel.params[1],
      options: [{ label: '', value: 'soft' }],
    }],
  }, 'bad-select-option'),
  /params\[0\]\.options\[0\][\s\S]*non-empty string label and value/,
  'select options should validate each option shape',
);

assert.throws(
  () => parsePanelDSLJSON('{"id":', 'broken-json.panel.json'),
  /Failed to parse JSON panel file: broken-json\.panel\.json/,
  'broken JSON should surface file-aware parse errors',
);

await assert.rejects(
  () => loadPanelsFromJSONModules({ 'broken-module.panel.json': { default: 123 } }),
  /JSON module must resolve to a raw string/,
  'module entries should reject non-string default payloads',
);

console.log('panel DSL loader checks passed');
