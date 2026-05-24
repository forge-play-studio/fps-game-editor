/** Browser host adapter for editor runtimes running inside a project page. */

export * from './local-editor-ui';
export {
  normalizeLocalEditorWorkbenchLayout,
  normalizeLocalEditorWorkbenchUserLayout,
  resolveLocalEditorWorkbenchVisibility,
} from './local-editor-ui-workbench';
export type {
  LocalEditorWorkbenchLayoutState,
  LocalEditorWorkbenchVisibility,
  LocalEditorWorkbenchViewport,
} from './local-editor-ui-workbench';

export type BrowserEventTargetLike = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export interface BrowserHostOptions {
  window?: Window;
  document?: Document;
  canvas?: HTMLCanvasElement | string | null;
}

export interface BrowserHost {
  window: Window;
  document: Document;
  canvas: HTMLCanvasElement | null;
  isIframe: boolean;
  searchParams: URLSearchParams;
  hasFocus(): boolean;
  getActiveElement(): Element | null;
  resolveCanvas(canvas?: HTMLCanvasElement | string | null): HTMLCanvasElement | null;
  addWindowEvent<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  addDocumentEvent<K extends keyof DocumentEventMap>(
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
  setTimeout(callback: () => void, timeoutMs: number): number;
  clearTimeout(handle: number): void;
}

function getDefaultWindow(): Window {
  if (typeof window === 'undefined') {
    throw new Error('createBrowserHost requires a browser Window. Pass options.window in non-browser environments.');
  }
  return window;
}

function resolveDocument(win: Window, doc?: Document): Document {
  return doc ?? win.document;
}

export function isIframeWindow(win: Window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

export function resolveCanvasElement(
  doc: Document,
  canvas?: HTMLCanvasElement | string | null,
): HTMLCanvasElement | null {
  if (!canvas) return null;
  if (typeof canvas !== 'string') return canvas;
  return doc.getElementById(canvas) as HTMLCanvasElement | null;
}

export function createBrowserHost(options: BrowserHostOptions = {}): BrowserHost {
  const win = options.window ?? getDefaultWindow();
  const doc = resolveDocument(win, options.document);
  const resolveCanvas = (canvas = options.canvas ?? null) => resolveCanvasElement(doc, canvas);

  return {
    window: win,
    document: doc,
    canvas: resolveCanvas(),
    isIframe: isIframeWindow(win),
    searchParams: new URLSearchParams(win.location?.search ?? ''),
    hasFocus: () => doc.hasFocus(),
    getActiveElement: () => doc.activeElement,
    resolveCanvas,
    addWindowEvent(type, listener, eventOptions) {
      win.addEventListener(type, listener as EventListener, eventOptions);
      return () => win.removeEventListener(type, listener as EventListener, eventOptions);
    },
    addDocumentEvent(type, listener, eventOptions) {
      doc.addEventListener(type, listener as EventListener, eventOptions);
      return () => doc.removeEventListener(type, listener as EventListener, eventOptions);
    },
    requestAnimationFrame: callback => win.requestAnimationFrame(callback),
    cancelAnimationFrame: handle => win.cancelAnimationFrame(handle),
    setTimeout: (callback, timeoutMs) => win.setTimeout(callback, timeoutMs),
    clearTimeout: handle => win.clearTimeout(handle),
  };
}
