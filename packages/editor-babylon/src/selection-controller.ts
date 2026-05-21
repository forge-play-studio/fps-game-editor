import { createBrowserHost, type BrowserHost } from '@fps-games/editor-browser';
import type { SelectionController, SelectionSource } from '@fps-games/editor-protocol';
import type { RuntimeScene } from './types';

type SelectionMonitorLike = {
  isDragging?: boolean;
};

type NormalizeSelectionResult = {
  normalizedEntity: unknown;
  hasPersistentBinding: boolean;
};

type PendingSelectionContext =
  | {
      kind: 'viewport' | 'tree';
      token: number;
      createdAt: number;
      additive: boolean;
    }
  | null;

export interface EditorSelectionControllerOptions {
  host?: BrowserHost;
  getScene: () => RuntimeScene | null;
  getMonitor?: () => SelectionMonitorLike | null;
  shouldHandleViewportSelection?: () => boolean;
  normalizeSelection: (args: {
    source: SelectionSource;
    rawEntity: unknown;
  }) => NormalizeSelectionResult;
  onSelectionCommitted: (entity: unknown | null) => void;
  externalSelectionRootSelector?: string;
  externalSelectionInteractiveSelector?: string;
  setExternalPickingState?: (enabled: boolean) => boolean | void;
}

type SelectionTrackingCtx = {
  onPointerDown: (event: PointerEvent) => void;
};

const PENDING_SELECTION_CONTEXT_TTL_MS = 1000;

function getNodeIdentity(node: any): string | null {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.uniqueId === 'number' && Number.isFinite(node.uniqueId)) return `uid:${node.uniqueId}`;
  if (typeof node.id === 'string' && node.id.trim()) return `id:${node.id.trim()}`;
  return null;
}

function getNodeParentIdentity(node: any): string | null {
  const parent = node?.parent ?? null;
  if (!parent) return 'root';
  if (typeof parent.uniqueId === 'number' && Number.isFinite(parent.uniqueId)) return `uid:${parent.uniqueId}`;
  if (typeof parent.id === 'string' && parent.id.trim()) return `id:${parent.id.trim()}`;
  if (typeof parent.name === 'string' && parent.name.trim()) return `name:${parent.name.trim()}`;
  return null;
}

function collectHighlightMeshesFromNode(node: any): any[] {
  if (!node) return [];
  const result: any[] = [];
  if ('showBoundingBox' in node) result.push(node);
  const children = typeof node.getChildMeshes === 'function' ? node.getChildMeshes(false) : [];
  for (const mesh of children) {
    if (mesh && 'showBoundingBox' in mesh) result.push(mesh);
  }
  return result;
}

function isHostHTMLElement(target: EventTarget | null, win: Window): target is HTMLElement {
  const ElementCtor = (win as Window & typeof globalThis).HTMLElement ?? HTMLElement;
  return typeof ElementCtor === 'function' && target instanceof ElementCtor;
}

export function createEditorSelectionController(options: EditorSelectionControllerOptions): SelectionController {
  const host = options.host ?? createBrowserHost();
  let externalSelectionService: any = null;
  let selectedEntity: unknown | null = null;
  let selectedEntities: unknown[] = [];
  let highlightedMeshes = new Map<any, { showBoundingBox: boolean }>();
  let normalizingSelection = false;
  let selectionTrackingCtx: SelectionTrackingCtx | null = null;
  let pendingSelectionContext: PendingSelectionContext = null;
  let nextSelectionToken = 1;

  function clearSelectionHighlight(): void {
    for (const [mesh, state] of highlightedMeshes.entries()) {
      try {
        if (mesh && 'showBoundingBox' in mesh) mesh.showBoundingBox = state.showBoundingBox;
      } catch {}
    }
    highlightedMeshes = new Map();
  }

  function syncSelectionHighlight(): void {
    clearSelectionHighlight();
    const nextMeshes = new Map<any, { showBoundingBox: boolean }>();
    for (const entity of selectedEntities) {
      for (const mesh of collectHighlightMeshesFromNode(entity)) {
        try {
          const prevState = { showBoundingBox: !!mesh.showBoundingBox };
          mesh.showBoundingBox = true;
          nextMeshes.set(mesh, prevState);
        } catch {}
      }
    }
    highlightedMeshes = nextMeshes;
  }

  function createSelectionToken(): number {
    const token = nextSelectionToken;
    nextSelectionToken += 1;
    return token;
  }

  function setPendingSelectionContext(context: PendingSelectionContext): void {
    pendingSelectionContext = context;
  }

  function clearPendingSelectionContext(expectedToken?: number): void {
    if (expectedToken != null && pendingSelectionContext && pendingSelectionContext.token !== expectedToken) return;
    pendingSelectionContext = null;
  }

  function peekPendingSelectionContext(expectedToken?: number): PendingSelectionContext {
    const context = pendingSelectionContext;
    if (!context) return null;
    if (expectedToken != null && context.token !== expectedToken) return null;
    if (Date.now() - context.createdAt > PENDING_SELECTION_CONTEXT_TTL_MS) {
      clearPendingSelectionContext(context.token);
      return null;
    }
    return context;
  }

  function consumePendingSelectionContext(expectedToken?: number): PendingSelectionContext {
    const context = peekPendingSelectionContext(expectedToken);
    if (!context) return null;
    pendingSelectionContext = null;
    return context;
  }

  function commitSelection(
    entity: unknown,
    syncExternalSelection = true,
    selectionOptions?: { additive?: boolean; toggle?: boolean },
  ): void {
    const additive = !!selectionOptions?.additive;
    const toggle = selectionOptions?.toggle ?? additive;
    const nextEntity = entity ?? null;

    if (!additive || !nextEntity) {
      selectedEntity = nextEntity;
      selectedEntities = nextEntity ? [nextEntity] : [];
    } else {
      const identity = getNodeIdentity(nextEntity);
      if (!identity) {
        selectedEntity = nextEntity;
        selectedEntities = [nextEntity];
      } else {
        const nextParentIdentity = getNodeParentIdentity(nextEntity);
        const currentParentIdentity = selectedEntities.length > 0 ? getNodeParentIdentity(selectedEntities[0]) : null;
        if (
          selectedEntities.length > 0
          && currentParentIdentity != null
          && nextParentIdentity != null
          && currentParentIdentity !== nextParentIdentity
        ) {
          return;
        }

        const index = selectedEntities.findIndex(item => getNodeIdentity(item) === identity);
        if (index >= 0 && toggle) {
          const nextList = selectedEntities.slice();
          nextList.splice(index, 1);
          selectedEntities = nextList;
          if (selectedEntities.length === 0) {
            selectedEntity = null;
          } else if (getNodeIdentity(selectedEntity) === identity) {
            selectedEntity = selectedEntities[selectedEntities.length - 1] ?? null;
          }
        } else if (index < 0) {
          selectedEntities = [...selectedEntities, nextEntity];
          selectedEntity = nextEntity;
        } else {
          selectedEntity = nextEntity;
        }
      }
    }

    options.onSelectionCommitted(selectedEntity ?? null);
    syncSelectionHighlight();
    if (!syncExternalSelection || !externalSelectionService) return;
    if (externalSelectionService.selectedEntity === (selectedEntity ?? null)) return;
    if (normalizingSelection) return;
    normalizingSelection = true;
    try {
      externalSelectionService.selectedEntity = selectedEntity ?? null;
    } finally {
      queueMicrotask(() => {
        normalizingSelection = false;
      });
    }
  }

  function isWithinCanvasViewport(event: PointerEvent, canvas: HTMLCanvasElement): boolean {
    if (event.target === canvas) return true;
    const rect = canvas.getBoundingClientRect();
    return event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  }

  return {
    createV2SelectionBridge(v2: any) {
      const SelectionServiceIdentity = v2?.SelectionServiceIdentity;
      if (!SelectionServiceIdentity) return null;
      return {
        friendlyName: 'Editor Selection Sync',
        consumes: [SelectionServiceIdentity],
        factory: (selectionService: any) => {
          externalSelectionService = selectionService;
          const selObs = selectionService.onSelectedEntityChanged?.add(() => {
            if (normalizingSelection) return;
            if (options.getMonitor?.()?.isDragging) return;

            let entity = selectionService.selectedEntity;
            const consumedContext = consumePendingSelectionContext();
            if (!consumedContext) {
              commitSelection(entity ?? null, false);
              return;
            }

            const normalized = options.normalizeSelection({
              source: consumedContext.kind,
              rawEntity: entity,
            });

            if (consumedContext.kind === 'viewport' && !normalized.hasPersistentBinding) return;
            if (!normalized.normalizedEntity) return;
            entity = normalized.normalizedEntity;
            commitSelection(entity ?? null, consumedContext.kind === 'viewport', {
              additive: consumedContext.additive,
              toggle: consumedContext.additive,
            });
          });

          return {
            dispose: () => {
              if (selObs) selectionService.onSelectedEntityChanged?.remove(selObs);
              if (externalSelectionService === selectionService) externalSelectionService = null;
              if (selectedEntity === selectionService.selectedEntity) selectedEntity = null;
              clearSelectionHighlight();
              selectedEntities = [];
            },
          };
        },
      };
    },

    bindSelectionSourceTracking(): void {
      this.unbindSelectionSourceTracking?.();
      const onPointerDown = (event: PointerEvent) => {
        const rawTarget = event.target as EventTarget | null;
        const target = isHostHTMLElement(rawTarget, host.window) ? rawTarget : null;
        const scene = options.getScene();
        const canvas = scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
        if (!target) return;

        if (canvas && isWithinCanvasViewport(event, canvas)) {
          const withinExternalRoot = options.externalSelectionRootSelector
            ? !!target.closest?.(options.externalSelectionRootSelector)
            : false;
          const isExternalInteractive = options.externalSelectionInteractiveSelector
            ? !!target.closest?.(options.externalSelectionInteractiveSelector)
            : false;
          if (!withinExternalRoot || !isExternalInteractive) {
            if (event.button !== 0 || !scene || !canvas) return;
            if (!(options.shouldHandleViewportSelection?.() ?? true)) return;
            setPendingSelectionContext({
              kind: 'viewport',
              token: createSelectionToken(),
              createdAt: Date.now(),
              additive: !!event.shiftKey,
            });
            return;
          }
        }

        if (options.externalSelectionRootSelector && target.closest?.(options.externalSelectionRootSelector)) {
          const isExternalInteractive = options.externalSelectionInteractiveSelector
            ? !!target.closest?.(options.externalSelectionInteractiveSelector)
            : true;
          if (isExternalInteractive) {
            setPendingSelectionContext({
              kind: 'tree',
              token: createSelectionToken(),
              createdAt: Date.now(),
              additive: !!event.shiftKey,
            });
            return;
          }
          clearPendingSelectionContext();
        }
      };

      host.document.addEventListener('pointerdown', onPointerDown, true);
      selectionTrackingCtx = { onPointerDown };
    },

    unbindSelectionSourceTracking(): void {
      if (!selectionTrackingCtx) return;
      host.document.removeEventListener('pointerdown', selectionTrackingCtx.onPointerDown, true);
      selectionTrackingCtx = null;
      pendingSelectionContext = null;
    },

    enablePicking(): void {
      options.setExternalPickingState?.(true);
    },

    reset(): void {
      this.unbindSelectionSourceTracking?.();
      normalizingSelection = false;
      externalSelectionService = null;
      selectedEntity = null;
      clearSelectionHighlight();
      selectedEntities = [];
      pendingSelectionContext = null;
    },

    getSelectedEntity(): unknown | null {
      return selectedEntity;
    },

    getSelectedEntities(): unknown[] {
      return [...selectedEntities];
    },

    selectEntity(entity: unknown | null, syncExternalSelection = true, selectionOptions?: { additive?: boolean; toggle?: boolean }): void {
      commitSelection(entity ?? null, syncExternalSelection, selectionOptions);
    },
  };
}
