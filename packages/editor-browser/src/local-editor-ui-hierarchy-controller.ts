import type { SelectionCommand } from '@fps-games/editor-core';
import {
  createLocalEditorHierarchyBlankMenu,
  createLocalEditorHierarchyCopyShortcutAction,
  createLocalEditorHierarchyDeleteShortcutAction,
  createLocalEditorHierarchyDuplicateShortcutAction,
  createLocalEditorHierarchyNodeMenu,
  createLocalEditorHierarchyPasteShortcutAction,
  createLocalEditorHierarchySelectAllShortcutAction,
  type LocalEditorHierarchyAction,
} from './local-editor-ui-hierarchy-actions';
import {
  canLocalEditorHierarchyNodeHaveChildren,
  createLocalEditorHierarchyTreeModel,
  type LocalEditorHierarchyDropResolution,
  isLocalEditorHierarchyNodeMovable,
  type LocalEditorHierarchyTreeModel,
  type LocalEditorHierarchyTreeNode,
} from './local-editor-ui-hierarchy-tree';
import { renderLocalEditorHierarchyPanel } from './local-editor-ui-hierarchy-view';
import type { LocalEditorContextMenuController } from './local-editor-ui-context-menu';
import type { LocalEditorWorkbenchInputRouter } from './local-editor-ui-input-router';
import type {
  LocalEditorBrowserSceneGraphDropIntent,
  LocalEditorBrowserSceneGraphDropPlacement,
  LocalEditorBrowserHierarchyContextActionRegistration,
  LocalEditorBrowserUiCallbacks,
  LocalEditorBrowserUiState,
  LocalEditorContextAction,
} from './local-editor-ui-types';

export interface LocalEditorHierarchyController<TDocument = unknown> {
  render(state: LocalEditorBrowserUiState<TDocument>): void;
  handleEditShortcut(event: KeyboardEvent): boolean;
  handleDeleteShortcut(event: KeyboardEvent): boolean;
  dispose(): void;
}

export interface LocalEditorHierarchyControllerOptions<TDocument = unknown> {
  doc: Document;
  panel: HTMLElement;
  callbacks: LocalEditorBrowserUiCallbacks;
  inputRouter: LocalEditorWorkbenchInputRouter;
  contextMenu: LocalEditorContextMenuController;
  getState: () => LocalEditorBrowserUiState<TDocument> | null;
  requestRender: () => void;
  onBeforeOpenContextMenu?: () => void;
  contextActions?: readonly LocalEditorBrowserHierarchyContextActionRegistration<TDocument>[];
}

export function createLocalEditorHierarchyController<TDocument = unknown>(
  options: LocalEditorHierarchyControllerOptions<TDocument>,
): LocalEditorHierarchyController<TDocument> {
  const { doc, panel, callbacks, inputRouter, contextMenu, getState, requestRender } = options;
  const collapsedIds = new Set<string>();
  let hierarchyRename: { id: string; value: string } | null = null;
  let hierarchyDrag: { id: string } | null = null;
  let hierarchyDrop: LocalEditorBrowserSceneGraphDropIntent | null = null;
  let hierarchyRootDrop = false;
  let hierarchyShortcutScopeActive = false;
  let hierarchyClipboard: { ids: string[]; activeId: string | null } | null = null;
  let hierarchySearch = '';
  let currentModel: LocalEditorHierarchyTreeModel | null = null;
  let lastRenderedActiveId: string | null | undefined;
  let pendingHierarchyScrollId: string | null = null;

  const getModel = (state: LocalEditorBrowserUiState<TDocument>): LocalEditorHierarchyTreeModel => {
    if (currentModel) return currentModel;
    currentModel = createModel(state);
    return currentModel;
  };

  const render = (state: LocalEditorBrowserUiState<TDocument>): void => {
    if (hierarchyRename && !state.hierarchy.some(item => item.id === hierarchyRename?.id)) hierarchyRename = null;
    const activeIdChanged = state.activeId !== lastRenderedActiveId;
    if (activeIdChanged) {
      pendingHierarchyScrollId = null;
      expandActiveHierarchyPath(state);
    }
    currentModel = createModel(state);
    renderLocalEditorHierarchyPanel(doc, panel, {
      model: currentModel,
      rename: hierarchyRename,
      drop: hierarchyDrop,
      rootDrop: hierarchyRootDrop,
      searchQuery: hierarchySearch,
    });
    if (activeIdChanged && state.activeId && shouldAutoScrollActiveHierarchyNode()) {
      scheduleActiveHierarchyScroll(state.activeId);
    }
    lastRenderedActiveId = state.activeId;
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[data-editor-hierarchy-rename-input]')) return;
    const toggle = target?.closest<HTMLElement>('[data-editor-hierarchy-toggle]')?.dataset.editorHierarchyToggle;
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      toggleExpanded(toggle);
      return;
    }
    const createGroupButton = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-create-group]');
    if (createGroupButton) {
      const state = getState();
      const parentId = state?.activeId ?? null;
      if (parentId) expandNode(parentId);
      callbacks.onSceneGraphCreateGroup?.({
        parentId,
        activeId: parentId,
        name: 'Empty',
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
      return;
    }
    if (shouldClearSelectionFromBlankClick(event, target)) {
      event.preventDefault();
      submitSelectionCommand({ type: 'selection.clear', label: 'Clear Selection' });
    }
  };

  const onContextMenu = (event: MouseEvent): void => {
    openHierarchyContextMenu(event);
  };

  const onDocumentPointerDown = (event: PointerEvent): void => {
    hierarchyShortcutScopeActive = isEventInsideHierarchyPanel(event);
  };

  const onDocumentFocusIn = (event: FocusEvent): void => {
    hierarchyShortcutScopeActive = isEventInsideHierarchyPanel(event);
  };

  const onDoubleClick = (event: MouseEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('[data-editor-hierarchy-toggle]')) return;
    const hierarchyButton = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const id = hierarchyButton?.dataset.editorHierarchyId;
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    callbacks.onSelectHierarchyItem?.({ id, additive: false, toggle: false });
    callbacks.onFocusSelection?.();
  };

  const onInput = (event: Event): void => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorHierarchySearch != null) {
      hierarchySearch = input.value;
      requestRender();
      return;
    }
    if (!input?.dataset.editorHierarchyRenameInput || !hierarchyRename) return;
    hierarchyRename = {
      id: input.dataset.editorHierarchyRenameInput,
      value: input.value,
    };
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.dataset.editorHierarchySearch != null) {
      if (event.key !== 'Escape' || hierarchySearch.length === 0) return;
      event.preventDefault();
      hierarchySearch = '';
      requestRender();
      return;
    }
    if (!input?.dataset.editorHierarchyRenameInput) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitHierarchyRename(input.dataset.editorHierarchyRenameInput, input.value);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      hierarchyRename = null;
      requestRender();
    }
  };

  const onFocusOut = (event: FocusEvent): void => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input?.dataset.editorHierarchyRenameInput) return;
    commitHierarchyRename(input.dataset.editorHierarchyRenameInput, input.value);
  };

  const onDragStart = (event: DragEvent): void => {
    const state = getState();
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const id = button?.dataset.editorHierarchyId;
    if (!id || !state) return;
    const model = getModel(state);
    const node = model.getNode(id);
    if (!isLocalEditorHierarchyNodeMovable(node)) {
      event.preventDefault();
      return;
    }
    hierarchyDrag = { id };
    const draggedIds = resolveDraggedIds(state, model, id);
    event.dataTransfer?.setData('text/plain', draggedIds.join(','));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (event: DragEvent): void => {
    const state = getState();
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const targetId = button?.dataset.editorHierarchyId;
    const draggedIds = readDraggedIds(event);
    if (!state || draggedIds.length === 0) return;
    const model = getModel(state);
    if (!targetId) {
      handleRootDragOver(event, model, draggedIds);
      return;
    }
    if (draggedIds.includes(targetId)) return;
    event.preventDefault();
    const placement = readHierarchyDropPlacementForNode(event, button, model.getNode(targetId));
    const resolved = model.resolveDrop({ draggedIds, targetId, placement });
    if (!resolved.ok) {
      const changed = hierarchyDrop !== null || hierarchyRootDrop;
      hierarchyDrop = null;
      hierarchyRootDrop = false;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
      if (changed) requestRender();
      return;
    }
    const nextDrop = {
      draggedId: resolved.draggedIds[0] ?? draggedIds[0]!,
      targetId,
      placement,
      preserveWorldTransform: true,
    };
    const changed = !areHierarchyDropsEqual(hierarchyDrop, nextDrop) || hierarchyRootDrop;
    hierarchyDrop = nextDrop;
    hierarchyRootDrop = false;
    if (event.dataTransfer) {
      const canSubmitDrop = typeof callbacks.onSceneGraphMove === 'function' || placement === 'inside';
      event.dataTransfer.dropEffect = canSubmitDrop ? 'move' : 'none';
    }
    if (changed) requestRender();
  };

  const onDragLeave = (event: DragEvent): void => {
    if (!panel.contains(event.relatedTarget as Node | null)) {
      hierarchyDrop = null;
      hierarchyRootDrop = false;
      requestRender();
    }
  };

  const onDragEnd = (): void => {
    hierarchyDrag = null;
    hierarchyDrop = null;
    hierarchyRootDrop = false;
    requestRender();
  };

  const onDrop = (event: DragEvent): void => {
    const state = getState();
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const targetId = button?.dataset.editorHierarchyId;
    const draggedIds = readDraggedIds(event);
    if (!state || draggedIds.length === 0) return;
    const model = getModel(state);
    if (!targetId) {
      if (hierarchyDrop) {
        const pendingDrop = hierarchyDrop;
        event.preventDefault();
        const resolved = model.resolveDrop({
          draggedIds,
          targetId: pendingDrop.targetId,
          placement: pendingDrop.placement,
        });
        hierarchyDrag = null;
        hierarchyDrop = null;
        hierarchyRootDrop = false;
        if (resolved.ok) {
          expandDropParent(resolved);
          submitResolvedDrop(resolved, pendingDrop.targetId, pendingDrop.placement, draggedIds);
        } else {
          requestRender();
        }
        return;
      }
      handleRootDrop(event, model, draggedIds);
      return;
    }
    if (draggedIds.includes(targetId)) return;
    event.preventDefault();
    const placement = readHierarchyDropPlacementForNode(event, button, model.getNode(targetId));
    const resolved = model.resolveDrop({ draggedIds, targetId, placement });
    hierarchyDrag = null;
    hierarchyDrop = null;
    hierarchyRootDrop = false;
    if (!resolved.ok) {
      requestRender();
      return;
    }
    expandDropParent(resolved);
    submitResolvedDrop(resolved, targetId, placement, draggedIds);
  };

  panel.addEventListener('click', onClick);
  panel.addEventListener('contextmenu', onContextMenu);
  panel.addEventListener('dblclick', onDoubleClick);
  panel.addEventListener('input', onInput);
  panel.addEventListener('keydown', onKeyDown);
  panel.addEventListener('focusout', onFocusOut);
  panel.addEventListener('dragstart', onDragStart);
  panel.addEventListener('dragover', onDragOver);
  panel.addEventListener('dragleave', onDragLeave);
  panel.addEventListener('dragend', onDragEnd);
  panel.addEventListener('drop', onDrop);
  doc.addEventListener('pointerdown', onDocumentPointerDown, { capture: true });
  doc.addEventListener('focusin', onDocumentFocusIn, { capture: true });

  return {
    render,
    handleDeleteShortcut(event) {
      return handleDeleteShortcut(event);
    },
    handleEditShortcut(event) {
      return handleEditShortcut(event);
    },
    dispose() {
      panel.removeEventListener('click', onClick);
      panel.removeEventListener('contextmenu', onContextMenu);
      panel.removeEventListener('dblclick', onDoubleClick);
      panel.removeEventListener('input', onInput);
      panel.removeEventListener('keydown', onKeyDown);
      panel.removeEventListener('focusout', onFocusOut);
      panel.removeEventListener('dragstart', onDragStart);
      panel.removeEventListener('dragover', onDragOver);
      panel.removeEventListener('dragleave', onDragLeave);
      panel.removeEventListener('dragend', onDragEnd);
      panel.removeEventListener('drop', onDrop);
      doc.removeEventListener('pointerdown', onDocumentPointerDown, { capture: true });
      doc.removeEventListener('focusin', onDocumentFocusIn, { capture: true });
    },
  };

  function handleDeleteShortcut(event: KeyboardEvent): boolean {
    const state = getState();
    if (!state) return false;
    const action = createLocalEditorHierarchyDeleteShortcutAction({
      state,
      model: getModel(state),
      hasDuplicateHandler: hasDuplicateHandler(),
      hasGroupSelectionHandler: typeof callbacks.onSceneGraphGroupSelection === 'function',
    });
    if (!action) return false;
    event.preventDefault();
    submitHierarchyAction(action);
    return true;
  }

  function handleEditShortcut(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    if (key === 'delete' || key === 'backspace') return handleDeleteShortcut(event);
    if (event.altKey || (!event.metaKey && !event.ctrlKey)) return false;
    if (key === 'a' && (event.shiftKey || !isHierarchyShortcutScope(event))) return false;
    const state = getState();
    if (!state) return false;
    const input = {
      state,
      model: getModel(state),
      clipboardIds: hierarchyClipboard?.ids ?? null,
      clipboardActiveId: hierarchyClipboard?.activeId ?? null,
      hasDuplicateHandler: hasDuplicateHandler(),
      hasGroupSelectionHandler: typeof callbacks.onSceneGraphGroupSelection === 'function',
    };
    const action = key === 'd'
      ? createLocalEditorHierarchyDuplicateShortcutAction(input)
      : key === 'c'
        ? createLocalEditorHierarchyCopyShortcutAction(input)
        : key === 'v'
          ? createLocalEditorHierarchyPasteShortcutAction(input)
          : key === 'a'
            ? createLocalEditorHierarchySelectAllShortcutAction(input)
          : null;
      if (!action) return false;
      event.preventDefault();
      submitHierarchyAction(action);
      return true;
  }

  function createModel(state: LocalEditorBrowserUiState<TDocument>): LocalEditorHierarchyTreeModel {
    return createLocalEditorHierarchyTreeModel(state.hierarchy, state.selectedIds, state.activeId, {
      collapsedIds,
      defaultExpanded: true,
    });
  }

  function resolveDraggedIds(
    state: LocalEditorBrowserUiState<TDocument>,
    model: LocalEditorHierarchyTreeModel,
    draggedId: string,
  ): string[] {
    const selectedIds = state.selectedIds.includes(draggedId) ? state.selectedIds : [draggedId];
    return model.getTopLevelSelection(selectedIds);
  }

  function readDraggedIds(event: DragEvent): string[] {
    const dataTransferIds = event.dataTransfer?.getData('text/plain')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean) ?? [];
    return dataTransferIds.length > 0 ? dataTransferIds : hierarchyDrag?.id ? [hierarchyDrag.id] : [];
  }

  function resolveRootDraggedIds(model: LocalEditorHierarchyTreeModel, draggedIds: readonly string[]): string[] {
    const ids = model.getTopLevelSelection(draggedIds);
    return ids.filter(id => isLocalEditorHierarchyNodeMovable(model.getNode(id)));
  }

  function handleRootDragOver(
    event: DragEvent,
    model: LocalEditorHierarchyTreeModel,
    draggedIds: readonly string[],
  ): void {
    const ids = resolveRootDraggedIds(model, draggedIds);
    if (ids.length === 0) return;
    event.preventDefault();
    const changed = hierarchyDrop !== null || !hierarchyRootDrop;
    hierarchyDrop = null;
    hierarchyRootDrop = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = callbacks.onSceneGraphMove ? 'move' : 'none';
    if (changed) requestRender();
  }

  function handleRootDrop(
    event: DragEvent,
    model: LocalEditorHierarchyTreeModel,
    draggedIds: readonly string[],
  ): void {
    const ids = resolveRootDraggedIds(model, draggedIds);
    if (ids.length === 0) return;
    event.preventDefault();
    hierarchyDrag = null;
    hierarchyDrop = null;
    hierarchyRootDrop = false;
    callbacks.onSceneGraphMove?.({
      ids,
      targetId: null,
      placement: 'root',
      preserveWorldTransform: true,
    });
    requestRender();
  }

  function toggleExpanded(id: string): void {
    if (collapsedIds.has(id)) collapsedIds.delete(id);
    else collapsedIds.add(id);
    requestRender();
  }

  function expandNode(id: string | null | undefined): void {
    if (!id) return;
    collapsedIds.delete(id);
  }

  function expandActiveHierarchyPath(state: LocalEditorBrowserUiState<TDocument>): void {
    if (!state.activeId) return;
    const model = createModel(state);
    if (!model.getNode(state.activeId)) return;
    for (const ancestor of model.getAncestors(state.activeId)) {
      collapsedIds.delete(ancestor.id);
    }
  }

  function shouldAutoScrollActiveHierarchyNode(): boolean {
    return !hierarchyRename && !hierarchyDrag && !hierarchyDrop && !hierarchyRootDrop;
  }

  function scheduleActiveHierarchyScroll(activeId: string): void {
    pendingHierarchyScrollId = activeId;
    setTimeout(() => {
      if (pendingHierarchyScrollId !== activeId) return;
      pendingHierarchyScrollId = null;
      const row = findHierarchyRow(activeId);
      if (!row) return;
      try {
        row.scrollIntoView({ block: 'center', inline: 'nearest' });
      } catch {
        row.scrollIntoView();
      }
    }, 0);
  }

  function findHierarchyRow(id: string): HTMLElement | null {
    for (const row of panel.querySelectorAll<HTMLElement>('[data-editor-hierarchy-id]')) {
      if (row.dataset.editorHierarchyId === id) return row;
    }
    return null;
  }

  function expandDropParent(resolved: LocalEditorHierarchyDropResolution): void {
    if (resolved.placement === 'inside') expandNode(resolved.parentId);
  }

  function commitHierarchyRename(id: string, value: string): void {
    if (!hierarchyRename || hierarchyRename.id !== id) return;
    const trimmed = value.trim();
    const state = getState();
    const item = state?.hierarchy.find(candidate => candidate.id === id) ?? null;
    hierarchyRename = null;
    if (trimmed && item && trimmed !== item.label) callbacks.onSceneGraphRename?.({ id, name: trimmed });
    requestRender();
  }

  function openHierarchyContextMenu(event: MouseEvent): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target || inputRouter.isEditableTarget(target)) return;
    const state = getState();
    if (!state || state.mode !== 'editor' || state.busy) return;
    event.preventDefault();
    event.stopPropagation();
    options.onBeforeOpenContextMenu?.();
    const hadHierarchyDrop = hierarchyDrop !== null;
    hierarchyDrag = null;
    hierarchyDrop = null;
    hierarchyRootDrop = false;

    const model = getModel(state);
    const hierarchyButton = target.closest<HTMLButtonElement>('[data-editor-hierarchy-id]');
    const node = model.getNode(hierarchyButton?.dataset.editorHierarchyId);
    if (node && !state.selectedIds.includes(node.id) && isNodeSelectable(node)) {
      callbacks.onSelectHierarchyItem?.({ id: node.id, additive: false, toggle: false });
    }
    const menu = node
      ? createLocalEditorHierarchyNodeMenu({
          state,
          model,
          node,
          clipboardIds: hierarchyClipboard?.ids ?? null,
          clipboardActiveId: hierarchyClipboard?.activeId ?? null,
          hasDuplicateHandler: hasDuplicateHandler(),
          hasGroupSelectionHandler: typeof callbacks.onSceneGraphGroupSelection === 'function',
          contextActions: options.contextActions,
        })
      : createLocalEditorHierarchyBlankMenu({
          state,
          model,
          clipboardIds: hierarchyClipboard?.ids ?? null,
          clipboardActiveId: hierarchyClipboard?.activeId ?? null,
          hasDuplicateHandler: hasDuplicateHandler(),
          hasGroupSelectionHandler: typeof callbacks.onSceneGraphGroupSelection === 'function',
          contextActions: options.contextActions,
        });

    contextMenu.open({
      x: event.clientX,
      y: event.clientY,
      items: menu.items,
      onAction(item) {
        const action = menu.actions.get(item.id);
        if (action) submitHierarchyAction(action);
      },
    });
    if (hadHierarchyDrop) requestRender();
  }

  function submitHierarchyAction(action: LocalEditorHierarchyAction): void {
    if (action.kind === 'begin-rename') {
      beginHierarchyRename(action.targetId);
      return;
    }
    if (action.kind === 'copy-selection') {
      hierarchyClipboard = {
        ids: action.targetIds,
        activeId: action.activeId && action.targetIds.includes(action.activeId)
          ? action.activeId
          : action.targetIds[action.targetIds.length - 1] ?? null,
      };
      return;
    }
    if (action.kind === 'group-selection') {
      callbacks.onSceneGraphGroupSelection?.(action.intent);
      return;
    }
    if (action.kind === 'selection-command') {
      submitSelectionCommand(action.command);
      return;
    }
    submitHierarchyContextAction(action.action);
  }

  function submitSelectionCommand(command: SelectionCommand): void {
    callbacks.onSelectionCommand?.(command);
  }

  function shouldClearSelectionFromBlankClick(event: MouseEvent, target: HTMLElement | null): boolean {
    if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
    if (!target?.closest('[data-editor-hierarchy-root-drop]')) return false;
    if (hierarchyRename || hierarchyDrag || hierarchyDrop || hierarchyRootDrop) return false;
    const state = getState();
    return (state?.selectedIds.length ?? 0) > 0;
  }

  function isHierarchyShortcutScope(event: KeyboardEvent): boolean {
    const target = event.target instanceof Node ? event.target : null;
    const activeElement = doc.activeElement;
    return hierarchyShortcutScopeActive
      || (target !== null && panel.contains(target))
      || (activeElement !== null && panel.contains(activeElement));
  }

  function isEventInsideHierarchyPanel(event: Event): boolean {
    const target = event.target instanceof Node ? event.target : null;
    return target !== null && panel.contains(target);
  }

  function submitHierarchyContextAction(action: LocalEditorContextAction): void {
    if (action.action === 'rename') return;
    if (action.action === 'create-group' || action.action === 'create-primitive') expandNode(action.parentId);
    if (callbacks.onContextAction) {
      callbacks.onContextAction(action);
      return;
    }
    if (action.action === 'focus') callbacks.onFocusSelection?.();
    else if (action.action === 'duplicate') {
      callbacks.onSceneGraphDuplicate?.({
        targetIds: action.targetIds,
        activeId: action.activeId ?? null,
      });
    } else if (action.action === 'paste') {
      callbacks.onSceneGraphDuplicate?.({
        targetIds: action.sourceIds,
        activeId: action.activeId ?? null,
      });
    }
    else if (action.action === 'create-group') {
      callbacks.onSceneGraphCreateGroup?.({
        parentId: action.parentId ?? null,
        activeId: action.activeId ?? null,
        name: 'Empty',
      });
    } else if (action.action === 'create-primitive') {
      callbacks.onSceneGraphCreatePrimitive?.({
        parentId: action.parentId ?? null,
        activeId: action.activeId ?? null,
        shape: action.shape,
        name: action.name,
      });
    } else if (action.action === 'delete') {
      callbacks.onSceneGraphDelete?.({
        ids: action.targetIds,
        activeId: action.activeId ?? null,
      });
    }
  }

  function hasDuplicateHandler(): boolean {
    return typeof callbacks.onSceneGraphDuplicate === 'function';
  }

  function beginHierarchyRename(id: string): void {
    const state = getState();
    const model = state ? getModel(state) : null;
    const node = model?.getNode(id) ?? null;
    if (!node || node.protected || node.item.locked || node.item.renamable === false) return;
    hierarchyRename = { id, value: node.label };
    requestRender();
  }

  function submitResolvedDrop(
    resolved: LocalEditorHierarchyDropResolution,
    targetId: string,
    placement: LocalEditorBrowserSceneGraphDropPlacement,
    draggedIds: readonly string[],
  ): void {
    if (callbacks.onSceneGraphMove) {
      callbacks.onSceneGraphMove({
        ids: resolved.draggedIds,
        targetId,
        placement,
        parentId: resolved.parentId,
        beforeId: resolved.beforeId,
        afterId: resolved.afterId,
        preserveWorldTransform: true,
      });
    } else if (placement === 'inside') {
      callbacks.onSceneGraphDrop?.({
        draggedId: resolved.draggedIds[0] ?? draggedIds[0]!,
        targetId,
        placement,
        preserveWorldTransform: true,
      });
    } else {
      requestRender();
    }
  }
}

function isNodeSelectable(node: { protected: boolean; item: { selectable?: boolean; locked?: boolean } }): boolean {
  return node.item.selectable !== false && node.item.locked !== true && node.protected !== true;
}

function readHierarchyDropPlacementForNode(
  event: DragEvent,
  target: HTMLElement,
  node: LocalEditorHierarchyTreeNode | null,
): LocalEditorBrowserSceneGraphDropPlacement {
  const rect = target.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  const edgeRatio = canLocalEditorHierarchyNodeHaveChildren(node) ? 0.12 : 0.25;
  if (offsetY < rect.height * edgeRatio) return 'before';
  if (offsetY > rect.height * (1 - edgeRatio)) return 'after';
  return 'inside';
}

function areHierarchyDropsEqual(
  left: LocalEditorBrowserSceneGraphDropIntent | null,
  right: LocalEditorBrowserSceneGraphDropIntent | null,
): boolean {
  return left?.draggedId === right?.draggedId
    && left?.targetId === right?.targetId
    && left?.placement === right?.placement
    && left?.preserveWorldTransform === right?.preserveWorldTransform;
}
