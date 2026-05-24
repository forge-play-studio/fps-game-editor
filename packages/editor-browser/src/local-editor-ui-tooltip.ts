import {
  applyLocalEditorTheme,
  LOCAL_EDITOR_THEME_CLASS,
  type LocalEditorThemeName,
} from './local-editor-ui-theme';

const TOOLTIP_DELAY_MS = 450;
const TOOLTIP_OFFSET_PX = 7;
const TOOLTIP_VIEWPORT_MARGIN_PX = 6;

export interface LocalEditorTooltipController {
  setTheme(theme: LocalEditorThemeName): void;
  hide(): void;
  dispose(): void;
}

export interface LocalEditorTooltipControllerOptions {
  scope?: () => Iterable<HTMLElement>;
}

export function createLocalEditorTooltipController(
  doc: Document,
  root: HTMLElement,
  theme?: LocalEditorThemeName,
  options: LocalEditorTooltipControllerOptions = {},
): LocalEditorTooltipController {
  const tooltip = doc.createElement('div');
  tooltip.classList.add(LOCAL_EDITOR_THEME_CLASS);
  applyLocalEditorTheme(tooltip, theme);
  tooltip.dataset.editorTooltipSurface = 'true';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.cssText = [
    'position:fixed',
    'z-index:2147483642',
    'display:none',
    'max-width:min(260px, calc(100vw - 16px))',
    'padding:5px 7px',
    'border:1px solid var(--fps-editor-border)',
    'border-radius:3px',
    'background:var(--fps-editor-panel)',
    'box-shadow:var(--fps-editor-shadow-popover)',
    'color:var(--fps-editor-text)',
    'font-family:var(--fps-editor-font)',
    'font-size:11px',
    'font-weight:800',
    'line-height:1.35',
    'white-space:normal',
    'pointer-events:none',
  ].join(';');
  root.appendChild(tooltip);

  let target: HTMLElement | null = null;
  let showTimer: number | null = null;

  const clearShowTimer = (): void => {
    if (showTimer == null) return;
    doc.defaultView?.clearTimeout(showTimer);
    showTimer = null;
  };

  const hide = (): void => {
    clearShowTimer();
    target = null;
    tooltip.style.display = 'none';
    tooltip.textContent = '';
  };

  const scheduleShow = (nextTarget: HTMLElement): void => {
    const text = readTooltipText(nextTarget);
    if (!text) {
      hide();
      return;
    }
    clearShowTimer();
    target = nextTarget;
    showTimer = doc.defaultView?.setTimeout(() => {
      showTimer = null;
      if (target !== nextTarget) return;
      show(nextTarget, text);
    }, TOOLTIP_DELAY_MS) ?? null;
  };

  const onPointerOver = (event: PointerEvent): void => {
    const nextTarget = findTooltipTarget(event.target);
    if (!nextTarget || nextTarget === target) return;
    scheduleShow(nextTarget);
  };
  const onPointerOut = (event: PointerEvent): void => {
    if (!target) return;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (related && target.contains(related)) return;
    hide();
  };
  const onFocusIn = (event: FocusEvent): void => {
    const nextTarget = findTooltipTarget(event.target);
    if (nextTarget) scheduleShow(nextTarget);
  };
  const onFocusOut = (): void => hide();
  const onCloseEvent = (): void => hide();

  doc.addEventListener('pointerover', onPointerOver, true);
  doc.addEventListener('pointerout', onPointerOut, true);
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('focusout', onFocusOut, true);
  doc.addEventListener('click', onCloseEvent, true);
  doc.defaultView?.addEventListener('resize', onCloseEvent);
  doc.defaultView?.addEventListener('scroll', onCloseEvent, { capture: true });

  return {
    setTheme(nextTheme) {
      applyLocalEditorTheme(tooltip, nextTheme);
    },
    hide,
    dispose() {
      hide();
      doc.removeEventListener('pointerover', onPointerOver, true);
      doc.removeEventListener('pointerout', onPointerOut, true);
      doc.removeEventListener('focusin', onFocusIn, true);
      doc.removeEventListener('focusout', onFocusOut, true);
      doc.removeEventListener('click', onCloseEvent, true);
      doc.defaultView?.removeEventListener('resize', onCloseEvent);
      doc.defaultView?.removeEventListener('scroll', onCloseEvent, { capture: true });
      tooltip.remove();
    },
  };

  function show(nextTarget: HTMLElement, text: string): void {
    tooltip.textContent = text;
    tooltip.style.display = '';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    positionTooltip(nextTarget);
  }

  function positionTooltip(nextTarget: HTMLElement): void {
    const view = doc.defaultView;
    const viewportWidth = view?.innerWidth ?? doc.documentElement.clientWidth;
    const viewportHeight = view?.innerHeight ?? doc.documentElement.clientHeight;
    const targetRect = nextTarget.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const preferredTop = targetRect.bottom + TOOLTIP_OFFSET_PX;
    const flippedTop = targetRect.top - tooltipRect.height - TOOLTIP_OFFSET_PX;
    const top = preferredTop + tooltipRect.height <= viewportHeight - TOOLTIP_VIEWPORT_MARGIN_PX
      ? preferredTop
      : Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, flippedTop);
    const centeredLeft = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    const left = Math.max(
      TOOLTIP_VIEWPORT_MARGIN_PX,
      Math.min(centeredLeft, viewportWidth - tooltipRect.width - TOOLTIP_VIEWPORT_MARGIN_PX),
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function findTooltipTarget(value: EventTarget | null): HTMLElement | null {
    const element = value instanceof HTMLElement ? value : null;
    const nextTarget = element?.closest<HTMLElement>('[data-editor-tooltip]') ?? null;
    if (!nextTarget || !isOwnedTarget(nextTarget)) return null;
    return nextTarget;
  }

  function readTooltipText(element: HTMLElement): string {
    return element.dataset.editorTooltip?.trim() ?? '';
  }

  function isOwnedTarget(element: HTMLElement): boolean {
    const scope = options.scope?.();
    if (!scope) return root.contains(element);
    for (const item of scope) {
      if (item.contains(element)) return true;
    }
    return false;
  }
}
