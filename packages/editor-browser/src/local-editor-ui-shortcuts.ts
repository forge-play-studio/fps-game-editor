import { createButton } from './local-editor-ui-shared';

export function createShortcutHelpPanel(doc: Document): HTMLDivElement {
  const panel = doc.createElement('div');
  panel.dataset.editorShortcutHelp = 'true';
  panel.dataset.editorWorkbenchRegion = 'modal';
  panel.style.cssText = [
    'position:fixed',
    'top:104px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:2147483638',
    'display:none',
    'width:min(620px,calc(100vw - 64px))',
    'max-height:calc(100vh - 132px)',
    'overflow:auto',
    'padding:14px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-modal)',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'pointer-events:auto',
  ].join(';');

  const header = doc.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';
  const title = doc.createElement('h2');
  title.textContent = '编辑器快捷键与操作说明';
  title.style.cssText = 'font-size:13px;margin:0;font-weight:900;color:var(--fps-editor-text-strong)';
  const closeButton = createButton(doc, '关闭');
  closeButton.dataset.editorShortcutHelpClose = 'true';
  header.appendChild(title);
  header.appendChild(closeButton);
  panel.appendChild(header);

  appendShortcutSection(doc, panel, '工具', [
    ['Q', '切换到选择工具'],
    ['W', '切换到移动工具'],
    ['E', '切换到旋转工具'],
    ['R', '切换到缩放工具'],
    ['世界 / 本地', '在 Scene View 工具条切换 Transform 坐标空间'],
    ['移动手柄', '轴向箭头、平面方块和中心自由手柄同时可用'],
    ['吸附', '在 Scene View 工具条切换移动、旋转、缩放步进吸附'],
    ['放置', '在 Scene View 工具条切换关闭、XZ 地面或场景表面放置'],
    ['对齐 / 分布', '多选后从 Scene View 工具条执行位置对齐或分布'],
  ]);
  appendShortcutSection(doc, panel, '视图', [
    ['F', '聚焦当前选中的 GameObject'],
    ['Esc', '取消当前 Gizmo 拖拽或活动操作'],
  ]);
  appendShortcutSection(doc, panel, '鼠标操作', [
    ['左键', '选择对象；在空白区域拖拽可以框选'],
    ['Shift + 左键', '追加选择对象'],
    ['Cmd/Ctrl + 左键', '切换对象的选中状态'],
    ['双击', '选择并聚焦对象'],
    ['滚轮', '推进/拉远摄像机；右键飞行模式下调整飞行速度'],
    ['中键拖拽', '平移 Scene View'],
    ['Alt + 左键拖拽', '环绕 Scene View'],
    ['Alt + 中键拖拽', '平移 Scene View'],
    ['Alt + 右键拖拽', '推进/拉远 Scene View'],
    ['右键拖拽', '进入飞行视角；按住右键时使用 WASD/QE 移动'],
  ]);
  appendShortcutSection(doc, panel, '选择', [
    ['Shift + 点击/拖拽', '把对象加入当前选择'],
    ['Cmd/Ctrl + 点击/拖拽', '切换对象是否选中'],
    ['双击', '聚焦被点击的 GameObject'],
    ['层级树点击', '从 Hierarchy 中选择 GameObject'],
    ['层级树 Shift/Cmd', '在 Hierarchy 中追加或切换选择'],
    ['右键层级节点', '打开 GameObject 操作菜单'],
  ]);
  appendShortcutSection(doc, panel, '文档', [
    ['Cmd/Ctrl + S', '保存场景'],
    ['Cmd/Ctrl + Z', '撤销'],
    ['Cmd/Ctrl + Shift + Z', '重做'],
    ['Ctrl + Y', '重做'],
    ['Cmd/Ctrl + C', '复制当前选中的 Hierarchy 节点'],
    ['Cmd/Ctrl + V', '粘贴并复制此前复制的 Hierarchy 节点'],
    ['Cmd/Ctrl + D', '复制当前选中的 Hierarchy 节点'],
    ['Delete / Backspace', '删除当前选中的 GameObject'],
    ['保存场景', '保存 editor-scene，并编译运行时 scene 数据'],
  ]);
  appendShortcutSection(doc, panel, '面板', [
    ['Assets 标签', '搜索项目资产，点击资产创建 GameObject'],
    ['History 标签', '查看来自 EditorSession 的文档操作历史'],
    ['Inspector 输入框', '通过序列化属性编辑选中对象的 Transform 数值'],
    ['多选 Inspector', '批量编辑所有选中 GameObject 的共享 Transform 数值'],
  ]);
  return panel;
}

function appendShortcutSection(
  doc: Document,
  parent: HTMLElement,
  title: string,
  rows: Array<[string, string]>,
): void {
  const section = doc.createElement('section');
  section.style.cssText = 'margin:0 0 12px';
  const heading = doc.createElement('h3');
  heading.textContent = title;
  heading.style.cssText = 'font-size:12px;margin:0 0 7px;font-weight:900;color:var(--fps-editor-text)';
  section.appendChild(heading);
  const list = doc.createElement('div');
  list.style.cssText = 'display:grid;grid-template-columns:130px 1fr;gap:6px 10px;align-items:center';
  for (const [keys, action] of rows) {
    const key = doc.createElement('div');
    key.textContent = keys;
    key.style.cssText = [
      'min-height:24px',
      'display:flex',
      'align-items:center',
      'padding:0 7px',
      'border:1px solid var(--fps-editor-border)',
      'border-radius:3px',
      'background:var(--fps-editor-field)',
      'color:var(--fps-editor-text-strong)',
      'font-weight:900',
      'white-space:nowrap',
    ].join(';');
    const value = doc.createElement('div');
    value.textContent = action;
    value.style.cssText = 'color:var(--fps-editor-muted);line-height:1.35';
    list.appendChild(key);
    list.appendChild(value);
  }
  section.appendChild(list);
  parent.appendChild(section);
}
