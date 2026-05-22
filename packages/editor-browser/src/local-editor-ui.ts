import * as LocalEditorPanels from './local-editor-ui-panels';
import { createLocalEditorHierarchyController } from './local-editor-ui-hierarchy-controller';
import { createLocalEditorContextMenuController } from './local-editor-ui-context-menu';
export {
  createLocalEditorHierarchyBlankMenu,
  createLocalEditorHierarchyDeleteShortcutAction,
  createLocalEditorHierarchyNodeMenu,
} from './local-editor-ui-hierarchy-actions';
export {
  createLocalEditorHierarchyController,
} from './local-editor-ui-hierarchy-controller';
export {
  canLocalEditorHierarchyNodeHaveChildren,
  createLocalEditorHierarchyTreeModel,
  isLocalEditorHierarchyNodeMovable,
} from './local-editor-ui-hierarchy-tree';
export {
  createLocalEditorContextMenuController,
  type LocalEditorContextMenuController,
  type LocalEditorContextMenuOpenInput,
} from './local-editor-ui-context-menu';
export type {
  LocalEditorHierarchyAction,
  LocalEditorHierarchyActionInput,
  LocalEditorHierarchyMenuDefinition,
} from './local-editor-ui-hierarchy-actions';
export type {
  LocalEditorHierarchyController,
  LocalEditorHierarchyControllerOptions,
} from './local-editor-ui-hierarchy-controller';
export type {
  LocalEditorHierarchyDropPlacement,
  LocalEditorHierarchyDropResolution,
  LocalEditorHierarchyTreeModel,
  LocalEditorHierarchyTreeNode,
  LocalEditorHierarchyTreeOptions,
} from './local-editor-ui-hierarchy-tree';
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
  LocalEditorBrowserInspectorCommitMode,
  LocalEditorBrowserInspectorControlKind,
  LocalEditorBrowserInspectorEditSource,
  LocalEditorBrowserInspectorPersistenceMode,
  LocalEditorBrowserInspectorProperty,
  LocalEditorBrowserTransformConstraint,
  LocalEditorBrowserTransformSpace,
  LocalEditorBrowserTransformTool,
  LocalEditorBrowserUi,
  LocalEditorBrowserUiOptions,
  LocalEditorBrowserUiPropertyInput,
  LocalEditorBrowserUiState,
} from './local-editor-ui-types';

export {
  applyLocalEditorBrowserInspectorControlBinding,
  createLocalEditorBrowserInspectorControlRegistry,
  resolveLocalEditorBrowserInspectorControlRegistration,
} from './local-editor-ui-panels';
export type { LocalEditorBrowserInspectorRenderOptions } from './local-editor-ui-panels';

export type {
  LocalEditorBottomDockTab,
  LocalEditorBrowserAuthoringSource,
  LocalEditorBrowserHierarchySelectionInput,
  LocalEditorBrowserHistoryEntry,
  LocalEditorBrowserHistoryView,
  LocalEditorBrowserInspectorCommitMode,
  LocalEditorBrowserInspectorConflictStrategy,
  LocalEditorBrowserInspectorControlBindingOptions,
  LocalEditorBrowserInspectorControlKind,
  LocalEditorBrowserInspectorControlRegistration,
  LocalEditorBrowserInspectorControlRenderContext,
  LocalEditorBrowserInspectorControlRenderer,
  LocalEditorBrowserInspectorEditSource,
  LocalEditorBrowserInspectorObject,
  LocalEditorBrowserInspectorOptions,
  LocalEditorBrowserInspectorPersistenceMode,
  LocalEditorBrowserInspectorProperty,
  LocalEditorBrowserInspectorSection,
  LocalEditorBrowserSceneGraphCreateGroupIntent,
  LocalEditorBrowserSceneGraphDeleteIntent,
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserSceneGraphDropPlacement,
  LocalEditorBrowserSceneGraphGroupSelectionIntent,
  LocalEditorBrowserSceneGraphMoveIntent,
  LocalEditorBrowserSceneGraphMovePlacement,
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
  LocalEditorContextAction,
  LocalEditorContextMenuItem,
} from './local-editor-ui-types';

function readInspectorInputValue(input: HTMLInputElement | HTMLSelectElement): number | string | boolean | Record<string, unknown> | null {
  const control = input.dataset.serializedControl;
  const valueType = input.dataset.serializedValueType;
  if ((control === 'vec2' || control === 'vec3') && input instanceof HTMLInputElement) {
    return readInspectorVectorInputValue(input);
  }
  if (control === 'enum' && input instanceof HTMLSelectElement) {
    const option = input.selectedOptions.item(0);
    const encoded = option?.dataset.serializedOptionValue;
    if (encoded != null) {
      try {
        return JSON.parse(encoded) as string | number | boolean | Record<string, unknown> | null;
      } catch {
        return option?.value ?? input.value;
      }
    }
  }
  if (input instanceof HTMLInputElement && input.type === 'checkbox') return input.checked;
  if (control === 'boolean' || valueType === 'boolean') return input.value === 'true';
  if (control === 'number' || valueType === 'number') return Number(input.value);
  if (control === 'color' && input instanceof HTMLInputElement && input.type === 'color') {
    const value = input.value.replace('#', '');
    const numeric = Number.parseInt(value, 16);
    if (!Number.isFinite(numeric)) return null;
    return {
      r: ((numeric >> 16) & 255) / 255,
      g: ((numeric >> 8) & 255) / 255,
      b: (numeric & 255) / 255,
    };
  }
  return input.value;
}

function readInspectorVectorInputValue(input: HTMLInputElement): Record<string, number> {
  const wrapper = input.closest<HTMLElement>('[data-inspector-vector-control]');
  const values: Record<string, number> = {};
  const fields = wrapper
    ? Array.from(wrapper.querySelectorAll<HTMLInputElement>('input[data-serialized-vector-axis]'))
    : [input];
  for (const field of fields) {
    const axis = field.dataset.serializedVectorAxis;
    if (!axis) continue;
    const numeric = Number(field.value);
    values[axis] = Number.isFinite(numeric) ? numeric : 0;
  }
  return values;
}

function createInspectorPropertyInput(
  input: HTMLInputElement | HTMLSelectElement,
  source: LocalEditorBrowserInspectorEditSource,
): LocalEditorBrowserUiPropertyInput | null {
  if (!input.dataset.serializedPath || !input.dataset.serializedTargetId) return null;
  const targetIds = input.dataset.serializedTargetIds
    ? input.dataset.serializedTargetIds.split(',').filter(Boolean)
    : undefined;
  return {
    targetId: input.dataset.serializedTargetId,
    targetIds,
    path: input.dataset.serializedPath,
    value: readInspectorInputValue(input),
    control: input.dataset.serializedControl as LocalEditorBrowserInspectorControlKind | undefined,
    valueType: input.dataset.serializedValueType as LocalEditorBrowserInspectorProperty['valueType'] | undefined,
    commitMode: input.dataset.serializedCommitMode as LocalEditorBrowserInspectorCommitMode | undefined,
    persistence: input.dataset.serializedPersistence as LocalEditorBrowserInspectorPersistenceMode | undefined,
    source: (input.dataset.serializedEditSource as LocalEditorBrowserInspectorEditSource | undefined) ?? source,
  };
}

function readInspectorCommitMode(input: HTMLInputElement | HTMLSelectElement): LocalEditorBrowserInspectorCommitMode {
  return (input.dataset.serializedCommitMode as LocalEditorBrowserInspectorCommitMode | undefined) ?? 'live';
}

function readInspectorImmediateSource(input: HTMLInputElement | HTMLSelectElement): LocalEditorBrowserInspectorEditSource {
  if (input instanceof HTMLSelectElement) return 'select';
  if (input.type === 'checkbox') return 'toggle';
  if (input.type === 'color') return 'color';
  return 'input';
}

export function createLocalEditorBrowserUi<TDocument = unknown>(
  options: LocalEditorBrowserUiOptions<TDocument> = {},
): LocalEditorBrowserUi<TDocument> {
  const doc = options.document ?? document;
  const root = options.root ?? doc.body;
  const callbacks = options.callbacks ?? {};
  ensureLocalEditorTheme(doc);
  const inputRouter = createLocalEditorWorkbenchInputRouter(doc);
  const contextMenu = createLocalEditorContextMenuController(doc, (open) => {
    inputRouter.setContextMenuOpen(open);
  });
  let currentState: LocalEditorBrowserUiState<TDocument> | null = null;
  let inspectorFilter = '';
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
  shortcutHelpPanel.classList.add(LOCAL_EDITOR_THEME_CLASS);
  root.appendChild(shortcutHelpPanel);

  enterEditorButton.addEventListener('click', () => callbacks.onEnterEditor?.());
  saveButton.addEventListener('click', () => callbacks.onSaveScene?.());
  saveAndRunButton.addEventListener('click', () => callbacks.onSaveAndRunGame?.());
  discardRunButton.addEventListener('click', () => callbacks.onDiscardAndRunGame?.());
  undoButton.addEventListener('click', () => callbacks.onUndo?.());
  redoButton.addEventListener('click', () => callbacks.onRedo?.());
  const setShortcutHelpOpen = (open: boolean): void => {
    if (open) contextMenu.close();
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

  const hierarchyController = createLocalEditorHierarchyController<TDocument>({
    doc,
    panel: hierarchyPanel,
    callbacks,
    inputRouter,
    contextMenu,
    getState: () => currentState,
    requestRender: () => {
      if (currentState) render(currentState);
    },
    onBeforeOpenContextMenu: () => {
      if (helpOpen) setShortcutHelpOpen(false);
    },
  });

  assetPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorAssetFilter == null) return;
    callbacks.onAssetFilterChange?.(input.value);
  });

  inspectorPanel.addEventListener('input', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorInspectorSearch != null) {
      inspectorFilter = input.value;
      if (currentState) render(currentState);
      return;
    }
    if (input?.type === 'checkbox' || input?.type === 'color') return;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    if (readInspectorCommitMode(input) !== 'live') return;
    const propertyInput = createInspectorPropertyInput(input, 'input');
    if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
  });

  inspectorPanel.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
      ? event.target
      : null;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    if (input instanceof HTMLInputElement && (input.type === 'text' || input.type === 'number')) {
      if (readInspectorCommitMode(input) !== 'change') return;
    }
    const propertyInput = createInspectorPropertyInput(input, readInspectorImmediateSource(input));
    if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
  });

  inspectorPanel.addEventListener('focusout', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.serializedPath || !input.dataset.serializedTargetId) return;
    if (readInspectorCommitMode(input) !== 'blur') return;
    const propertyInput = createInspectorPropertyInput(input, 'input');
    if (propertyInput) callbacks.onPropertyInput?.(propertyInput);
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
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
      hierarchyController.handleDeleteShortcut(event);
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

  function captureEditableFocus(doc: Document): { selector: string; value: string | null } | null {
    const active = doc.activeElement instanceof HTMLInputElement ? doc.activeElement : null;
    if (!active) return null;
    if (active.dataset.editorHierarchyRenameInput) {
      return {
        selector: `[data-editor-hierarchy-rename-input="${cssEscape(active.dataset.editorHierarchyRenameInput)}"]`,
        value: active.value,
      };
    }
    if (active.dataset.serializedPath && active.dataset.serializedTargetId) {
      return {
        selector: [
          `input[data-serialized-path="${cssEscape(active.dataset.serializedPath)}"]`,
          `[data-serialized-target-id="${cssEscape(active.dataset.serializedTargetId)}"]`,
        ].join(''),
        value: active.value,
      };
    }
    if (active.dataset.editorInspectorSearch != null) {
      return { selector: 'input[data-editor-inspector-search]', value: active.value };
    }
    if (active.dataset.editorAssetFilter != null) {
      return { selector: 'input[data-editor-asset-filter]', value: active.value };
    }
    return null;
  }

  function restoreEditableFocus(doc: Document, snapshot: { selector: string; value: string | null } | null): void {
    if (!snapshot) return;
    const input = doc.querySelector<HTMLInputElement>(snapshot.selector);
    if (!input) return;
    input.focus({ preventScroll: true });
    if (snapshot.value != null && input.value === snapshot.value) {
      const position = input.value.length;
      try {
        input.setSelectionRange(position, position);
      } catch {
        // Number/search inputs may reject text selection APIs.
      }
    }
  }

  function cssEscape(value: string): string {
    return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/["\\]/g, '\\$&');
  }

  const render = (state: LocalEditorBrowserUiState<TDocument>): void => {
    currentState = state;
    const focusSnapshot = captureEditableFocus(doc);
    const inEditor = state.mode === 'editor';
    const disabled = state.busy;
    if (!inEditor || disabled) contextMenu.close();
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
    hierarchyController.render(state);
    LocalEditorPanels.renderWorkbenchBottomDockPanel(doc, assetPanel, state, panelRegistry.getBottomDockTab(), panelRegistry.getPanels('bottom'));
    LocalEditorPanels.renderInspectorPanel(doc, inspectorPanel, state, inspectorFilter, options.inspector);
    restoreEditableFocus(doc, focusSnapshot);
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
      hierarchyController.dispose();
      contextMenu.dispose();
      inputRouter.dispose();
      doc.removeEventListener('keydown', onKeyDown);
    },
  };
}
