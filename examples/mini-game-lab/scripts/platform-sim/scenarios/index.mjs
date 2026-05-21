export const scenarios = [
  {
    name: 'asset-drop-save-commit',
    description: '黄金链路：注册资产、导入场景、导出、写 scene.json、commit。',
    module: () => import('./asset-drop-save-commit.mjs'),
  },
  {
    name: 'asset-duplicate',
    description: '导入资产后复制选中节点，并校验复制节点写入 scene.json。',
    module: () => import('./asset-duplicate.mjs'),
  },
  {
    name: 'asset-remove',
    description: '导入资产后删除节点，并校验 scene.json 中移除 authored node。',
    module: () => import('./asset-remove.mjs'),
  },
  {
    name: 'asset-unregister',
    description: '导入并删除资产节点后，执行项目侧资产卸载计划并校验 generated registry/manifest 清理。',
    module: () => import('./asset-unregister.mjs'),
  },
  {
    name: 'asset-unregister-in-use',
    description: '资产仍被 authored scene 引用时，卸载计划必须拒绝并返回 asset_still_referenced。',
    module: () => import('./asset-unregister-in-use.mjs'),
  },
  {
    name: 'asset-undo-redo',
    description: '导入资产后执行 undo/redo，并校验 authored scene 回滚与恢复。',
    module: () => import('./asset-undo-redo.mjs'),
  },
  {
    name: 'scene-node-create-patch',
    description: '创建 group/transform/light/groundDecal 等非 GLB authored node，并通过字段 schema patch 常见属性。',
    module: () => import('./scene-node-create-patch.mjs'),
  },
  {
    name: 'scene-node-negative',
    description: '校验 scene node API 对非法 kind、parent cycle、非法 patch、missing node 等坏输入返回稳定错误码。',
    module: () => import('./scene-node-negative.mjs'),
  },
];

export function listScenarioNames() {
  return scenarios.map((scenario) => scenario.name);
}

export function getScenario(name) {
  return scenarios.find((scenario) => scenario.name === name) ?? null;
}
