import type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserHistoryEntry,
  LocalEditorBrowserHistoryView,
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserSerializedMultiObject,
  LocalEditorBrowserSerializedObject,
  LocalEditorBrowserSerializedProperty,
  LocalEditorBrowserUiState,
  LocalEditorWorkbenchPanelDescriptor,
} from './local-editor-ui-types';
import {
  createAssetList,
  createDockTab,
  createPanelHeader,
  createPropertyRow,
  createToolbarButton,
  createTreeView,
  createTreeViewItem,
} from './local-editor-ui-primitives';
import { clearElement, toTitle } from './local-editor-ui-shared';

export function renderHierarchyPanel<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
  rename: { id: string; value: string } | null,
  drop: LocalEditorBrowserSceneGraphDropIntent | null,
): void {
  clearElement(panel);
  const createGroupButton = createToolbarButton(doc, '+ Group');
  createGroupButton.dataset.editorHierarchyCreateGroup = 'true';
  createGroupButton.style.padding = '3px 7px';
  createGroupButton.style.fontSize = '11px';
  panel.appendChild(createPanelHeader(doc, 'Graph', [createGroupButton]));

  const list = createTreeView(doc);
  for (const item of state.hierarchy) {
    const isRenaming = rename?.id === item.id;
    const selected = state.selectedIds.includes(item.id);
    const active = state.activeId === item.id;
    const dropPlacement = drop?.targetId === item.id ? drop.placement : null;
    const button = createTreeViewItem(doc, {
      id: item.id,
      label: item.label,
      depth: item.depth,
      selected,
      active,
      locked: item.locked,
      selectable: item.selectable,
      draggable: item.draggable,
      dropPlacement,
    });
    if (isRenaming) {
      const input = doc.createElement('input');
      input.dataset.editorHierarchyRenameInput = item.id;
      input.value = rename.value;
      input.style.cssText = [
        'width:100%',
        'height:22px',
        'box-sizing:border-box',
        'border:1px solid var(--fps-editor-accent-strong)',
        'border-radius:2px',
        'background:var(--fps-editor-field)',
        'color:#fff',
        'font-size:12px',
        'font-weight:700',
        'padding:2px 5px',
        'outline:none',
      ].join(';');
      button.appendChild(input);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    } else {
      button.textContent = item.locked ? `${item.label}  [locked]` : item.label;
    }
    list.appendChild(button);
  }
  panel.appendChild(list);
}

export function renderBottomDockPanel<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
  activeTab: LocalEditorBottomDockTab,
): void {
  clearElement(panel);
  appendDockTabs(doc, panel, activeTab);
  if (activeTab === 'history') renderHistoryPanel(doc, panel, state.session?.history ?? null);
  else renderAssetBrowserContent(doc, panel, state);
}

export function renderWorkbenchBottomDockPanel<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
  activeTab: LocalEditorBottomDockTab,
  panels: LocalEditorWorkbenchPanelDescriptor[] = [],
): void {
  clearElement(panel);
  const tabHeader = doc.createElement('div');
  tabHeader.style.cssText = [
    'height:29px',
    'display:flex',
    'align-items:stretch',
    'border-bottom:1px solid var(--fps-editor-divider)',
    'background:var(--fps-editor-chrome-dark)',
    'flex:0 0 auto',
  ].join(';');
  const dockTabs = panels.length > 0
    ? panels.filter((panelDescriptor): panelDescriptor is LocalEditorWorkbenchPanelDescriptor & { id: LocalEditorBottomDockTab } => (
        panelDescriptor.id === 'assets' || panelDescriptor.id === 'history'
      ))
    : [
        { id: 'assets', title: '资产', area: 'bottom' },
        { id: 'history', title: '历史', area: 'bottom' },
      ] satisfies Array<LocalEditorWorkbenchPanelDescriptor & { id: LocalEditorBottomDockTab }>;
  for (const tabPanel of dockTabs) {
    const button = createDockTab(doc, tabPanel.title, activeTab === tabPanel.id);
    button.dataset.editorDockTab = tabPanel.id;
    tabHeader.appendChild(button);
  }
  panel.appendChild(tabHeader);
  const content = doc.createElement('div');
  content.style.cssText = 'flex:1;min-height:0;overflow:auto;padding:8px';
  panel.appendChild(content);
  if (activeTab === 'history') renderHistoryPanel(doc, content, state.session?.history ?? null);
  else renderAssetBrowserContent(doc, content, state, 'grid');
}

function appendDockTabs(
  doc: Document,
  panel: HTMLElement,
  activeTab: LocalEditorBottomDockTab,
): void {
  const tabs = doc.createElement('div');
  tabs.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'margin:0 0 10px',
    'border-bottom:1px solid var(--fps-editor-border-soft)',
  ].join(';');
  const labels: Record<LocalEditorBottomDockTab, string> = {
    assets: '资产',
    history: '历史',
  };
  for (const tab of ['assets', 'history'] as const) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.editorDockTab = tab;
    button.textContent = labels[tab];
    const active = activeTab === tab;
    button.style.cssText = [
      'border:0',
      'border-bottom:2px solid transparent',
      `border-bottom-color:${active ? '#58a6ff' : 'transparent'}`,
      'background:transparent',
      `color:${active ? 'var(--fps-editor-text-strong)' : 'var(--fps-editor-muted)'}`,
      'font-size:12px',
      'font-weight:900',
      'padding:0 8px 8px',
      'cursor:pointer',
    ].join(';');
    tabs.appendChild(button);
  }
  panel.appendChild(tabs);
}

function renderAssetBrowserContent<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
  variant: 'list' | 'grid' = 'list',
): void {
  const title = doc.createElement('h2');
  title.textContent = '资产浏览器';
  title.style.cssText = 'font-size:13px;margin:0 0 8px;font-weight:800;color:var(--fps-editor-text-strong)';
  panel.appendChild(title);

  const filter = doc.createElement('input');
  filter.type = 'search';
  filter.placeholder = '筛选资产';
  filter.value = state.assetFilter;
  filter.dataset.editorAssetFilter = 'true';
  filter.style.cssText = [
    'width:100%',
    'height:28px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-field)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'padding:0 8px',
    'margin:0 0 8px',
  ].join(';');
  panel.appendChild(filter);

  const normalizedFilter = state.assetFilter.trim().toLowerCase();
  const filteredAssets = state.assets
    .filter((asset) => {
      if (!normalizedFilter) return true;
      return [asset.id, asset.label, asset.meta ?? '']
        .some(value => value.toLowerCase().includes(normalizedFilter));
    })
    .slice(0, 80);

  const count = doc.createElement('div');
  count.textContent = state.assetCountLabel
    ? `${filteredAssets.length} / ${state.assetCountLabel}`
    : `${filteredAssets.length} / ${state.assets.length} 个资产`;
  count.style.cssText = 'color:var(--fps-editor-muted);font-size:11px;margin-bottom:6px';
  panel.appendChild(count);

  const list = createAssetList(doc, variant === 'grid');
  for (const asset of filteredAssets) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.editorAssetId = asset.id;
    button.disabled = asset.disabled ?? false;
    button.style.cssText = [
      'width:100%',
      `min-height:${variant === 'grid' ? '48px' : '32px'}`,
      'text-align:left',
      'padding:6px 8px',
      'border:1px solid var(--fps-editor-border)',
      'border-radius:3px',
      'background:#243426',
      'color:var(--fps-editor-text)',
      'font-size:12px',
      'cursor:pointer',
    ].join(';');

    const label = doc.createElement('div');
    label.textContent = asset.label;
    label.style.cssText = 'font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const meta = doc.createElement('div');
    meta.textContent = asset.meta ?? asset.id;
    meta.style.cssText = 'color:var(--fps-editor-muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    button.appendChild(label);
    button.appendChild(meta);
    list.appendChild(button);
  }
  panel.appendChild(list);
}

function renderHistoryPanel(
  doc: Document,
  panel: HTMLElement,
  history: LocalEditorBrowserHistoryView | null,
): void {
  const title = doc.createElement('h2');
  const entries = history?.entries ?? [];
  title.textContent = `历史记录 (${entries.length})`;
  title.style.cssText = 'font-size:13px;margin:0 0 8px;font-weight:800;color:var(--fps-editor-text-strong)';
  panel.appendChild(title);
  appendHistoryEntries(doc, panel, entries);
}

function appendHistoryEntries(
  doc: Document,
  panel: HTMLElement,
  entries: LocalEditorBrowserHistoryEntry[],
): void {
  if (entries.length === 0) {
    const empty = doc.createElement('div');
    empty.textContent = '暂无文档修改。';
    empty.style.cssText = [
      'padding:8px',
      'border:1px solid var(--fps-editor-border-soft)',
      'border-radius:3px',
      'background:var(--fps-editor-field)',
      'color:var(--fps-editor-muted)',
      'font-size:11px',
    ].join(';');
    panel.appendChild(empty);
    return;
  }
  const list = doc.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  for (const entry of entries) {
    const item = doc.createElement('div');
    item.style.cssText = [
      'padding:7px 8px',
      'border:1px solid var(--fps-editor-border-soft)',
      'border-radius:3px',
      'background:var(--fps-editor-panel-soft)',
    ].join(';');
    const label = doc.createElement('div');
    label.textContent = entry.label;
    label.style.cssText = 'font-size:12px;font-weight:900;color:var(--fps-editor-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const meta = doc.createElement('div');
    meta.textContent = `${formatHistoryTimestamp(entry.createdAt)} · ${entry.commandType}`;
    meta.style.cssText = 'font-size:11px;color:var(--fps-editor-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    item.appendChild(label);
    item.appendChild(meta);
    list.appendChild(item);
  }
  panel.appendChild(list);
}

function formatHistoryTimestamp(createdAt: number): string {
  if (!Number.isFinite(createdAt)) return '';
  const date = new Date(createdAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds()),
  ].join('');
}

export function renderInspectorPanel<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
): void {
  clearElement(panel);
  const title = doc.createElement('h2');
  title.textContent = 'Inspector';
  title.style.cssText = 'font-size:13px;margin:-8px -8px 8px;padding:7px 8px;border-bottom:1px solid var(--fps-editor-divider);background:var(--fps-editor-chrome-dark);font-weight:800;color:var(--fps-editor-text-strong)';
  panel.appendChild(title);

  const selectionCount = state.selectionSummary?.count ?? state.selectedIds.length;
  if (selectionCount > 1) {
    appendMultiSelectionInspector(doc, panel, state);
    return;
  }

  const serializedObject = state.serializedObject;
  if (!serializedObject) {
    const empty = doc.createElement('div');
    empty.textContent = '请从层级树或 Scene View 中选择一个 GameObject。';
    empty.style.cssText = 'color:var(--fps-editor-muted);line-height:1.45';
    panel.appendChild(empty);
    return;
  }

  appendGameObjectHeader(doc, panel, serializedObject);
  const sections = groupSerializedProperties(
    serializedObject.properties.filter(property => !property.path.startsWith('gameObject.')),
  );
  for (const section of sections) {
    const block = createInspectorComponentBlock(doc);
    const sectionTitle = doc.createElement('h3');
    sectionTitle.textContent = section.title;
    sectionTitle.style.cssText = 'font-size:12px;margin:0 0 8px;font-weight:900;color:var(--fps-editor-text-strong)';
    block.appendChild(sectionTitle);
    for (const group of section.groups) {
      if (group.kind === 'vec3') appendSerializedVec3Inputs(doc, block, serializedObject, group.label, group.properties);
      else appendSerializedPropertyRow(doc, block, serializedObject, group.property);
    }
    panel.appendChild(block);
  }
}

function appendMultiSelectionInspector<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
): void {
  const block = createInspectorComponentBlock(doc);
  const title = doc.createElement('h3');
  title.textContent = '多选';
  title.style.cssText = 'font-size:12px;margin:0 0 8px;font-weight:900;color:var(--fps-editor-text-strong)';
  block.appendChild(title);
  appendReadOnlyRow(doc, block, '已选', String(state.selectionSummary?.count ?? state.selectedIds.length));
  appendReadOnlyRow(doc, block, '活动对象', state.selectionSummary?.activeId ?? state.activeId ?? '无');
  panel.appendChild(block);

  const serializedMultiObject = state.serializedMultiObject;
  if (!serializedMultiObject) return;
  const sections = groupSerializedProperties(
    serializedMultiObject.properties.filter(property => property.path.startsWith('transform.')),
  );
  for (const section of sections) {
    const sectionBlock = createInspectorComponentBlock(doc);
    const sectionTitle = doc.createElement('h3');
    sectionTitle.textContent = section.title;
    sectionTitle.style.cssText = 'font-size:12px;margin:0 0 8px;font-weight:900;color:var(--fps-editor-text-strong)';
    sectionBlock.appendChild(sectionTitle);
    for (const group of section.groups) {
      if (group.kind === 'vec3') appendSerializedVec3Inputs(doc, sectionBlock, serializedMultiObject, group.label, group.properties);
      else appendSerializedPropertyRow(doc, sectionBlock, serializedMultiObject, group.property);
    }
    panel.appendChild(sectionBlock);
  }
}

function appendGameObjectHeader<TDocument>(
  doc: Document,
  panel: HTMLElement,
  serializedObject: LocalEditorBrowserSerializedObject<TDocument>,
): void {
  const block = createInspectorComponentBlock(doc);
  const title = doc.createElement('h3');
  title.textContent = 'GameObject';
  title.style.cssText = 'font-size:12px;margin:0 0 8px;font-weight:900;color:var(--fps-editor-text-strong)';
  block.appendChild(title);

  const nameProperty = serializedObject.properties.find(property => property.path === 'gameObject.name');
  const idProperty = serializedObject.properties.find(property => property.path === 'gameObject.id');
  appendReadOnlyRow(doc, block, '名称', String(nameProperty?.value ?? serializedObject.label ?? serializedObject.targetId));
  appendReadOnlyRow(doc, block, 'ID', String(idProperty?.value ?? serializedObject.targetId));
  panel.appendChild(block);
}

function createInspectorComponentBlock(doc: Document): HTMLDivElement {
  const block = doc.createElement('div');
  block.style.cssText = [
    'margin:0 0 8px',
    'padding:9px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel-soft)',
  ].join(';');
  return block;
}

type SerializedPropertyGroup<TDocument> =
  | { kind: 'property'; property: LocalEditorBrowserSerializedProperty<TDocument> }
  | { kind: 'vec3'; label: string; properties: LocalEditorBrowserSerializedProperty<TDocument>[] };

function groupSerializedProperties<TDocument>(
  properties: LocalEditorBrowserSerializedProperty<TDocument>[],
): Array<{ title: string; groups: SerializedPropertyGroup<TDocument>[] }> {
  const bySection = new Map<string, LocalEditorBrowserSerializedProperty<TDocument>[]>();
  for (const property of properties) {
    const sectionName = toTitle(property.path.split('.')[0] ?? 'Properties');
    const entries = bySection.get(sectionName) ?? [];
    entries.push(property);
    bySection.set(sectionName, entries);
  }
  return [...bySection.entries()].map(([title, entries]) => ({
    title,
    groups: groupVectorProperties(entries),
  }));
}

function groupVectorProperties<TDocument>(
  properties: LocalEditorBrowserSerializedProperty<TDocument>[],
): SerializedPropertyGroup<TDocument>[] {
  const groups: SerializedPropertyGroup<TDocument>[] = [];
  const consumed = new Set<string>();
  for (const property of properties) {
    if (consumed.has(property.path)) continue;
    const match = property.path.match(/^(.*)\.(x|y|z)$/);
    if (!match || property.valueType !== 'number') {
      groups.push({ kind: 'property', property });
      consumed.add(property.path);
      continue;
    }
    const basePath = match[1]!;
    const vector = ['x', 'y', 'z']
      .map(axis => properties.find(candidate => candidate.path === `${basePath}.${axis}` && candidate.valueType === 'number'))
      .filter((candidate): candidate is LocalEditorBrowserSerializedProperty<TDocument> => !!candidate);
    if (vector.length === 3) {
      for (const entry of vector) consumed.add(entry.path);
      const parts = basePath.split('.');
      groups.push({ kind: 'vec3', label: toTitle(parts[parts.length - 1] ?? basePath), properties: vector });
    } else {
      groups.push({ kind: 'property', property });
      consumed.add(property.path);
    }
  }
  return groups;
}

function appendSerializedPropertyRow<TDocument>(
  doc: Document,
  parent: HTMLElement,
  serializedObject: LocalEditorBrowserSerializedObject<TDocument> | LocalEditorBrowserSerializedMultiObject<TDocument>,
  property: LocalEditorBrowserSerializedProperty<TDocument>,
): void {
  if (property.readOnly || property.valueType !== 'number') {
    appendReadOnlyRow(doc, parent, property.label, String(property.value ?? ''));
    return;
  }
  const input = createPropertyInput(doc, serializedObject, property);
  parent.appendChild(createPropertyRow(doc, property.label, input));
}

function appendSerializedVec3Inputs<TDocument>(
  doc: Document,
  parent: HTMLElement,
  serializedObject: LocalEditorBrowserSerializedObject<TDocument> | LocalEditorBrowserSerializedMultiObject<TDocument>,
  label: string,
  properties: LocalEditorBrowserSerializedProperty<TDocument>[],
): void {
  const wrapper = doc.createElement('div');
  wrapper.style.cssText = 'margin:8px 0';
  const labelElement = doc.createElement('div');
  labelElement.textContent = label;
  labelElement.style.cssText = 'color:var(--fps-editor-muted);font-weight:800;margin-bottom:5px';
  wrapper.appendChild(labelElement);

  const fields = doc.createElement('div');
  fields.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px';
  for (const property of properties) {
    fields.appendChild(createPropertyInput(doc, serializedObject, property));
  }
  wrapper.appendChild(fields);
  parent.appendChild(wrapper);
}

function createPropertyInput<TDocument>(
  doc: Document,
  target: LocalEditorBrowserSerializedObject<TDocument> | LocalEditorBrowserSerializedMultiObject<TDocument>,
  property: LocalEditorBrowserSerializedProperty<TDocument>,
): HTMLInputElement {
  const input = doc.createElement('input');
  input.type = property.valueType === 'number' ? 'number' : 'text';
  if (property.valueType === 'number') input.step = '0.1';
  input.value = property.mixed ? '' : String(property.value);
  input.placeholder = property.mixed ? '--' : '';
  input.dataset.serializedTargetId = 'targetId' in target ? target.targetId : target.activeId ?? target.targetIds[0] ?? '';
  if ('targetIds' in target) input.dataset.serializedTargetIds = target.targetIds.join(',');
  input.dataset.serializedPath = property.path;
  input.title = property.label;
  input.disabled = property.readOnly === true;
  input.style.cssText = [
    'min-width:0',
    'height:28px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-field)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'padding:0 6px',
  ].join(';');
  return input;
}

function appendReadOnlyRow(doc: Document, parent: HTMLElement, label: string, value: string): void {
  const valueElement = doc.createElement('div');
  valueElement.textContent = value;
  valueElement.style.cssText = 'color:var(--fps-editor-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  parent.appendChild(createPropertyRow(doc, label, valueElement));
}
