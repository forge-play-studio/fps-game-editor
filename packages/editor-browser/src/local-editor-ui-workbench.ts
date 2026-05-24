import { LOCAL_EDITOR_THEME_CLASS } from './local-editor-ui-theme';
import { createLocalEditorIcon, type LocalEditorIconName } from './local-editor-ui-icons';
import type {
  LocalEditorWorkbenchLayout,
  LocalEditorWorkbenchPanelDescriptor,
  LocalEditorWorkbenchRegionDescriptor,
} from './local-editor-ui-types';

export interface LocalEditorWorkbenchLayoutState {
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
}

export interface LocalEditorWorkbenchLayoutController {
  getLayout(): LocalEditorWorkbenchLayoutState;
  reset(): void;
  dispose(): void;
}

export interface LocalEditorWorkbenchViewport {
  width: number;
  height: number;
}

export interface LocalEditorWorkbenchVisibility {
  leftVisible: boolean;
  rightVisible: boolean;
  bottomVisible: boolean;
  leftAutoHidden: boolean;
  rightAutoHidden: boolean;
  bottomAutoHidden: boolean;
}

const LOCAL_EDITOR_WORKBENCH_LAYOUT_STORAGE_KEY = 'fps-game-editor:workbench-layout:v1';

const DEFAULT_WORKBENCH_LAYOUT: LocalEditorWorkbenchLayoutState = {
  leftWidth: 300,
  rightWidth: 340,
  bottomHeight: 260,
  leftCollapsed: false,
  rightCollapsed: false,
  bottomCollapsed: true,
};

const WORKBENCH_LAYOUT_LIMITS = {
  leftMin: 220,
  leftMax: 420,
  rightMin: 300,
  rightMax: 520,
  bottomMin: 160,
  bottomMax: 420,
  sceneMinWidth: 420,
  sceneMinHeight: 220,
};

const RESIZER_THICKNESS = 7;
const WORKBENCH_COMPACT_WIDTH = 760;
const WORKBENCH_RIGHT_AUTO_COLLAPSE_WIDTH = 1120;
const WORKBENCH_BOTTOM_AUTO_COLLAPSE_HEIGHT = 520;

export const LOCAL_EDITOR_WORKBENCH_REGIONS = [
  { id: 'top-app-bar', label: 'Top App Bar' },
  { id: 'left-dock', label: 'Left Dock' },
  { id: 'scene-view', label: 'Scene View' },
  { id: 'scene-header', label: 'Scene View Header' },
  { id: 'right-dock', label: 'Right Dock' },
  { id: 'bottom-dock', label: 'Bottom Dock' },
] satisfies LocalEditorWorkbenchRegionDescriptor[];

export const LOCAL_EDITOR_WORKBENCH_PANELS = [
  { id: 'hierarchy', title: '层级', area: 'left', toolbar: 'scene-graph' },
  { id: 'inspector', title: '检查器', area: 'right' },
  { id: 'assets', title: '资产', area: 'bottom', contextMenu: 'asset-browser' },
  { id: 'history', title: '历史', area: 'bottom' },
] satisfies LocalEditorWorkbenchPanelDescriptor[];

export function createDefaultLocalEditorWorkbenchLayout(): LocalEditorWorkbenchLayout {
  return {
    regions: [...LOCAL_EDITOR_WORKBENCH_REGIONS],
    panels: [...LOCAL_EDITOR_WORKBENCH_PANELS],
    activeTabs: {
      left: 'hierarchy',
      right: 'inspector',
      bottom: 'assets',
    },
  };
}

export interface LocalEditorWorkbenchElements {
  root: HTMLDivElement;
  leftDock: HTMLDivElement;
  sceneFrame: HTMLDivElement;
  sceneHeader: HTMLDivElement;
  rightDock: HTMLDivElement;
  bottomDock: HTMLDivElement;
  leftResizer: HTMLDivElement;
  rightResizer: HTMLDivElement;
  bottomResizer: HTMLDivElement;
  leftToggle: HTMLButtonElement;
  rightToggle: HTMLButtonElement;
  bottomToggle: HTMLButtonElement;
}

export function createLocalEditorWorkbench(doc: Document): LocalEditorWorkbenchElements {
  const root = doc.createElement('div');
  root.dataset.editorWorkbench = 'true';
  root.className = LOCAL_EDITOR_THEME_CLASS;
  root.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:2147483639',
    'display:none',
    'pointer-events:none',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
  ].join(';');

  const leftDock = createDock(doc, 'left');
  const rightDock = createDock(doc, 'right');
  const bottomDock = createDock(doc, 'bottom');
  const leftResizer = createResizer(doc, 'left');
  const rightResizer = createResizer(doc, 'right');
  const bottomResizer = createResizer(doc, 'bottom');
  const leftToggle = createDockToggle(doc, 'left', 'hierarchy');
  const rightToggle = createDockToggle(doc, 'right', 'inspector');
  const bottomToggle = createDockToggle(doc, 'bottom', 'asset');
  const sceneFrame = doc.createElement('div');
  sceneFrame.dataset.editorWorkbenchRegion = 'scene-view';
  sceneFrame.style.cssText = [
    'position:absolute',
    'top:0',
    'left:300px',
    'right:340px',
    'bottom:260px',
    'display:flex',
    'flex-direction:column',
    'min-width:0',
    'min-height:0',
    'border-left:1px solid var(--fps-editor-divider)',
    'border-right:1px solid var(--fps-editor-divider)',
    'border-bottom:1px solid var(--fps-editor-divider)',
    'background:transparent',
    'pointer-events:none',
    'overflow:hidden',
  ].join(';');
  const sceneHeader = doc.createElement('div');
  sceneHeader.dataset.editorWorkbenchRegion = 'scene-header';
  sceneHeader.style.cssText = [
    'height:38px',
    'flex:0 0 38px',
    'display:flex',
    'align-items:center',
    'justify-content:flex-start',
    'border-bottom:1px solid var(--fps-editor-divider)',
    'background:var(--fps-editor-chrome)',
    'box-shadow:var(--fps-editor-shadow-inset-highlight)',
    'pointer-events:none',
  ].join(';');
  sceneFrame.appendChild(sceneHeader);

  root.appendChild(sceneFrame);
  root.appendChild(leftDock);
  root.appendChild(rightDock);
  root.appendChild(bottomDock);
  root.appendChild(leftResizer);
  root.appendChild(rightResizer);
  root.appendChild(bottomResizer);
  root.appendChild(leftToggle);
  root.appendChild(rightToggle);
  root.appendChild(bottomToggle);
  return {
    root,
    leftDock,
    sceneFrame,
    sceneHeader,
    rightDock,
    bottomDock,
    leftResizer,
    rightResizer,
    bottomResizer,
    leftToggle,
    rightToggle,
    bottomToggle,
  };
}

function createDock(doc: Document, area: 'left' | 'right' | 'bottom'): HTMLDivElement {
  const dock = doc.createElement('div');
  dock.dataset.editorWorkbenchRegion = area === 'left' ? 'left-dock' : area === 'right' ? 'right-dock' : 'bottom-dock';
  const placement = area === 'left'
    ? 'top:0;left:0;bottom:260px;width:300px'
    : area === 'right'
      ? 'top:0;right:0;bottom:0;width:340px'
      : 'left:0;right:340px;bottom:0;height:260px';
  dock.style.cssText = [
    'position:absolute',
    placement,
    'display:flex',
    'flex-direction:column',
    'min-width:0',
    'min-height:0',
    'border:1px solid var(--fps-editor-divider)',
    'background:var(--fps-editor-panel)',
    'pointer-events:auto',
    'overflow:hidden',
  ].join(';');
  return dock;
}

function createResizer(doc: Document, area: 'left' | 'right' | 'bottom'): HTMLDivElement {
  const resizer = doc.createElement('div');
  resizer.dataset.editorWorkbenchResizer = area;
  resizer.title = area === 'bottom'
    ? '拖拽调整底部面板高度，双击恢复默认'
    : '拖拽调整面板宽度，双击恢复默认';
  resizer.style.cssText = [
    'position:absolute',
    'z-index:4',
    area === 'bottom' ? `height:${RESIZER_THICKNESS}px` : `width:${RESIZER_THICKNESS}px`,
    area === 'bottom' ? 'cursor:row-resize' : 'cursor:col-resize',
    'background:transparent',
    'pointer-events:auto',
    'touch-action:none',
  ].join(';');
  resizer.addEventListener('mouseenter', () => {
    resizer.style.background = 'var(--fps-editor-accent-soft)';
  });
  resizer.addEventListener('mouseleave', () => {
    resizer.style.background = 'transparent';
  });
  return resizer;
}

function createDockToggle(doc: Document, area: 'left' | 'right' | 'bottom', icon: LocalEditorIconName): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.dataset.editorWorkbenchToggle = area;
  button.style.cssText = [
    'position:absolute',
    'z-index:5',
    'width:26px',
    'height:26px',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-button)',
    'color:var(--fps-editor-text)',
    'box-shadow:var(--fps-editor-shadow-panel)',
    'cursor:pointer',
    'pointer-events:auto',
  ].join(';');
  button.appendChild(createLocalEditorIcon(doc, icon, { size: 14 }));
  button.addEventListener('mouseenter', () => {
    button.style.background = 'var(--fps-editor-button-hover)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = 'var(--fps-editor-button)';
  });
  return button;
}

export function createWorkbenchPanelContent(doc: Document): HTMLDivElement {
  const content = doc.createElement('div');
  content.dataset.editorPanelContent = 'true';
  content.style.cssText = [
    'flex:1',
    'min-height:0',
    'overflow:auto',
    'padding:8px',
  ].join(';');
  return content;
}

export function createSceneHeaderToolbar(doc: Document): HTMLDivElement {
  const toolbar = doc.createElement('div');
  toolbar.dataset.editorWorkbenchRegion = 'scene-toolbar';
  toolbar.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:7px',
    'width:100%',
    'height:100%',
    'max-width:100%',
    'padding:5px 8px',
    'background:transparent',
    'pointer-events:auto',
    'overflow:hidden',
  ].join(';');
  return toolbar;
}

export function normalizeLocalEditorWorkbenchLayout(
  input: Partial<LocalEditorWorkbenchLayoutState> | null | undefined,
  viewport: LocalEditorWorkbenchViewport,
): LocalEditorWorkbenchLayoutState {
  const userLayout = normalizeLocalEditorWorkbenchUserLayout(input);
  const compactWidth = viewport.width < WORKBENCH_COMPACT_WIDTH;
  const rightAutoCollapsed = viewport.width < WORKBENCH_RIGHT_AUTO_COLLAPSE_WIDTH;
  const leftVisible = !userLayout.leftCollapsed && !compactWidth;
  const rightVisible = !userLayout.rightCollapsed && !rightAutoCollapsed;

  const rightEdge = rightVisible
    ? clampNumber(userLayout.rightWidth, WORKBENCH_LAYOUT_LIMITS.rightMin, resolveRightMax(viewport, leftVisible))
    : 0;
  const leftEdge = leftVisible
    ? clampNumber(userLayout.leftWidth, WORKBENCH_LAYOUT_LIMITS.leftMin, resolveLeftMax(viewport, rightEdge))
    : 0;
  const bottomMax = Math.max(
    WORKBENCH_LAYOUT_LIMITS.bottomMin,
    Math.min(
      WORKBENCH_LAYOUT_LIMITS.bottomMax,
      Math.floor(viewport.height * 0.45),
      viewport.height - WORKBENCH_LAYOUT_LIMITS.sceneMinHeight,
    ),
  );

  return {
    leftWidth: leftVisible ? leftEdge : userLayout.leftWidth,
    rightWidth: rightVisible ? rightEdge : userLayout.rightWidth,
    bottomHeight: clampNumber(userLayout.bottomHeight, WORKBENCH_LAYOUT_LIMITS.bottomMin, bottomMax),
    leftCollapsed: userLayout.leftCollapsed,
    rightCollapsed: userLayout.rightCollapsed,
    bottomCollapsed: userLayout.bottomCollapsed,
  };
}

export function normalizeLocalEditorWorkbenchUserLayout(
  input: Partial<LocalEditorWorkbenchLayoutState> | null | undefined,
): LocalEditorWorkbenchLayoutState {
  const next = {
    ...DEFAULT_WORKBENCH_LAYOUT,
    ...(input ?? {}),
  };
  return {
    leftWidth: clampNumber(next.leftWidth, WORKBENCH_LAYOUT_LIMITS.leftMin, WORKBENCH_LAYOUT_LIMITS.leftMax),
    rightWidth: clampNumber(next.rightWidth, WORKBENCH_LAYOUT_LIMITS.rightMin, WORKBENCH_LAYOUT_LIMITS.rightMax),
    bottomHeight: clampNumber(next.bottomHeight, WORKBENCH_LAYOUT_LIMITS.bottomMin, WORKBENCH_LAYOUT_LIMITS.bottomMax),
    leftCollapsed: next.leftCollapsed === true,
    rightCollapsed: next.rightCollapsed === true,
    bottomCollapsed: next.bottomCollapsed === true,
  };
}

export function resolveLocalEditorWorkbenchVisibility(
  layout: LocalEditorWorkbenchLayoutState,
  viewport: LocalEditorWorkbenchViewport,
): LocalEditorWorkbenchVisibility {
  const leftAutoHidden = viewport.width < WORKBENCH_COMPACT_WIDTH;
  const rightAutoHidden = viewport.width < WORKBENCH_RIGHT_AUTO_COLLAPSE_WIDTH;
  const bottomAutoHidden = viewport.height < WORKBENCH_BOTTOM_AUTO_COLLAPSE_HEIGHT;
  return {
    leftVisible: !layout.leftCollapsed && !leftAutoHidden,
    rightVisible: !layout.rightCollapsed && !rightAutoHidden,
    bottomVisible: !layout.bottomCollapsed && !bottomAutoHidden,
    leftAutoHidden,
    rightAutoHidden,
    bottomAutoHidden,
  };
}

export function createLocalEditorWorkbenchLayoutController(
  doc: Document,
  elements: LocalEditorWorkbenchElements,
): LocalEditorWorkbenchLayoutController {
  const win = doc.defaultView;
  let layout = normalizeLocalEditorWorkbenchUserLayout(readStoredWorkbenchLayout(doc));
  let projectedVisibility = resolveLocalEditorWorkbenchVisibility(layout, readViewport(doc));
  let drag:
    | { area: 'left' | 'right' | 'bottom' }
    | null = null;

  const persist = (): void => writeStoredWorkbenchLayout(doc, layout);

  const apply = (save = false): void => {
    const viewport = readViewport(doc);
    const projectedLayout = normalizeLocalEditorWorkbenchLayout(layout, viewport);
    projectedVisibility = resolveLocalEditorWorkbenchVisibility(projectedLayout, viewport);
    const leftEdge = projectedVisibility.leftVisible ? projectedLayout.leftWidth : 0;
    const rightEdge = projectedVisibility.rightVisible ? projectedLayout.rightWidth : 0;
    const bottomEdge = projectedVisibility.bottomVisible ? projectedLayout.bottomHeight : 0;

    elements.root.dataset.editorLayoutLeftCollapsed = String(!projectedVisibility.leftVisible);
    elements.root.dataset.editorLayoutRightCollapsed = String(!projectedVisibility.rightVisible);
    elements.root.dataset.editorLayoutBottomCollapsed = String(!projectedVisibility.bottomVisible);

    elements.sceneFrame.style.left = `${leftEdge}px`;
    elements.sceneFrame.style.right = `${rightEdge}px`;
    elements.sceneFrame.style.bottom = `${bottomEdge}px`;

    elements.leftDock.style.display = projectedVisibility.leftVisible ? 'flex' : 'none';
    elements.leftDock.style.width = `${projectedLayout.leftWidth}px`;
    elements.leftDock.style.bottom = `${bottomEdge}px`;

    elements.rightDock.style.display = projectedVisibility.rightVisible ? 'flex' : 'none';
    elements.rightDock.style.width = `${projectedLayout.rightWidth}px`;

    elements.bottomDock.style.display = projectedVisibility.bottomVisible ? 'flex' : 'none';
    elements.bottomDock.style.right = `${rightEdge}px`;
    elements.bottomDock.style.height = `${projectedLayout.bottomHeight}px`;

    elements.leftResizer.style.display = projectedVisibility.leftVisible ? '' : 'none';
    elements.leftResizer.style.left = `${projectedLayout.leftWidth - Math.ceil(RESIZER_THICKNESS / 2)}px`;
    elements.leftResizer.style.top = '0';
    elements.leftResizer.style.bottom = `${bottomEdge}px`;

    elements.rightResizer.style.display = projectedVisibility.rightVisible ? '' : 'none';
    elements.rightResizer.style.right = `${projectedLayout.rightWidth - Math.ceil(RESIZER_THICKNESS / 2)}px`;
    elements.rightResizer.style.top = '0';
    elements.rightResizer.style.bottom = '0';

    elements.bottomResizer.style.display = projectedVisibility.bottomVisible ? '' : 'none';
    elements.bottomResizer.style.left = '0';
    elements.bottomResizer.style.right = `${rightEdge}px`;
    elements.bottomResizer.style.bottom = `${projectedLayout.bottomHeight - Math.ceil(RESIZER_THICKNESS / 2)}px`;

    elements.leftToggle.style.left = projectedVisibility.leftVisible ? `${Math.max(6, projectedLayout.leftWidth - 13)}px` : '6px';
    elements.leftToggle.style.top = '43px';
    elements.leftToggle.disabled = projectedVisibility.leftAutoHidden;
    elements.leftToggle.style.opacity = projectedVisibility.leftAutoHidden ? '0.45' : '';
    elements.leftToggle.style.cursor = projectedVisibility.leftAutoHidden ? 'not-allowed' : 'pointer';
    elements.leftToggle.title = projectedVisibility.leftAutoHidden
      ? '窗口过窄，层级面板已自动隐藏'
      : projectedVisibility.leftVisible ? '隐藏层级面板' : '显示层级面板';
    elements.leftToggle.setAttribute('aria-label', elements.leftToggle.title);

    elements.rightToggle.style.right = projectedVisibility.rightVisible ? `${Math.max(6, projectedLayout.rightWidth - 13)}px` : '6px';
    elements.rightToggle.style.top = '43px';
    elements.rightToggle.disabled = projectedVisibility.rightAutoHidden;
    elements.rightToggle.style.opacity = projectedVisibility.rightAutoHidden ? '0.45' : '';
    elements.rightToggle.style.cursor = projectedVisibility.rightAutoHidden ? 'not-allowed' : 'pointer';
    elements.rightToggle.title = projectedVisibility.rightAutoHidden
      ? '窗口过窄，检查器面板已自动隐藏'
      : projectedVisibility.rightVisible ? '隐藏检查器面板' : '显示检查器面板';
    elements.rightToggle.setAttribute('aria-label', elements.rightToggle.title);

    elements.bottomToggle.style.left = '50%';
    elements.bottomToggle.style.transform = 'translateX(-50%)';
    elements.bottomToggle.style.bottom = projectedVisibility.bottomVisible ? `${Math.max(6, projectedLayout.bottomHeight - 13)}px` : '6px';
    elements.bottomToggle.disabled = projectedVisibility.bottomAutoHidden;
    elements.bottomToggle.style.opacity = projectedVisibility.bottomAutoHidden ? '0.45' : '';
    elements.bottomToggle.style.cursor = projectedVisibility.bottomAutoHidden ? 'not-allowed' : 'pointer';
    elements.bottomToggle.title = projectedVisibility.bottomAutoHidden
      ? '窗口高度过低，资产/历史面板已自动隐藏'
      : projectedVisibility.bottomVisible ? '隐藏资产/历史面板' : '显示资产/历史面板';
    elements.bottomToggle.setAttribute('aria-label', elements.bottomToggle.title);

    if (save) persist();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!drag) return;
    const viewport = readViewport(doc);
    if (drag.area === 'left') {
      layout = {
        ...layout,
        leftWidth: clampNumber(
          event.clientX,
          WORKBENCH_LAYOUT_LIMITS.leftMin,
          resolveLeftMax(viewport, projectedVisibility.rightVisible ? layout.rightWidth : 0),
        ),
      };
    } else if (drag.area === 'right') {
      layout = {
        ...layout,
        rightWidth: clampNumber(
          viewport.width - event.clientX,
          WORKBENCH_LAYOUT_LIMITS.rightMin,
          resolveRightMax(viewport, projectedVisibility.leftVisible),
        ),
      };
    } else {
      const bottomMax = Math.max(
        WORKBENCH_LAYOUT_LIMITS.bottomMin,
        Math.min(
          WORKBENCH_LAYOUT_LIMITS.bottomMax,
          Math.floor(viewport.height * 0.45),
          viewport.height - WORKBENCH_LAYOUT_LIMITS.sceneMinHeight,
        ),
      );
      layout = {
        ...layout,
        bottomHeight: clampNumber(viewport.height - event.clientY, WORKBENCH_LAYOUT_LIMITS.bottomMin, bottomMax),
      };
    }
    apply();
  };

  const onPointerUp = (): void => {
    if (!drag) return;
    drag = null;
    doc.body.style.cursor = '';
    doc.body.style.userSelect = '';
    win?.removeEventListener('pointermove', onPointerMove);
    win?.removeEventListener('pointerup', onPointerUp);
    persist();
  };

  const beginDrag = (area: 'left' | 'right' | 'bottom', event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag = { area };
    doc.body.style.cursor = area === 'bottom' ? 'row-resize' : 'col-resize';
    doc.body.style.userSelect = 'none';
    win?.addEventListener('pointermove', onPointerMove);
    win?.addEventListener('pointerup', onPointerUp);
  };

  const onLeftPointerDown = (event: PointerEvent): void => beginDrag('left', event);
  const onRightPointerDown = (event: PointerEvent): void => beginDrag('right', event);
  const onBottomPointerDown = (event: PointerEvent): void => beginDrag('bottom', event);
  const onLeftDoubleClick = (): void => {
    layout = { ...layout, leftWidth: DEFAULT_WORKBENCH_LAYOUT.leftWidth };
    apply(true);
  };
  const onRightDoubleClick = (): void => {
    layout = { ...layout, rightWidth: DEFAULT_WORKBENCH_LAYOUT.rightWidth };
    apply(true);
  };
  const onBottomDoubleClick = (): void => {
    layout = { ...layout, bottomHeight: DEFAULT_WORKBENCH_LAYOUT.bottomHeight };
    apply(true);
  };
  const onLeftToggle = (): void => {
    if (projectedVisibility.leftAutoHidden) return;
    layout = { ...layout, leftCollapsed: !layout.leftCollapsed };
    apply(true);
  };
  const onRightToggle = (): void => {
    if (projectedVisibility.rightAutoHidden) return;
    layout = { ...layout, rightCollapsed: !layout.rightCollapsed };
    apply(true);
  };
  const onBottomToggle = (): void => {
    if (projectedVisibility.bottomAutoHidden) return;
    layout = { ...layout, bottomCollapsed: !layout.bottomCollapsed };
    apply(true);
  };
  const onResize = (): void => apply();

  elements.leftResizer.addEventListener('pointerdown', onLeftPointerDown);
  elements.rightResizer.addEventListener('pointerdown', onRightPointerDown);
  elements.bottomResizer.addEventListener('pointerdown', onBottomPointerDown);
  elements.leftResizer.addEventListener('dblclick', onLeftDoubleClick);
  elements.rightResizer.addEventListener('dblclick', onRightDoubleClick);
  elements.bottomResizer.addEventListener('dblclick', onBottomDoubleClick);
  elements.leftToggle.addEventListener('click', onLeftToggle);
  elements.rightToggle.addEventListener('click', onRightToggle);
  elements.bottomToggle.addEventListener('click', onBottomToggle);
  win?.addEventListener('resize', onResize);
  apply();

  return {
    getLayout() {
      return { ...layout };
    },
    reset() {
      layout = { ...DEFAULT_WORKBENCH_LAYOUT };
      apply(true);
    },
    dispose() {
      onPointerUp();
      elements.leftResizer.removeEventListener('pointerdown', onLeftPointerDown);
      elements.rightResizer.removeEventListener('pointerdown', onRightPointerDown);
      elements.bottomResizer.removeEventListener('pointerdown', onBottomPointerDown);
      elements.leftResizer.removeEventListener('dblclick', onLeftDoubleClick);
      elements.rightResizer.removeEventListener('dblclick', onRightDoubleClick);
      elements.bottomResizer.removeEventListener('dblclick', onBottomDoubleClick);
      elements.leftToggle.removeEventListener('click', onLeftToggle);
      elements.rightToggle.removeEventListener('click', onRightToggle);
      elements.bottomToggle.removeEventListener('click', onBottomToggle);
      win?.removeEventListener('resize', onResize);
    },
  };
}

function readViewport(doc: Document): LocalEditorWorkbenchViewport {
  const win = doc.defaultView;
  return {
    width: Math.max(320, win?.innerWidth ?? doc.documentElement.clientWidth ?? 1280),
    height: Math.max(320, win?.innerHeight ?? doc.documentElement.clientHeight ?? 720),
  };
}

function resolveLeftMax(viewport: LocalEditorWorkbenchViewport, rightWidth: number): number {
  return Math.max(
    WORKBENCH_LAYOUT_LIMITS.leftMin,
    Math.min(
      WORKBENCH_LAYOUT_LIMITS.leftMax,
      viewport.width - rightWidth - WORKBENCH_LAYOUT_LIMITS.sceneMinWidth,
    ),
  );
}

function resolveRightMax(viewport: LocalEditorWorkbenchViewport, leftVisible: boolean): number {
  const leftWidth = leftVisible ? WORKBENCH_LAYOUT_LIMITS.leftMin : 0;
  return Math.max(
    WORKBENCH_LAYOUT_LIMITS.rightMin,
    Math.min(
      WORKBENCH_LAYOUT_LIMITS.rightMax,
      viewport.width - leftWidth - WORKBENCH_LAYOUT_LIMITS.sceneMinWidth,
    ),
  );
}

function clampNumber(value: unknown, min: number, max: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : min;
  return Math.min(Math.max(numeric, min), max);
}

function readStoredWorkbenchLayout(doc: Document): Partial<LocalEditorWorkbenchLayoutState> | null {
  try {
    const raw = doc.defaultView?.localStorage?.getItem(LOCAL_EDITOR_WORKBENCH_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalEditorWorkbenchLayoutState>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredWorkbenchLayout(doc: Document, layout: LocalEditorWorkbenchLayoutState): void {
  try {
    doc.defaultView?.localStorage?.setItem(LOCAL_EDITOR_WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Browsers can disable localStorage; the editor should still stay usable.
  }
}
