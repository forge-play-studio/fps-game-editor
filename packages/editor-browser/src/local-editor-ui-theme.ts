export const LOCAL_EDITOR_THEME_CLASS = 'fps-editor-workbench';
const STYLE_ID = 'fps-editor-workbench-theme';

export function ensureLocalEditorTheme(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${LOCAL_EDITOR_THEME_CLASS} {
      --fps-editor-bg: #181818;
      --fps-editor-chrome: #202020;
      --fps-editor-chrome-dark: #131313;
      --fps-editor-panel: #222222;
      --fps-editor-panel-soft: #2b2b2b;
      --fps-editor-field: #141414;
      --fps-editor-border: #383838;
      --fps-editor-border-soft: #303030;
      --fps-editor-divider: #101010;
      --fps-editor-text: #e6e6e6;
      --fps-editor-text-strong: #ffffff;
      --fps-editor-muted: #a0a0a0;
      --fps-editor-muted-strong: #c8c8c8;
      --fps-editor-accent: #2d75d6;
      --fps-editor-accent-soft: rgba(45, 117, 214, 0.28);
      --fps-editor-accent-strong: #58a6ff;
      --fps-editor-warn: #e5b454;
      --fps-editor-danger: #f85149;
      --fps-editor-button: #333333;
      --fps-editor-button-hover: #3d3d3d;
      --fps-editor-button-active: #2d75d6;
      --fps-editor-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --fps-editor-z-ui: 2147483639;
    }
    .${LOCAL_EDITOR_THEME_CLASS} * {
      box-sizing: border-box;
    }
    .${LOCAL_EDITOR_THEME_CLASS} button,
    .${LOCAL_EDITOR_THEME_CLASS} input {
      font-family: var(--fps-editor-font);
    }
    .${LOCAL_EDITOR_THEME_CLASS} button {
      -webkit-font-smoothing: antialiased;
    }
    .${LOCAL_EDITOR_THEME_CLASS} input {
      color-scheme: dark;
    }
    .${LOCAL_EDITOR_THEME_CLASS} button:focus-visible,
    .${LOCAL_EDITOR_THEME_CLASS} input:focus-visible {
      outline: 1px solid var(--fps-editor-accent-strong);
      outline-offset: 1px;
    }
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-panel-content]::-webkit-scrollbar,
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-workbench-region]::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-panel-content]::-webkit-scrollbar-thumb,
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-workbench-region]::-webkit-scrollbar-thumb {
      background: #5a5a5a;
    }
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-panel-content]::-webkit-scrollbar-track,
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-workbench-region]::-webkit-scrollbar-track {
      background: #171717;
    }
  `;
  doc.head.appendChild(style);
}
