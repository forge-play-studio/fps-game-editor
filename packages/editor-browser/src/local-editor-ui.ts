import * as LocalEditorPanels from './local-editor-ui-panels';
import { createLocalEditorWorkbenchInputRouter } from './local-editor-ui-input-router';
import { createLocalEditorPanelRegistry } from './local-editor-ui-panel-registry';
import * as LocalEditorShared from './local-editor-ui-shared';
import { createShortcutHelpPanel as createLocalEditorShortcutHelpPanel } from './local-editor-ui-shortcuts';
import { ensureLocalEditorTheme, LOCAL_EDITOR_THEME_CLASS } from './local-editor-ui-theme';
import {
  createDefaultLocalEditorWorkbenchLayout,
  createLocalEditorWorkbench,
  createSceneHeaderToolbar,
  createWorkbenchPanelContent,
} from './local-editor-ui-workbench';
import type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserTransformConstraint,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformTool,
  LocalEditorBrowserUi,
  LocalEditorBrowserUiOptions,
  LocalEditorBrowserUiState,
} from './local-editor-ui-types';

export type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserAuthoringSource,
  LocalEditorBrowserHierarchySelectionInput,
  LocalEditorBrowserHistoryEntry,
  LocalEditorBrowserHistoryView,
  LocalEditorBrowserSceneGraphCreateGroupIntent,
  LocalEditorBrowserSceneGraphDeleteIntent,
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserSceneGraphDropPlacement,
  LocalEditorBrowserSceneGraphRenameIntent,
  LocalEditorBrowserSerializedMultiObject,
  LocalEditorBrowserSerializedObject,
  LocalEditorBrowserSerializedProperty,
  LocalEditorBrowserSerializedValueType,
  LocalEditorBrowserTransformConstraint,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformTool,
  LocalEditorBrowserTransformToolState,
  LocalEditorBrowserUi,
  LocalEditorBrowserUiAssetItem,
  LocalEditorBrowserUiCallbacks,
  LocalEditorBrowserUiHierarchyItem,
  LocalEditorBrowserUiOptions,
  LocalEditorBrowserUiPropertyInput,
  LocalEditorBrowserUiState,
} from './local-editor-ui-types';

export function createLocalEditorBrowserUi<TDocument = unknown>(
  options: LocalEditorBrowserUiOptions = {},
): LocalEditorBrowserUi<TDocument> {
  const doc = options.document ?? document;
  const root = options.root ?? doc.body;
  const callbacks = options.callbacks ?? {};
  ensureLocalEditorTheme(doc);
  const inputRouter = createLocalEditorWorkbenchInputRouter(doc);
  let currentState: LocalEditorBrowserUiState<TDocument> | null = null;
  let hierarchyRename: { id: string; value: string } | null = null;
  let hierarchyDrag: { id: string } | null = null;
  let hierarchyDrop: LocalEditorBrowserSceneGraphDropIntent | null = null;
  const workbenchLayout = createDefaultLocalEditorWorkbenchLayout();
  const panelRegistry = createLocalEditorPanelRegistry(workbenchLayout);

  const hostChrome = doc.createElement('div');
  hostChrome.dataset.editorWorkbenchRegion = 'top-bar';
  hostChrome.className = LOCAL_EDITOR_THEME_CLASS;
  hostChrome.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:2147483640',
    'display:none',
    'align-items:center',
    'gap:8px',
    'height:34px',
    'padding:0 8px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-chrome)',
    'box-shadow:0 10px 28px rgba(0,0,0,0.24)',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
    'pointer-events:auto',
  ].join(';');
  const hostModeLabel = doc.createElement('span');
  hostModeLabel.textContent = '本地宿主 · 游戏模式';
  hostModeLabel.style.cssText = [
    'color:var(--fps-editor-muted-strong)',
    'font-weight:800',
    'white-space:nowrap',
  ].join(';');
  const enterEditorButton = LocalEditorShared.createButton(doc, '进入编辑场景');
  hostChrome.appendChild(hostModeLabel);
  hostChrome.appendChild(enterEditorButton);
  root.appendChild(hostChrome);

  const dirtyBadge = doc.createElement('span');
  dirtyBadge.style.cssText = [
    'display:none',
    'height:20px',
    'align-items:center',
    'padding:0 7px',
    'border-radius:999px',
    'background:rgba(248,81,73,0.16)',
    'border:1px solid rgba(248,81,73,0.45)',
    'color:#ffd7d5',
    'font-size:11px',
    'font-weight:800',
  ].join(';');
  dirtyBadge.textContent = '未保存';

  const saveButton = LocalEditorShared.createButton(doc, '保存场景');
  const saveAndRunButton = LocalEditorShared.createButton(doc, '保存并运行');
  const discardRunButton = LocalEditorShared.createButton(doc, '放弃并运行');
  const undoButton = LocalEditorShared.createButton(doc, '撤销');
  const redoButton = LocalEditorShared.createButton(doc, '重做');
  let helpOpen = false;

  const status = doc.createElement('span');
  status.style.cssText = [
    'flex:0 1 300px',
    'min-width:120px',
    'max-width:320px',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
    'color:var(--fps-editor-muted)',
    'font-size:11px',
  ].join(';');

  const workbench = createLocalEditorWorkbench(doc);
  const hierarchyPanel = createWorkbenchPanelContent(doc);
  const assetPanel = workbench.bottomDock;
  const inspectorPanel = createWorkbenchPanelContent(doc);
  workbench.leftDock.appendChild(hierarchyPanel);
  workbench.rightDock.appendChild(inspectorPanel);
  root.appendChild(workbench.root);

  const sceneToolOverlay = createSceneHeaderToolbar(doc);
  const sceneTitle = doc.createElement('div');
  sceneTitle.textContent = 'Preview';
  sceneTitle.style.cssText = [
    'height:100%',
    'display:flex',
    'align-items:center',
    'padding:0 10px 0 2px',
    'margin-right:2px',
    'border-right:1px solid var(--fps-editor-divider)',
    'color:var(--fps-editor-text-strong)',
    'font-size:13px',
    'font-weight:800',
    'white-space:nowrap',
  ].join(';');
  const sceneQuickActions = doc.createElement('div');
  sceneQuickActions.style.cssText = 'display:flex;align-items:center;gap:4px';
  const toolGroup = doc.createElement('div');
  toolGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const toolButtons = {
    select: LocalEditorShared.createButton(doc, 'Q 选择'),
    move: LocalEditorShared.createButton(doc, 'W 移动'),
    rotate: LocalEditorShared.createButton(doc, 'E 旋转'),
    scale: LocalEditorShared.createButton(doc, 'R 缩放'),
  } satisfies Record<LocalEditorBrowserTransformTool, HTMLButtonElement>;
  for (const [tool, button] of Object.entries(toolButtons) as Array<[LocalEditorBrowserTransformTool, HTMLButtonElement]>) {
    button.dataset.transformTool = tool;
    toolGroup.appendChild(button);
  }
  const spaceGroup = doc.createElement('div');
  spaceGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const spaceButtons = {
    world: LocalEditorShared.createButton(doc, '世界'),
    local: LocalEditorShared.createButton(doc, '本地'),
  } satisfies Record<LocalEditorBrowserTransformSpace, HTMLButtonElement>;
  for (const [space, button] of Object.entries(spaceButtons) as Array<[LocalEditorBrowserTransformSpace, HTMLButtonElement]>) {
    button.dataset.transformSpace = space;
    spaceGroup.appendChild(button);
  }
  const constraintGroup = doc.createElement('div');
  constraintGroup.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:4px',
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
  ].join(';');
  const viewPlaneButton = LocalEditorShared.createButton(doc, '视图平面');
  viewPlaneButton.dataset.transformConstraint = 'view-plane';
  constraintGroup.appendChild(viewPlaneButton);
  const sceneToolStatus = doc.createElement('span');
  sceneToolStatus.style.cssText = [
    'max-width:220px',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
    'color:var(--fps-editor-muted-strong)',
    'font-size:11px',
  ].join(';');
  const sceneMouseHint = doc.createElement('span');
  sceneMouseHint.style.cssText = [
    'padding-left:8px',
    'border-left:1px solid var(--fps-editor-divider)',
    'max-width:360px',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'white-space:nowrap',
    'color:var(--fps-editor-muted)',
    'font-size:11px',
  ].join(';');
  sceneMouseHint.textContent = '左键选择 · 空白拖拽框选 · 中键平移 · Alt+左键环绕 · 右键飞行 · 滚轮缩放';
  const sceneHelpButton = LocalEditorShared.createButton(doc, '快捷键');
  sceneHelpButton.style.padding = '5px 7px';
  sceneQuickActions.appendChild(saveButton);
  sceneQuickActions.appendChild(saveAndRunButton);
  sceneQuickActions.appendChild(discardRunButton);
  sceneQuickActions.appendChild(undoButton);
  sceneQuickActions.appendChild(redoButton);
  sceneQuickActions.appendChild(dirtyBadge);
  sceneQuickActions.appendChild(sceneHelpButton);
  sceneToolOverlay.appendChild(sceneTitle);
  sceneToolOverlay.appendChild(sceneQuickActions);
  sceneToolOverlay.appendChild(toolGroup);
  sceneToolOverlay.appendChild(spaceGroup);
  sceneToolOverlay.appendChild(constraintGroup);
  sceneToolOverlay.appendChild(sceneToolStatus);
  sceneToolOverlay.appendChild(sceneMouseHint);
  sceneToolOverlay.appendChild(status);
  workbench.sceneHeader.appendChild(sceneToolOverlay);

  const boxSelectionOverlay = doc.createElement('div');
  boxSelectionOverlay.style.cssText = [
    'position:fixed',
    'z-index:2147483637',
    'display:none',
    'border:1px solid rgba(88,166,255,0.95)',
    'background:rgba(56,139,253,0.18)',
    'box-shadow:0 0 0 1px rgba(10,15,23,0.55) inset',
    'pointer-events:none',
  ].join(';');
  root.appendChild(boxSelectionOverlay);

  const shortcutHelpPanel = createLocalEditorShortcutHelpPanel(doc);
  root.appendChild(shortcutHelpPanel);

  enterEditorButton.addEventListener('click', () => callbacks.onEnterEditor?.());
  saveButton.addEventListener('click', () => callbacks.onSaveScene?.());
  saveAndRunButton.addEventListener('click', () => callbacks.onSaveAndRunGame?.());
  discardRunButton.addEventListener('click', () => callbacks.onDiscardAndRunGame?.());
  undoButton.addEventListener('click', () => callbacks.onUndo?.());
  redoButton.addEventListener('click', () => callbacks.onRedo?.());
  const setShortcutHelpOpen = (open: boolean): void => {
    helpOpen = open;
    inputRouter.setModalOpen(open);
    shortcutHelpPanel.style.display = helpOpen ? '' : 'none';
    LocalEditorShared.applyButtonActiveState(sceneHelpButton, helpOpen);
  };

  sceneHelpButton.addEventListener('click', () => {
    setShortcutHelpOpen(!helpOpen);
  });
  shortcutHelpPanel.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest('[data-editor-shortcut-help-close]')) return;
    setShortcutHelpOpen(false);
  });
  toolGroup.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const tool = target?.closest<HTMLButtonElement>('[data-transform-tool]')?.dataset.transformTool as LocalEditorBrowserTransformTool | undefined;
    if (tool) callbacks.onTransformToolChange?.(tool);
  });
  spaceGroup.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const space = target?.closest<HTMLButtonElement>('[data-transform-space]')?.dataset.transformSpace as LocalEditorBrowserTransformSpace | undefined;
    if (space) callbacks.onTransformSpaceChange?.(space);
  });
  constraintGroup.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const constraint = target?.closest<HTMLButtonElement>('[data-transform-constraint]')?.dataset.transformConstraint as LocalEditorBrowserTransformConstraint | undefined;
    if (!constraint) return;
    const currentConstraint = currentState?.transformTool?.activeConstraint ?? 'axis';
    callbacks.onTransformConstraintChange?.(currentConstraint === constraint ? 'axis' : constraint);
  });

  assetPanel.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const tabButton = target?.closest<HTMLButtonElement>('[data-editor-dock-tab]');
    const tab = tabButton?.dataset.editorDockTab as LocalEditorBottomDockTab | undefined;
    if (tab === 'assets' || tab === 'history') {
      panelRegistry.setBottomDockTab(tab);
      if (currentState) render(currentState);
      return;
    }
    const assetButton = target?.closest<HTMLButtonElement>('[data-editor-asset-id]');
    if (assetButton?.dataset.editorAssetId) {
      callbacks.onCreateFromAsset?.(assetButton.dataset.editorAssetId);
      return;
    }
  });

  hierarchyPanel.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[data-editor-hierarchy-rename-input]')) return;
    const createGroupButton = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-create-group]');
    if (createGroupButton) {
      callbacks.onSceneGraphCreateGroup?.({
        parentId: currentState?.activeId ?? null,
        activeId: currentState?.activeId ?? null,
        name: 'Group',
      });
      return;
    }
    const hierarchyButton = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    if (hierarchyButton?.dataset.editorHierarchyId) {
      callbacks.onSelectHierarchyItem?.({
        id: hierarchyButton.dataset.editorHierarchyId,
        additive: event.shiftKey && !event.metaKey && !event.ctrlKey,
        toggle: event.metaKey || event.ctrlKey,
      });
    }
  });

  hierarchyPanel.addEventListener('dblclick', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const hierarchyButton = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const id = hierarchyButton?.dataset.editorHierarchyId;
    if (!id || !currentState) return;
    const item = currentState.hierarchy.find(candidate => candidate.id === id);
    if (!item || item.locked || item.renamable === false) return;
    event.preventDefault();
    hierarchyRename = { id, value: item.label };
    render(currentState);
  });

  hierarchyPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.editorHierarchyRenameInput || !hierarchyRename) return;
    hierarchyRename = {
      id: input.dataset.editorHierarchyRenameInput,
      value: input.value,
    };
  });

  hierarchyPanel.addEventListener('keydown', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.editorHierarchyRenameInput) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitHierarchyRename(input.dataset.editorHierarchyRenameInput, input.value);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      hierarchyRename = null;
      if (currentState) render(currentState);
    }
  });

  hierarchyPanel.addEventListener('focusout', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.editorHierarchyRenameInput) return;
    commitHierarchyRename(input.dataset.editorHierarchyRenameInput, input.value);
  });

  hierarchyPanel.addEventListener('dragstart', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const id = button?.dataset.editorHierarchyId;
    if (!id || !currentState) return;
    const item = currentState.hierarchy.find(candidate => candidate.id === id);
    if (!item || item.locked || item.draggable === false) {
      event.preventDefault();
      return;
    }
    hierarchyDrag = { id };
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  hierarchyPanel.addEventListener('dragover', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const targetId = button?.dataset.editorHierarchyId;
    const draggedId = hierarchyDrag?.id ?? event.dataTransfer?.getData('text/plain') ?? '';
    if (!targetId || !draggedId || draggedId === targetId) return;
    event.preventDefault();
    const placement = LocalEditorShared.readHierarchyDropPlacement(event, button);
    const targetItem = currentState?.hierarchy.find(item => item.id === targetId) ?? null;
    const canSubmitInsideDrop = placement === 'inside'
      && targetItem?.locked !== true
      && targetItem?.canHaveChildren !== false;
    hierarchyDrop = {
      draggedId,
      targetId,
      placement,
      preserveWorldTransform: true,
    };
    if (event.dataTransfer) event.dataTransfer.dropEffect = canSubmitInsideDrop ? 'move' : 'none';
    if (currentState) render(currentState);
  });

  hierarchyPanel.addEventListener('dragleave', (event) => {
    if (!hierarchyPanel.contains(event.relatedTarget as Node | null)) {
      hierarchyDrop = null;
      if (currentState) render(currentState);
    }
  });

  hierarchyPanel.addEventListener('dragend', () => {
    hierarchyDrag = null;
    hierarchyDrop = null;
    if (currentState) render(currentState);
  });

  hierarchyPanel.addEventListener('drop', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const targetId = button?.dataset.editorHierarchyId;
    const draggedId = hierarchyDrop?.draggedId ?? hierarchyDrag?.id ?? event.dataTransfer?.getData('text/plain') ?? '';
    if (!targetId || !draggedId || draggedId === targetId) return;
    event.preventDefault();
    const placement = LocalEditorShared.readHierarchyDropPlacement(event, button);
    const targetItem = currentState?.hierarchy.find(item => item.id === targetId) ?? null;
    const canSubmitInsideDrop = placement === 'inside'
      && targetItem?.locked !== true
      && targetItem?.canHaveChildren !== false;
    hierarchyDrag = null;
    hierarchyDrop = null;
    if (!canSubmitInsideDrop) {
      if (currentState) render(currentState);
      return;
    }
    callbacks.onSceneGraphDrop?.({
      draggedId,
      targetId,
      placement,
      preserveWorldTransform: true,
    });
  });

  assetPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorAssetFilter == null) return;
    callbacks.onAssetFilterChange?.(input.value);
  });

  inspectorPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    const targetIds = input.dataset.serializedTargetIds
      ? input.dataset.serializedTargetIds.split(',').filter(Boolean)
      : undefined;
    callbacks.onPropertyInput?.({
      targetId: input.dataset.serializedTargetId,
      targetIds,
      path: input.dataset.serializedPath,
      value: input.type === 'number' ? Number(input.value) : input.value,
    });
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (currentState?.mode !== 'editor' || currentState.busy) return;
    const key = event.key.toLowerCase();
    const primaryModifier = event.metaKey || event.ctrlKey;
    const handleDocumentShortcut = inputRouter.shouldHandleDocumentShortcut(event);
    const handleGlobalShortcut = inputRouter.shouldHandleGlobalShortcut(event);

    if (handleDocumentShortcut && primaryModifier && key === 's') {
      event.preventDefault();
      callbacks.onSaveScene?.();
      return;
    }
    if (handleGlobalShortcut && primaryModifier && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) callbacks.onRedo?.();
      else callbacks.onUndo?.();
      return;
    }
    if (handleGlobalShortcut && event.ctrlKey && key === 'y') {
      event.preventDefault();
      callbacks.onRedo?.();
      return;
    }
    if (handleGlobalShortcut && (key === 'delete' || key === 'backspace')) {
      const state = currentState;
      const selectedIds = state.selectedIds.filter((id) => {
        const item = state.hierarchy.find(candidate => candidate.id === id);
        return item && item.locked !== true && item.deletable !== false;
      });
      if (selectedIds.length > 0) {
        event.preventDefault();
        callbacks.onSceneGraphDelete?.({
          ids: selectedIds,
          activeId: state.activeId,
        });
      }
      return;
    }
    if (!handleGlobalShortcut || event.metaKey || event.ctrlKey || event.altKey) return;

    const toolByKey: Partial<Record<string, LocalEditorBrowserTransformTool>> = {
      q: 'select',
      w: 'move',
      e: 'rotate',
      r: 'scale',
    };
    const tool = toolByKey[key];
    if (tool) {
      event.preventDefault();
      callbacks.onTransformToolChange?.(tool);
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      callbacks.onFocusSelection?.();
      return;
    }
    if (key === 'escape') {
      event.preventDefault();
      callbacks.onCancelActiveOperation?.();
    }
  };
  doc.addEventListener('keydown', onKeyDown);

  function commitHierarchyRename(id: string, value: string): void {
    if (!hierarchyRename || hierarchyRename.id !== id) return;
    const trimmed = value.trim();
    const item = currentState?.hierarchy.find(candidate => candidate.id === id) ?? null;
    hierarchyRename = null;
    if (trimmed && item && trimmed !== item.label) {
      callbacks.onSceneGraphRename?.({ id, name: trimmed });
    }
    if (currentState) render(currentState);
  }

  const render = (state: LocalEditorBrowserUiState<TDocument>): void => {
    currentState = state;
    const inEditor = state.mode === 'editor';
    const disabled = state.busy;
    hostChrome.style.display = inEditor ? 'none' : 'flex';
    enterEditorButton.disabled = disabled;
    for (const button of [saveButton, saveAndRunButton, discardRunButton, undoButton, redoButton, sceneHelpButton]) {
      button.style.display = '';
      button.disabled = disabled;
    }
    if (!inEditor) helpOpen = false;
    inputRouter.setModalOpen(inEditor && helpOpen);
    const transformTool = state.transformTool ?? null;
    workbench.root.style.display = inEditor ? '' : 'none';
    sceneToolOverlay.style.display = inEditor ? 'flex' : 'none';
    for (const [tool, button] of Object.entries(toolButtons) as Array<[LocalEditorBrowserTransformTool, HTMLButtonElement]>) {
      button.disabled = disabled;
      LocalEditorShared.applyButtonActiveState(button, transformTool?.activeTool === tool);
    }
    for (const [space, button] of Object.entries(spaceButtons) as Array<[LocalEditorBrowserTransformSpace, HTMLButtonElement]>) {
      button.disabled = disabled;
      LocalEditorShared.applyButtonActiveState(button, transformTool?.activeSpace === space);
    }
    sceneHelpButton.disabled = disabled;
    viewPlaneButton.disabled = disabled || transformTool?.activeTool !== 'move';
    LocalEditorShared.applyButtonActiveState(viewPlaneButton, transformTool?.activeTool === 'move' && transformTool?.activeConstraint === 'view-plane');
    undoButton.disabled = disabled || !state.session?.canUndo;
    redoButton.disabled = disabled || !state.session?.canRedo;
    LocalEditorShared.applyButtonActiveState(sceneHelpButton, inEditor && helpOpen);
    shortcutHelpPanel.style.display = inEditor && helpOpen ? '' : 'none';
    dirtyBadge.style.display = inEditor && state.session?.dirty ? 'inline-flex' : 'none';
    const dragSuffix = transformTool?.dragPhase === 'dragging'
      ? ` | dragging ${transformTool.draggingNodeId ?? 'selection'}`
      : '';
    status.textContent = [
      state.status,
      state.session?.dirty ? '*' : '',
      LocalEditorShared.formatAuthoringSourceLabel(state.session?.source),
      state.summary,
    ].filter(Boolean).join(' | ');
    status.textContent += dragSuffix;
    sceneToolStatus.textContent = transformTool?.dragPhase === 'dragging'
      ? `正在拖拽 ${transformTool.draggingNodeId ?? '选择对象'}`
      : `${LocalEditorShared.toTransformToolLabel(transformTool?.activeTool ?? 'select')} · ${LocalEditorShared.toTransformSpaceLabel(transformTool?.activeSpace ?? 'world')}${transformTool?.activeConstraint === 'view-plane' ? ' · 视图平面' : ''}`;
    sceneMouseHint.textContent = transformTool?.activeConstraint === 'view-plane'
      ? '视图平面移动 · 左键拖拽选中对象 · Esc 取消'
      : '左键选择 · 空白拖拽框选 · 中键平移 · Alt+左键环绕 · 右键飞行 · 滚轮缩放';
    const boxSelection = state.boxSelection;
    if (inEditor && boxSelection?.active) {
      boxSelectionOverlay.style.display = '';
      boxSelectionOverlay.style.left = `${boxSelection.left}px`;
      boxSelectionOverlay.style.top = `${boxSelection.top}px`;
      boxSelectionOverlay.style.width = `${boxSelection.width}px`;
      boxSelectionOverlay.style.height = `${boxSelection.height}px`;
    } else {
      boxSelectionOverlay.style.display = 'none';
    }

    if (!inEditor) return;
    const hierarchyDescriptor = panelRegistry.getActivePanel('left');
    const inspectorDescriptor = panelRegistry.getActivePanel('right');
    hierarchyPanel.dataset.editorPanelId = hierarchyDescriptor?.id ?? 'hierarchy';
    inspectorPanel.dataset.editorPanelId = inspectorDescriptor?.id ?? 'inspector';
    LocalEditorPanels.renderHierarchyPanel(doc, hierarchyPanel, state, hierarchyRename, hierarchyDrop);
    LocalEditorPanels.renderWorkbenchBottomDockPanel(doc, assetPanel, state, panelRegistry.getBottomDockTab(), panelRegistry.getPanels('bottom'));
    LocalEditorPanels.renderInspectorPanel(doc, inspectorPanel, state);
  };

  return {
    update(state) {
      render(state);
    },
    dispose() {
      hostChrome.remove();
      workbench.root.remove();
      boxSelectionOverlay.remove();
      shortcutHelpPanel.remove();
      inputRouter.dispose();
      doc.removeEventListener('keydown', onKeyDown);
    },
  };
}
