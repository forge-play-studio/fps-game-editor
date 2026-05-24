import type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserHistoryEntry,
  LocalEditorBrowserHistoryView,
  LocalEditorBrowserInspectorCommitMode,
  LocalEditorBrowserInspectorConflictStrategy,
  LocalEditorBrowserInspectorControlBindingOptions,
  LocalEditorBrowserInspectorControlKind,
  LocalEditorBrowserInspectorControlRegistration,
  LocalEditorBrowserInspectorControlRenderContext,
  LocalEditorBrowserInspectorEffectMode,
  LocalEditorBrowserInspectorObject,
  LocalEditorBrowserInspectorProperty,
  LocalEditorBrowserInspectorSection,
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserSerializedMultiObject,
  LocalEditorBrowserSerializedObject,
  LocalEditorBrowserSerializedProperty,
  LocalEditorBrowserUiState,
  LocalEditorWorkbenchPanelDescriptor,
} from './local-editor-ui-types';
import { createLocalEditorIcon, type LocalEditorIconName } from './local-editor-ui-icons';
import {
  createBadge,
  createAssetList,
  createDockTab,
  createEditorInputStyle,
  createEmptyState,
  createListItemBlock,
  createPanelHeader,
  createPropertyRow,
  createToolbarButton,
  createTreeView,
  createTreeViewItem,
} from './local-editor-ui-primitives';
import { clearElement, toTitle } from './local-editor-ui-shared';

const DOCK_TAB_ICONS: Record<LocalEditorBottomDockTab, LocalEditorIconName> = {
  assets: 'asset',
  history: 'history',
};

export interface LocalEditorBrowserInspectorRenderOptions<TDocument = unknown> {
  controls?: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[];
  controlConflict?: LocalEditorBrowserInspectorConflictStrategy;
}

export function renderHierarchyPanel<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
  rename: { id: string; value: string } | null,
  drop: LocalEditorBrowserSceneGraphDropIntent | null,
): void {
  clearElement(panel);
  const createGroupButton = createToolbarButton(doc, '+ Empty', 'object');
  createGroupButton.dataset.editorHierarchyCreateGroup = 'true';
  createGroupButton.style.padding = '3px 7px';
  createGroupButton.style.fontSize = '11px';
  panel.appendChild(createPanelHeader(doc, 'Graph', [createGroupButton], 'hierarchy'));

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
        'color:var(--fps-editor-text-strong)',
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
    const button = createDockTab(doc, tabPanel.title, activeTab === tabPanel.id, DOCK_TAB_ICONS[tabPanel.id]);
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
    const active = activeTab === tab;
    const button = createDockTab(doc, labels[tab], active, DOCK_TAB_ICONS[tab]);
    button.dataset.editorDockTab = tab;
    button.style.border = '0';
    button.style.borderBottom = `2px solid ${active ? 'var(--fps-editor-accent-strong)' : 'transparent'}`;
    button.style.background = 'transparent';
    button.style.color = active ? 'var(--fps-editor-text-strong)' : 'var(--fps-editor-muted)';
    button.style.padding = '0 8px 8px';
    tabs.appendChild(button);
  }
  panel.appendChild(tabs);
}

function createHeadingLabel(doc: Document, text: string): HTMLSpanElement {
  const label = doc.createElement('span');
  label.textContent = text;
  label.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  return label;
}

function renderAssetBrowserContent<TDocument>(
  doc: Document,
  panel: HTMLElement,
  state: LocalEditorBrowserUiState<TDocument>,
  variant: 'list' | 'grid' = 'list',
): void {
  const title = doc.createElement('h2');
  title.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;margin:0 0 8px;font-weight:800;color:var(--fps-editor-text-strong)';
  title.appendChild(createLocalEditorIcon(doc, 'asset'));
  title.appendChild(createHeadingLabel(doc, '资产浏览器'));
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
      'background:var(--fps-editor-asset-card-bg)',
      'color:var(--fps-editor-text)',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'font-size:12px',
      'cursor:pointer',
    ].join(';');

    const icon = createLocalEditorIcon(doc, 'asset', { size: 16 });
    const body = doc.createElement('div');
    body.style.cssText = 'min-width:0;flex:1';
    const label = doc.createElement('div');
    label.textContent = asset.label;
    label.style.cssText = 'font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const meta = doc.createElement('div');
    meta.textContent = asset.meta ?? asset.id;
    meta.style.cssText = 'color:var(--fps-editor-muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    body.appendChild(label);
    body.appendChild(meta);
    button.appendChild(icon);
    button.appendChild(body);
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
  title.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;margin:0 0 8px;font-weight:800;color:var(--fps-editor-text-strong)';
  title.appendChild(createLocalEditorIcon(doc, 'history'));
  title.appendChild(createHeadingLabel(doc, `历史记录 (${entries.length})`));
  panel.appendChild(title);
  appendHistoryEntries(doc, panel, entries);
}

function appendHistoryEntries(
  doc: Document,
  panel: HTMLElement,
  entries: LocalEditorBrowserHistoryEntry[],
): void {
  if (entries.length === 0) {
    panel.appendChild(createEmptyState(doc, '暂无文档修改。'));
    return;
  }
  const list = doc.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  for (const entry of entries) {
    const item = createListItemBlock(doc);
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
  filter = '',
  options: LocalEditorBrowserInspectorRenderOptions<TDocument> = {},
): void {
  const renderSnapshot = captureInspectorPanelRenderSnapshot(doc, panel);
  clearElement(panel);
  const title = doc.createElement('h2');
  title.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;margin:-8px -8px 8px;padding:7px 8px;border-bottom:1px solid var(--fps-editor-divider);background:var(--fps-editor-chrome-dark);font-weight:800;color:var(--fps-editor-text-strong)';
  title.appendChild(createLocalEditorIcon(doc, 'inspector'));
  title.appendChild(createHeadingLabel(doc, 'Inspector'));
  panel.appendChild(title);

  const search = createInspectorSearchInput(doc, filter);
  panel.appendChild(search);

  const selectionCount = state.selectionSummary?.count ?? state.selectedIds.length;
  const inspectorObject = selectionCount > 1
    ? state.inspectorMultiObject
      ?? (state.serializedMultiObject ? createLegacyInspectorObject(state.serializedMultiObject) : createSelectionSummaryInspectorObject(state))
    : state.inspectorObject ?? (state.serializedObject ? createLegacyInspectorObject(state.serializedObject) : null);
  if (!inspectorObject) {
    const empty = doc.createElement('div');
    empty.textContent = '请从层级树或 Scene View 中选择一个 GameObject。';
    empty.style.cssText = 'color:var(--fps-editor-muted);line-height:1.45';
    panel.appendChild(empty);
    restoreInspectorPanelRenderSnapshot(panel, renderSnapshot);
    return;
  }

  const controlRegistry = createLocalEditorBrowserInspectorControlRegistry(options.controls, options.controlConflict);
  appendInspectorSummary(doc, panel, inspectorObject, selectionCount);
  const visibleSections = filterInspectorSections(
    inspectorObject.sections.filter(section => section.placement !== 'summary'),
    filter,
  );
  if (visibleSections.length === 0) {
    if (!filter.trim() && inspectorObject.sections.length === 0) {
      restoreInspectorPanelRenderSnapshot(panel, renderSnapshot);
      return;
    }
    const empty = doc.createElement('div');
    empty.textContent = '没有匹配的 Inspector 字段。';
    empty.style.cssText = 'color:var(--fps-editor-muted);line-height:1.45';
    panel.appendChild(empty);
    restoreInspectorPanelRenderSnapshot(panel, renderSnapshot);
    return;
  }

  for (const section of visibleSections) {
    panel.appendChild(createInspectorSectionBlock(doc, inspectorObject, section, controlRegistry));
  }
  restoreInspectorPanelRenderSnapshot(panel, renderSnapshot);
}

interface InspectorPanelRenderSnapshot {
  preserveScroll: boolean;
  scrollTop: number;
  scrollLeft: number;
}

function captureInspectorPanelRenderSnapshot(doc: Document, panel: HTMLElement): InspectorPanelRenderSnapshot {
  const activeElement = doc.activeElement;
  const elementConstructor = doc.defaultView?.HTMLElement;
  return {
    preserveScroll: !!activeElement
      && (elementConstructor ? activeElement instanceof elementConstructor : activeElement instanceof HTMLElement)
      && panel.contains(activeElement),
    scrollTop: panel.scrollTop,
    scrollLeft: panel.scrollLeft,
  };
}

function restoreInspectorPanelRenderSnapshot(panel: HTMLElement, snapshot: InspectorPanelRenderSnapshot): void {
  if (!snapshot.preserveScroll) return;
  panel.scrollTop = snapshot.scrollTop;
  panel.scrollLeft = snapshot.scrollLeft;
}

function createInspectorSearchInput(doc: Document, value: string): HTMLInputElement {
  const input = doc.createElement('input');
  input.dataset.editorInspectorSearch = 'true';
  input.value = value;
  input.placeholder = 'Search...';
  input.style.cssText = [
    createEditorInputStyle(),
    'width:100%',
    'height:30px',
    'margin:0 0 8px',
    'outline:none',
  ].join(';');
  return input;
}

function appendInspectorSummary<TDocument>(
  doc: Document,
  panel: HTMLElement,
  inspectorObject: LocalEditorBrowserInspectorObject<TDocument>,
  selectionCount: number,
): void {
  const block = createInspectorComponentBlock(doc);
  const header = doc.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px';
  const title = doc.createElement('h3');
  title.textContent = selectionCount > 1 ? 'Selection' : 'GameObject';
  title.style.cssText = 'font-size:12px;margin:0;font-weight:900;color:var(--fps-editor-text-strong)';
  header.appendChild(title);
  header.appendChild(createInspectorAccessBadge(doc, 'readonly'));
  block.appendChild(header);
  appendReadOnlyRow(doc, block, selectionCount > 1 ? 'Selected' : 'Name', inspectorObject.label ?? inspectorObject.activeId ?? inspectorObject.targetIds[0] ?? '无');
  appendReadOnlyRow(doc, block, 'Active ID', inspectorObject.activeId ?? '无');
  if (selectionCount > 1) appendReadOnlyRow(doc, block, 'Count', String(selectionCount));
  panel.appendChild(block);
}

function filterInspectorSections<TDocument>(
  sections: LocalEditorBrowserInspectorSection<TDocument>[],
  filter: string,
): LocalEditorBrowserInspectorSection<TDocument>[] {
  const needle = filter.trim().toLowerCase();
  if (!needle) return sections;
  return sections
    .map(section => ({
      ...section,
      properties: section.properties.filter(property => inspectorPropertyMatches(section, property, needle)),
    }))
    .filter(section => section.properties.length > 0 || inspectorSectionMatches(section, needle));
}

function inspectorSectionMatches<TDocument>(
  section: LocalEditorBrowserInspectorSection<TDocument>,
  needle: string,
): boolean {
  return [section.id, section.title, section.summary ?? '', ...(section.tags ?? [])]
    .some(value => value.toLowerCase().includes(needle));
}

function inspectorPropertyMatches<TDocument>(
  section: LocalEditorBrowserInspectorSection<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
  needle: string,
): boolean {
  return inspectorSectionMatches(section, needle)
    || [property.path, property.label, property.control, property.valueType, ...(property.tags ?? [])]
      .some(value => String(value).toLowerCase().includes(needle));
}

function createInspectorSectionBlock<TDocument>(
  doc: Document,
  inspectorObject: LocalEditorBrowserInspectorObject<TDocument>,
  section: LocalEditorBrowserInspectorSection<TDocument>,
  controlRegistry: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[],
): HTMLDetailsElement {
  const block = doc.createElement('details');
  block.dataset.editorInspectorSection = section.id;
  block.open = section.collapsedByDefault !== true;
  const status = resolveLocalEditorBrowserInspectorSectionStatus(section);
  const { access, effect } = status;
  block.dataset.editorInspectorAccess = access;
  block.dataset.editorInspectorEffect = effect;
  block.style.cssText = createInspectorBlockStyle(access, effect);
  const sectionTitle = doc.createElement('summary');
  sectionTitle.style.cssText = [
    'font-size:12px',
    'margin:-2px 0 8px',
    'font-weight:900',
    'color:var(--fps-editor-text-strong)',
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'cursor:pointer',
    'list-style:none',
  ].join(';');
  const label = doc.createElement('span');
  label.textContent = section.title;
  sectionTitle.appendChild(label);
  const meta = doc.createElement('span');
  meta.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0;color:var(--fps-editor-muted);font-size:10px;text-transform:uppercase;letter-spacing:0';
  if (section.summary) {
    const summary = doc.createElement('span');
    summary.textContent = section.summary;
    summary.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:none;font-size:11px';
    meta.appendChild(summary);
  }
  const badge = createInspectorAccessBadge(doc, access);
  badge.style.flex = '0 0 auto';
  meta.appendChild(badge);
  const effectBadge = createInspectorEffectBadge(doc, effect, section.disabledReason);
  if (effectBadge && status.showEffectBadge) {
    effectBadge.style.flex = '0 0 auto';
    meta.appendChild(effectBadge);
  }
  sectionTitle.appendChild(meta);
  block.appendChild(sectionTitle);
  const content = doc.createElement('div');
  content.dataset.editorInspectorSectionContent = section.id;
  for (const group of groupInspectorProperties(section.properties)) {
    if (group.kind === 'vector') appendInspectorVectorInputs(doc, content, inspectorObject, group.label, group.properties);
    else appendInspectorPropertyRow(doc, content, inspectorObject, group.property, controlRegistry);
  }
  block.appendChild(content);
  return block;
}

function createInspectorComponentBlock(doc: Document): HTMLDivElement {
  const block = doc.createElement('div');
  block.dataset.editorInspectorAccess = 'readonly';
  block.dataset.editorInspectorEffect = 'active';
  block.style.cssText = createInspectorBlockStyle('readonly', 'active');
  return block;
}

export type LocalEditorBrowserInspectorAccessMode = 'editable' | 'mixed' | 'readonly' | 'runtime';

export interface LocalEditorBrowserInspectorSectionStatus {
  access: LocalEditorBrowserInspectorAccessMode;
  effect: LocalEditorBrowserInspectorEffectMode;
  showEffectBadge: boolean;
}

type InspectorAccessMode = LocalEditorBrowserInspectorAccessMode;

export function resolveLocalEditorBrowserInspectorSectionStatus<TDocument>(
  section: LocalEditorBrowserInspectorSection<TDocument>,
): LocalEditorBrowserInspectorSectionStatus {
  const access = getInspectorSectionAccess(section);
  const effect = getInspectorSectionEffect(section);
  return {
    access,
    effect,
    showEffectBadge: effect !== 'active'
      && !(access === 'runtime' && effect === 'runtime')
      && !(effect === 'default' && inspectorSummaryLooksDefault(section.summary)),
  };
}

function createInspectorBlockStyle(
  _access: InspectorAccessMode,
  _effect: LocalEditorBrowserInspectorEffectMode = 'active',
): string {
  return [
    'margin:0 0 8px',
    'padding:9px',
    'border:1px solid var(--fps-editor-inspector-section-border, var(--fps-editor-border))',
    'border-radius:3px',
    'background:var(--fps-editor-panel-soft)',
  ].join(';');
}

function isInspectorPropertyEditable<TDocument>(property: LocalEditorBrowserInspectorProperty<TDocument>): boolean {
  return property.readOnly !== true
    && property.persistence === 'document'
    && getInspectorPropertyEffect(property) === 'active';
}

function getInspectorPropertyAccess<TDocument>(property: LocalEditorBrowserInspectorProperty<TDocument>): InspectorAccessMode {
  if (property.persistence === 'runtime') return 'runtime';
  if (getInspectorPropertyEffect(property) === 'runtime') return 'runtime';
  return isInspectorPropertyEditable(property) ? 'editable' : 'readonly';
}

function getInspectorSectionAccess<TDocument>(section: LocalEditorBrowserInspectorSection<TDocument>): InspectorAccessMode {
  if (section.runtimeOnly || section.persistence === 'runtime' || getInspectorSectionEffect(section) === 'runtime') return 'runtime';
  const editableCount = section.properties.filter(isInspectorPropertyEditable).length;
  if (editableCount === 0) return 'readonly';
  if (editableCount === section.properties.length) return 'editable';
  return 'mixed';
}

function getInspectorPropertyEffect<TDocument>(
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): LocalEditorBrowserInspectorEffectMode {
  if (property.effect) return property.effect;
  if (property.persistence === 'runtime') return 'runtime';
  return 'active';
}

function getInspectorSectionEffect<TDocument>(
  section: LocalEditorBrowserInspectorSection<TDocument>,
): LocalEditorBrowserInspectorEffectMode {
  if (section.effect) return section.effect;
  if (section.runtimeOnly || section.persistence === 'runtime') return 'runtime';
  if (section.properties.some(isInspectorPropertyEditable)) return 'active';
  const effects = new Set(section.properties.map(getInspectorPropertyEffect));
  if (effects.size === 1) return [...effects][0] ?? 'active';
  if (effects.has('unsupported')) return 'unsupported';
  if (effects.has('default')) return 'default';
  if (effects.has('derived')) return 'derived';
  if (effects.has('runtime')) return 'runtime';
  return 'active';
}

function createInspectorAccessBadge(doc: Document, access: InspectorAccessMode): HTMLSpanElement {
  const labels: Record<InspectorAccessMode, string> = {
    editable: 'EDITABLE',
    mixed: 'MIXED',
    readonly: 'READONLY',
    runtime: 'RUNTIME',
  };
  const badge = createBadge(doc, labels[access], {
    compact: true,
    tone: access === 'editable' ? 'success' : access === 'mixed' || access === 'runtime' ? 'warning' : 'default',
  });
  badge.title = access === 'editable'
    ? 'This section writes to the document.'
    : access === 'mixed'
      ? 'This section contains both editable and read-only fields.'
      : access === 'runtime'
        ? 'Runtime-only context, not saved to the document.'
        : 'Read-only information.';
  return badge;
}

function createInspectorEffectBadge(
  doc: Document,
  effect: LocalEditorBrowserInspectorEffectMode,
  disabledReason?: string,
): HTMLSpanElement | null {
  if (effect === 'active') return null;
  const labels: Record<Exclude<LocalEditorBrowserInspectorEffectMode, 'active'>, string> = {
    default: 'DEFAULTS',
    derived: 'DERIVED',
    runtime: 'RUNTIME',
    unsupported: 'NO EFFECT',
  };
  const badge = createBadge(doc, labels[effect], {
    compact: true,
    tone: effect === 'unsupported' ? 'danger' : 'warning',
  });
  badge.title = disabledReason ?? createInspectorEffectTitle(effect);
  return badge;
}

function createInspectorEffectTitle(effect: LocalEditorBrowserInspectorEffectMode): string {
  switch (effect) {
    case 'default':
      return 'Default values are being shown; edits do not affect this object until an override is configured.';
    case 'derived':
      return 'Derived from document or runtime state.';
    case 'runtime':
      return 'Runtime-only context, not saved to the document.';
    case 'unsupported':
      return 'This field is visible but editing is not supported for the current object.';
    default:
      return 'Editable field.';
  }
}

function inspectorSummaryLooksDefault(summary: string | undefined): boolean {
  return summary?.trim().toLowerCase() === 'defaults';
}

type InspectorPropertyGroup<TDocument> =
  | { kind: 'property'; property: LocalEditorBrowserInspectorProperty<TDocument> }
  | { kind: 'vector'; label: string; properties: LocalEditorBrowserInspectorProperty<TDocument>[] };

function groupInspectorProperties<TDocument>(
  properties: LocalEditorBrowserInspectorProperty<TDocument>[],
): InspectorPropertyGroup<TDocument>[] {
  const groups: InspectorPropertyGroup<TDocument>[] = [];
  const consumed = new Set<string>();
  for (const property of properties) {
    if (consumed.has(property.path)) continue;
    if (property.control === 'vec2' || property.control === 'vec3') {
      groups.push({ kind: 'property', property });
      consumed.add(property.path);
      continue;
    }
    const match = property.path.match(/^(.*)\.(x|y|z|r|g|b)$/);
    if (!match || property.valueType !== 'number') {
      groups.push({ kind: 'property', property });
      consumed.add(property.path);
      continue;
    }
    const basePath = match[1]!;
    const axes = ['x', 'y', 'z'].every(axis => properties.some(candidate => candidate.path === `${basePath}.${axis}`))
      ? ['x', 'y', 'z']
      : ['r', 'g', 'b'];
    const vector = axes
      .map(axis => properties.find(candidate => candidate.path === `${basePath}.${axis}` && candidate.valueType === 'number'))
      .filter((candidate): candidate is LocalEditorBrowserInspectorProperty<TDocument> => !!candidate);
    if (vector.length === 3) {
      for (const entry of vector) consumed.add(entry.path);
      const parts = basePath.split('.');
      groups.push({ kind: 'vector', label: resolveInspectorVectorGroupLabel(vector, parts[parts.length - 1] ?? basePath), properties: vector });
    } else {
      groups.push({ kind: 'property', property });
      consumed.add(property.path);
    }
  }
  return groups;
}

function resolveInspectorVectorGroupLabel<TDocument>(
  properties: LocalEditorBrowserInspectorProperty<TDocument>[],
  fallback: string,
): string {
  const labels = properties.map(property => {
    const match = property.label.match(/^(.*)\.(x|y|z|r|g|b)$/);
    return match?.[1]?.trim() ?? '';
  });
  const first = labels[0];
  if (first && labels.every(label => label === first)) return first;
  return toTitle(fallback);
}

const builtinInspectorControlRegistrations: readonly LocalEditorBrowserInspectorControlRegistration[] = [
  {
    id: 'builtin.readonly',
    order: 100,
    control: 'readonly',
    render: ({ doc, target, property }) => createInspectorReadonlyControl(doc, target, property),
  },
  {
    id: 'builtin.string',
    order: 100,
    control: 'string',
    render: ({ doc, target, property }) => createInspectorTextControl(doc, target, property),
  },
  {
    id: 'builtin.number',
    order: 100,
    control: 'number',
    render: ({ doc, target, property }) => createInspectorNumberControl(doc, target, property),
  },
  {
    id: 'builtin.boolean',
    order: 100,
    control: 'boolean',
    render: ({ doc, target, property }) => createInspectorBooleanControl(doc, target, property),
  },
  {
    id: 'builtin.enum',
    order: 100,
    control: 'enum',
    render: ({ doc, target, property }) => createInspectorEnumControl(doc, target, property),
  },
  {
    id: 'builtin.vec2',
    order: 100,
    control: 'vec2',
    render: ({ doc, target, property }) => createInspectorVectorControl(doc, target, property),
  },
  {
    id: 'builtin.vec3',
    order: 100,
    control: 'vec3',
    render: ({ doc, target, property }) => createInspectorVectorControl(doc, target, property),
  },
  {
    id: 'builtin.color',
    order: 100,
    control: 'color',
    render: ({ doc, target, property }) => createInspectorColorControl(doc, target, property),
  },
  {
    id: 'builtin.asset',
    order: 100,
    control: 'asset',
    render: ({ doc, target, property }) => createInspectorTextControl(doc, target, property),
  },
  {
    id: 'builtin.object',
    order: 100,
    control: 'object',
    render: ({ doc, target, property }) => createInspectorReadonlyControl(doc, target, property),
  },
  {
    id: 'builtin.custom',
    order: 1000,
    control: 'custom',
    render: ({ doc, target, property }) => createInspectorReadonlyControl(doc, target, property),
  },
];

function appendInspectorPropertyRow<TDocument>(
  doc: Document,
  parent: HTMLElement,
  inspectorObject: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
  controlRegistry: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[],
): void {
  const control = renderInspectorControl(doc, controlRegistry, inspectorObject, property);
  const access = getInspectorPropertyAccess(property);
  const effect = getInspectorPropertyEffect(property);
  const row = createPropertyRow(doc, property.label, control);
  row.dataset.editorInspectorAccess = access;
  row.dataset.editorInspectorEffect = effect;
  row.title = createInspectorStatusTitle(access, effect, property.tooltip ?? property.disabledReason);
  const label = row.firstElementChild as HTMLElement | null;
  if (label) label.style.cssText = createInspectorPropertyLabelStyle(access, effect);
  parent.appendChild(row);
}

export function createLocalEditorBrowserInspectorControlRegistry<TDocument>(
  controls: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[] = [],
  conflict: LocalEditorBrowserInspectorConflictStrategy = 'error',
): LocalEditorBrowserInspectorControlRegistration<TDocument>[] {
  const registrations = new Map<string, LocalEditorBrowserInspectorControlRegistration<TDocument>>();
  for (const control of builtinInspectorControlRegistrations as readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[]) {
    registerInspectorControl(registrations, control, 'error');
  }
  for (const control of controls) {
    registerInspectorControl(registrations, control, conflict);
  }
  return [...registrations.values()].sort(compareInspectorControlRegistrations);
}

function registerInspectorControl<TDocument>(
  registrations: Map<string, LocalEditorBrowserInspectorControlRegistration<TDocument>>,
  registration: LocalEditorBrowserInspectorControlRegistration<TDocument>,
  conflict: LocalEditorBrowserInspectorConflictStrategy,
): void {
  const id = registration.id.trim();
  if (!id) throw new Error('Inspector control id is required.');
  const normalized = id === registration.id ? registration : { ...registration, id };
  if (registrations.has(id)) {
    if (conflict === 'error') throw new Error(`Inspector control "${id}" is already registered.`);
    if (conflict === 'ignore') return;
  }
  registrations.set(id, normalized);
}

function compareInspectorControlRegistrations<TDocument>(
  left: LocalEditorBrowserInspectorControlRegistration<TDocument>,
  right: LocalEditorBrowserInspectorControlRegistration<TDocument>,
): number {
  return (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);
}

function renderInspectorControl<TDocument>(
  doc: Document,
  registrations: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[],
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLElement {
  if (!isInspectorPropertyEditable(property)) return createInspectorReadonlyControl(doc, target, property);
  const context: LocalEditorBrowserInspectorControlRenderContext<TDocument> = {
    doc,
    target,
    property,
    bindInput(element, options) {
      applyLocalEditorBrowserInspectorControlBinding(element, target, property, options);
    },
  };
  const registration = resolveLocalEditorBrowserInspectorControlRegistration(registrations, context);
  if (registration) return registration.render(context);
  return createInspectorReadonlyControl(doc, target, property);
}

export function resolveLocalEditorBrowserInspectorControlRegistration<TDocument>(
  registrations: readonly LocalEditorBrowserInspectorControlRegistration<TDocument>[],
  context: LocalEditorBrowserInspectorControlRenderContext<TDocument>,
): LocalEditorBrowserInspectorControlRegistration<TDocument> | null {
  for (const registration of registrations) {
    if (localEditorBrowserInspectorControlSupports(registration, context)) return registration;
  }
  return null;
}

function localEditorBrowserInspectorControlSupports<TDocument>(
  registration: LocalEditorBrowserInspectorControlRegistration<TDocument>,
  context: LocalEditorBrowserInspectorControlRenderContext<TDocument>,
): boolean {
  if (registration.control && registration.control !== context.property.control) return false;
  if (registration.customControl && registration.customControl !== context.property.customControl) return false;
  return registration.supports?.(context) ?? true;
}

function appendInspectorVectorInputs<TDocument>(
  doc: Document,
  parent: HTMLElement,
  inspectorObject: LocalEditorBrowserInspectorObject<TDocument>,
  label: string,
  properties: LocalEditorBrowserInspectorProperty<TDocument>[],
): void {
  const wrapper = doc.createElement('div');
  wrapper.style.cssText = 'margin:8px 0';
  const access = getInspectorPropertyGroupAccess(properties);
  const effect = getInspectorPropertyGroupEffect(properties);
  wrapper.dataset.editorInspectorAccess = access;
  wrapper.dataset.editorInspectorEffect = effect;
  const labelElement = doc.createElement('div');
  labelElement.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px';
  const labelText = doc.createElement('span');
  labelText.textContent = label;
  labelText.style.cssText = createInspectorPropertyLabelStyle(access, effect);
  labelElement.appendChild(labelText);
  if (access !== 'editable') {
    const badge = createInspectorAccessBadge(doc, access);
    badge.style.flex = '0 0 auto';
    labelElement.appendChild(badge);
  }
  const effectBadge = createInspectorEffectBadge(doc, effect, getInspectorPropertyGroupDisabledReason(properties));
  if (effectBadge && !(access === 'runtime' && effect === 'runtime')) {
    effectBadge.style.flex = '0 0 auto';
    labelElement.appendChild(effectBadge);
  }
  wrapper.appendChild(labelElement);

  const fields = doc.createElement('div');
  fields.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px';
  for (const property of properties) {
    fields.appendChild(isInspectorPropertyEditable(property)
      ? createInspectorNumberControl(doc, inspectorObject, property)
      : createInspectorReadonlyControl(doc, inspectorObject, property));
  }
  wrapper.appendChild(fields);
  parent.appendChild(wrapper);
}

function getInspectorPropertyGroupAccess<TDocument>(
  properties: LocalEditorBrowserInspectorProperty<TDocument>[],
): InspectorAccessMode {
  if (properties.some(property => property.persistence === 'runtime')) return 'runtime';
  const editableCount = properties.filter(isInspectorPropertyEditable).length;
  if (editableCount === 0) return 'readonly';
  if (editableCount === properties.length) return 'editable';
  return 'mixed';
}

function getInspectorPropertyGroupEffect<TDocument>(
  properties: LocalEditorBrowserInspectorProperty<TDocument>[],
): LocalEditorBrowserInspectorEffectMode {
  const effects = new Set(properties.map(getInspectorPropertyEffect));
  if (effects.size === 1) return [...effects][0] ?? 'active';
  if (effects.has('unsupported')) return 'unsupported';
  if (effects.has('default')) return 'default';
  if (effects.has('derived')) return 'derived';
  if (effects.has('runtime')) return 'runtime';
  return 'active';
}

function getInspectorPropertyGroupDisabledReason<TDocument>(
  properties: LocalEditorBrowserInspectorProperty<TDocument>[],
): string | undefined {
  return properties.find(property => property.disabledReason)?.disabledReason;
}

function createInspectorPropertyLabelStyle(
  access: InspectorAccessMode,
  effect: LocalEditorBrowserInspectorEffectMode = 'active',
): string {
  return [
    `color:${effect === 'unsupported' ? 'var(--fps-editor-danger-text)' : effect === 'default' || effect === 'derived' || access === 'runtime' ? 'var(--fps-editor-warn)' : access === 'editable' ? 'var(--fps-editor-muted-strong)' : 'var(--fps-editor-muted)'}`,
    'font-weight:800',
    access === 'readonly' ? 'opacity:0.82' : '',
  ].filter(Boolean).join(';');
}

function createInspectorAccessTitle(access: InspectorAccessMode, tooltip?: string): string {
  const accessLabel = access === 'editable'
    ? 'Editable'
    : access === 'mixed'
      ? 'Mixed editable and read-only'
      : access === 'runtime'
        ? 'Runtime-only'
        : 'Read-only';
  return tooltip ? `${accessLabel}: ${tooltip}` : accessLabel;
}

function createInspectorStatusTitle(
  access: InspectorAccessMode,
  effect: LocalEditorBrowserInspectorEffectMode,
  detail?: string,
): string {
  const parts = [createInspectorAccessTitle(access)];
  if (effect !== 'active') parts.push(createInspectorEffectTitle(effect));
  if (detail) parts.push(detail);
  return [...new Set(parts)].join(' ');
}

function createInspectorReadonlyValueShell(
  doc: Document,
  access: InspectorAccessMode,
  effect: LocalEditorBrowserInspectorEffectMode = 'active',
  title?: string,
): HTMLDivElement {
  const valueElement = doc.createElement('div');
  valueElement.dataset.editorInspectorAccess = access;
  valueElement.dataset.editorInspectorEffect = effect;
  valueElement.title = title ?? createInspectorStatusTitle(access, effect);
  const warningLike = effect === 'default' || effect === 'derived' || access === 'runtime' || effect === 'runtime';
  const unsupported = effect === 'unsupported';
  valueElement.style.cssText = [
    'min-width:0',
    'min-height:24px',
    'display:flex',
    'align-items:center',
    'gap:5px',
    'padding:3px 6px',
    `border:1px solid ${unsupported ? 'var(--fps-editor-danger-border)' : warningLike ? 'var(--fps-editor-warn-border)' : 'var(--fps-editor-readonly-border)'}`,
    'border-radius:3px',
    `background:${unsupported ? 'var(--fps-editor-danger-soft)' : warningLike ? 'var(--fps-editor-warn-soft)' : 'var(--fps-editor-readonly-bg)'}`,
    `color:${unsupported ? 'var(--fps-editor-danger-text)' : warningLike ? 'var(--fps-editor-warn)' : 'var(--fps-editor-readonly-text)'}`,
    warningLike ? 'font-style:italic' : '',
  ].filter(Boolean).join(';');
  const icon = createLocalEditorIcon(doc, 'lock', { size: 11, strokeWidth: 2.3 });
  icon.style.opacity = '0.78';
  valueElement.appendChild(icon);
  return valueElement;
}

function appendInspectorReadonlyTextValue(
  doc: Document,
  parent: HTMLElement,
  value: string,
  access: InspectorAccessMode,
  effect: LocalEditorBrowserInspectorEffectMode = 'active',
  title?: string,
): void {
  const valueText = doc.createElement('span');
  valueText.textContent = value;
  valueText.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  parent.appendChild(valueText);
  parent.title = title ?? createInspectorStatusTitle(access, effect);
}

function createInspectorReadonlyScalarControl(
  doc: Document,
  value: string,
  access: InspectorAccessMode,
  effect: LocalEditorBrowserInspectorEffectMode = 'active',
  title?: string,
): HTMLDivElement {
  const valueElement = createInspectorReadonlyValueShell(doc, access, effect, title);
  appendInspectorReadonlyTextValue(doc, valueElement, value, access, effect, title);
  return valueElement;
}

function createInspectorReadonlyDetailsShell<TDocument>(
  doc: Document,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
  access: InspectorAccessMode,
): HTMLDetailsElement {
  const effect = getInspectorPropertyEffect(property);
  const warningLike = effect === 'default' || effect === 'derived' || access === 'runtime' || effect === 'runtime';
  const unsupported = effect === 'unsupported';
  const details = doc.createElement('details');
  details.dataset.editorInspectorAccess = access;
  details.dataset.editorInspectorEffect = effect;
  details.title = createInspectorStatusTitle(access, effect, property.tooltip ?? property.disabledReason);
  details.style.cssText = [
    'min-width:0',
    'max-width:100%',
    'padding:3px 6px',
    `border:1px solid ${unsupported ? 'var(--fps-editor-danger-border)' : warningLike ? 'var(--fps-editor-warn-border)' : 'var(--fps-editor-readonly-border)'}`,
    'border-radius:3px',
    `background:${unsupported ? 'var(--fps-editor-danger-soft)' : warningLike ? 'var(--fps-editor-warn-soft)' : 'var(--fps-editor-readonly-bg)'}`,
    `color:${unsupported ? 'var(--fps-editor-danger-text)' : warningLike ? 'var(--fps-editor-warn)' : 'var(--fps-editor-readonly-text)'}`,
  ].join(';');
  return details;
}

function createInspectorInputBase<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLInputElement {
  const input = doc.createElement('input');
  input.value = property.mixed ? '' : String(property.value);
  input.placeholder = property.mixed ? '--' : '';
  applyLocalEditorBrowserInspectorControlBinding(input, target, property);
  input.style.cssText = createInspectorInputStyle();
  return input;
}

function createInspectorNumberControl<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLInputElement {
  const input = createInspectorInputBase(doc, target, property);
  input.type = 'number';
  input.step = String(property.step ?? 0.1);
  if (property.min != null) input.min = String(property.min);
  if (property.max != null) input.max = String(property.max);
  return input;
}

function createInspectorTextControl<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLInputElement {
  const input = createInspectorInputBase(doc, target, property);
  input.type = 'text';
  return input;
}

function createInspectorBooleanControl<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLInputElement {
  const input = createInspectorInputBase(doc, target, property);
  input.type = 'checkbox';
  input.checked = property.mixed ? false : property.value === true;
  input.style.cssText = [
    'width:16px',
    'height:16px',
    'accent-color:var(--fps-editor-accent)',
    'justify-self:start',
    'cursor:pointer',
    'box-shadow:0 0 0 1px var(--fps-editor-editable-border)',
  ].join(';');
  return input;
}

function createInspectorEnumControl<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLSelectElement {
  const select = doc.createElement('select');
  applyLocalEditorBrowserInspectorControlBinding(select, target, property);
  select.style.cssText = createInspectorInputStyle();
  for (const option of property.options ?? []) {
    const item = doc.createElement('option');
    item.value = String(option.value);
    item.dataset.serializedOptionValue = JSON.stringify(option.value);
    item.textContent = option.label;
    item.disabled = option.disabled === true;
    if (!property.mixed && option.value === property.value) item.selected = true;
    select.appendChild(item);
  }
  if (property.mixed) {
    const mixed = doc.createElement('option');
    mixed.value = '';
    mixed.textContent = '--';
    mixed.selected = true;
    select.prepend(mixed);
  }
  return select;
}

function createInspectorVectorControl<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLDivElement {
  const wrapper = doc.createElement('div');
  wrapper.dataset.inspectorVectorControl = 'true';
  wrapper.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%';
  const axes = property.control === 'vec2' ? ['x', 'y'] : ['x', 'y', 'z'];
  if (property.control === 'vec2') wrapper.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  const value = isRecord(property.value) ? property.value : {};
  for (const axis of axes) {
    const input = createInspectorInputBase(doc, target, property);
    input.type = 'number';
    input.step = String(property.step ?? 0.1);
    input.dataset.serializedVectorAxis = axis;
    input.value = property.mixed ? '' : String(value[axis] ?? 0);
    input.title = `${property.label}.${axis}`;
    wrapper.appendChild(input);
  }
  return wrapper;
}

function createInspectorColorControl<TDocument>(
  doc: Document,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLInputElement {
  const input = createInspectorInputBase(doc, target, property);
  input.type = 'color';
  input.value = colorValueToHex(property.value);
  input.style.cssText = 'width:34px;height:26px;border:1px solid var(--fps-editor-editable-border);border-radius:3px;background:var(--fps-editor-editable-bg);padding:0;box-shadow:var(--fps-editor-editable-shadow)';
  return input;
}

function createInspectorReadonlyControl<TDocument>(
  doc: Document,
  _target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLElement {
  if (!property.mixed && isExpandableInspectorValue(property.value)) {
    return createInspectorObjectReadonlyControl(doc, property);
  }
  const access = getInspectorPropertyAccess(property);
  const effect = getInspectorPropertyEffect(property);
  return createInspectorReadonlyScalarControl(
    doc,
    property.mixed ? '--' : formatLocalEditorBrowserInspectorValue(property.value),
    access,
    effect,
    createInspectorStatusTitle(access, effect, property.tooltip ?? property.disabledReason),
  );
}

function createInspectorObjectReadonlyControl<TDocument>(
  doc: Document,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
): HTMLDetailsElement {
  const access = getInspectorPropertyAccess(property);
  const effect = getInspectorPropertyEffect(property);
  const details = createInspectorReadonlyDetailsShell(doc, property, access);
  const summary = doc.createElement('summary');
  summary.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:5px;overflow:hidden;white-space:nowrap';
  const icon = createLocalEditorIcon(doc, 'lock', { size: 11, strokeWidth: 2.3 });
  icon.style.opacity = '0.78';
  summary.appendChild(icon);
  const summaryText = doc.createElement('span');
  summaryText.textContent = formatInspectorObjectSummary(property.value);
  summaryText.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  summary.appendChild(summaryText);
  details.appendChild(summary);
  const pre = doc.createElement('pre');
  pre.textContent = formatLocalEditorBrowserInspectorValue(property.value);
  pre.style.cssText = [
    'max-height:220px',
    'overflow:auto',
    'white-space:pre-wrap',
    'word-break:break-word',
    'margin:6px 0 0',
    'padding:7px',
    `border:1px solid ${effect === 'unsupported' ? 'var(--fps-editor-danger-border)' : effect === 'default' || effect === 'derived' || effect === 'runtime' || access === 'runtime' ? 'var(--fps-editor-warn-border)' : 'var(--fps-editor-readonly-border)'}`,
    'border-radius:3px',
    'background:var(--fps-editor-field)',
    'font-size:11px',
    'line-height:1.45',
  ].join(';');
  details.appendChild(pre);
  return details;
}

export function applyLocalEditorBrowserInspectorControlBinding<TDocument>(
  element: HTMLElement,
  target: LocalEditorBrowserInspectorObject<TDocument>,
  property: LocalEditorBrowserInspectorProperty<TDocument>,
  options?: LocalEditorBrowserInspectorControlBindingOptions,
): void {
  element.dataset.serializedTargetId = target.activeId ?? target.targetIds[0] ?? '';
  if (target.targetIds.length > 1) element.dataset.serializedTargetIds = target.targetIds.join(',');
  element.dataset.serializedPath = property.path;
  element.dataset.serializedControl = property.control;
  element.dataset.serializedValueType = property.valueType;
  element.dataset.serializedCommitMode = property.commitMode;
  element.dataset.serializedPersistence = property.persistence;
  element.dataset.serializedEffect = getInspectorPropertyEffect(property);
  if (property.disabledReason) element.dataset.serializedDisabledReason = property.disabledReason;
  if (options?.source) element.dataset.serializedEditSource = options.source;
  const access = getInspectorPropertyAccess(property);
  const effect = getInspectorPropertyEffect(property);
  element.title = access === 'editable' && effect === 'active'
    ? property.tooltip ?? property.label
    : createInspectorStatusTitle(access, effect, property.tooltip ?? property.disabledReason ?? property.label);
  if ('disabled' in element) {
    (element as HTMLInputElement | HTMLSelectElement).disabled = !isInspectorPropertyEditable(property);
  }
}

function createInspectorInputStyle(): string {
  return [
    createEditorInputStyle(),
    'padding:0 6px',
    'background:var(--fps-editor-editable-bg)',
    'border-color:var(--fps-editor-editable-border)',
    'color:var(--fps-editor-text-strong)',
    'box-shadow:var(--fps-editor-editable-shadow)',
  ].join(';');
}

function appendReadOnlyRow(doc: Document, parent: HTMLElement, label: string, value: string): void {
  const valueElement = createInspectorReadonlyScalarControl(doc, value, 'readonly', 'active', 'Read-only summary');
  const row = createPropertyRow(doc, label, valueElement);
  row.dataset.editorInspectorAccess = 'readonly';
  const labelElement = row.firstElementChild as HTMLElement | null;
  if (labelElement) labelElement.style.cssText = createInspectorPropertyLabelStyle('readonly', 'active');
  parent.appendChild(row);
}

function createLegacyInspectorObject<TDocument>(
  serializedObject: LocalEditorBrowserSerializedObject<TDocument> | LocalEditorBrowserSerializedMultiObject<TDocument>,
): LocalEditorBrowserInspectorObject<TDocument> {
  const targetIds = 'targetIds' in serializedObject ? serializedObject.targetIds : [serializedObject.targetId];
  const activeId = 'targetId' in serializedObject ? serializedObject.targetId : serializedObject.activeId;
  return {
    targetIds,
    activeId,
    label: serializedObject.label,
    document: serializedObject.document,
    selection: {
      targetIds,
      activeId,
      document: serializedObject.document,
    },
    sections: createLegacyInspectorSections(serializedObject.properties),
  };
}

function createLegacyInspectorSections<TDocument>(
  properties: LocalEditorBrowserSerializedProperty<TDocument>[],
): LocalEditorBrowserInspectorSection<TDocument>[] {
  const sections = new Map<string, { order: number; properties: LocalEditorBrowserInspectorProperty<TDocument>[] }>();
  for (const [index, property] of properties.entries()) {
    const id = property.path.split('.')[0] || 'properties';
    const section = sections.get(id) ?? { order: sections.size, properties: [] };
    section.properties.push({
      path: property.path,
      label: property.label,
      valueType: property.valueType,
      control: inferLegacyInspectorControl(property),
      value: property.value,
      mixed: property.mixed,
      readOnly: property.readOnly === true,
      persistence: property.readOnly === true ? 'readonly' : 'document',
      commitMode: inferLegacyInspectorCommitMode(property),
      order: index,
      document: property.document,
    });
    sections.set(id, section);
  }
  return [...sections.entries()].map(([id, section]) => ({
    id,
    title: toTitle(id),
    order: section.order,
    placement: id === 'gameObject' ? 'summary' : 'body',
    persistence: section.properties.some(property => property.persistence === 'document') ? 'document' : 'readonly',
    properties: section.properties,
  }));
}

function createSelectionSummaryInspectorObject<TDocument>(
  state: LocalEditorBrowserUiState<TDocument>,
): LocalEditorBrowserInspectorObject<TDocument> | null {
  const targetIds = state.selectedIds;
  if (targetIds.length === 0) return null;
  const activeId = state.selectionSummary?.activeId ?? state.activeId ?? targetIds[0] ?? null;
  return {
    targetIds,
    activeId,
    label: `${targetIds.length} objects`,
    selection: {
      targetIds,
      activeId,
    },
    sections: [],
  };
}

function inferLegacyInspectorControl<TDocument>(
  property: LocalEditorBrowserSerializedProperty<TDocument>,
): LocalEditorBrowserInspectorControlKind {
  if (property.readOnly) return 'readonly';
  if (property.valueType === 'string') return 'string';
  if (property.valueType === 'number') return 'number';
  if (property.valueType === 'boolean') return 'boolean';
  if (property.valueType === 'enum') return 'enum';
  if (property.valueType === 'asset') return 'asset';
  if (property.valueType === 'object') return 'object';
  return 'readonly';
}

function inferLegacyInspectorCommitMode<TDocument>(
  property: LocalEditorBrowserSerializedProperty<TDocument>,
): LocalEditorBrowserInspectorCommitMode {
  switch (property.valueType) {
    case 'number':
      return 'live';
    case 'boolean':
    case 'enum':
    case 'asset':
      return 'immediate';
    default:
      return 'blur';
  }
}

export function formatLocalEditorBrowserInspectorValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(toStableInspectorJsonValue(value), null, 2);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return String(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isExpandableInspectorValue(value: unknown): boolean {
  return !!value && typeof value === 'object';
}

function formatInspectorObjectSummary(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (!isRecord(value)) return 'Object';
  const keys = Object.keys(value).sort();
  if (keys.length === 0) return 'Object {}';
  const shown = keys.slice(0, 4).join(', ');
  return keys.length > 4 ? `Object { ${shown}, ... }` : `Object { ${shown} }`;
}

function toStableInspectorJsonValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return String(value);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  if (depth > 6) return '[MaxDepth]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => toStableInspectorJsonValue(item, seen, depth + 1));
  const record = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    output[key] = toStableInspectorJsonValue(record[key], seen, depth + 1);
  }
  return output;
}

function colorValueToHex(value: unknown): string {
  if (!value || typeof value !== 'object') return '#ffffff';
  const color = value as { r?: unknown; g?: unknown; b?: unknown };
  const toHex = (channel: unknown) => {
    const value = typeof channel === 'number' && Number.isFinite(channel) ? channel : 1;
    return Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');
  };
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}
