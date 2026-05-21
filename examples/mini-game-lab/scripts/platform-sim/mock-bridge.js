(function () {
  const BRIDGE_SOURCE = 'forge-play-game-bridge';
  const POST_MSG = {
    COMMAND: 'command',
    EVENT: 'event',
    CONTEXT_CHANGE: 'context:change',
    CONTEXT_SELECTION: 'context:selection',
  };

  let runtime = null;
  let plugin = null;
  let scene = null;
  let sceneReadyEmitted = false;

  function post(type, payload) {
    if (window.parent === window) return;
    window.parent.postMessage({
      source: BRIDGE_SOURCE,
      type,
      payload,
      timestamp: Date.now(),
    }, '*');
  }

  function event(name, payload) {
    post(POST_MSG.EVENT, { name, ...(payload || {}) });
  }

  function initRuntimeWithScene() {
    if (!runtime || !scene || runtime.__mockSceneInitialized) return;
    runtime.__mockSceneInitialized = true;
    try {
      runtime.Editor && runtime.Editor.init && runtime.Editor.init(scene);
    } catch (error) {
      event('mock.runtime.init.failed', { error: error && error.message ? error.message : String(error) });
      return;
    }
    event('mock.runtime.initialized', { owner: runtime.owner || 'unknown' });
  }

  function registerEditorRuntime(next) {
    runtime = next;
    window.__bridgeProjectRuntime = next;
    event('mock.runtime.registered', { owner: next && next.owner || 'unknown' });
    initRuntimeWithScene();
  }

  function registerEditorPlugin(next) {
    plugin = next;
    window.__bridgeProjectPlugin = next;
    event('mock.plugin.registered', { id: next && next.id || 'unknown' });
  }

  window.__bridge = {
    ws: false,
    scene: false,
    messenger: {
      event,
      send: post,
    },
    editor: {
      get active() { return !!(runtime && runtime.Editor && runtime.Editor.active); },
      showInspector: () => runtime && runtime.Editor && runtime.Editor.showInspector && runtime.Editor.showInspector(),
      hideInspector: () => runtime && runtime.Editor && runtime.Editor.hideInspector && runtime.Editor.hideInspector(),
      setTool: (tool) => runtime && runtime.Editor && runtime.Editor.setTool && runtime.Editor.setTool(tool),
      getSelectedEntity: () => runtime && runtime.Editor && runtime.Editor.getSelectedEntity ? runtime.Editor.getSelectedEntity() : null,
      selectEntity: (entity, syncInspector) => runtime && runtime.Editor && runtime.Editor.selectEntity && runtime.Editor.selectEntity(entity, syncInspector),
      duplicateSelected: () => runtime && runtime.Editor && runtime.Editor.duplicateSelected ? runtime.Editor.duplicateSelected() : false,
      undo: () => runtime && runtime.Editor && runtime.Editor.undo ? runtime.Editor.undo() : false,
      redo: () => runtime && runtime.Editor && runtime.Editor.redo ? runtime.Editor.redo() : false,
      exportDocument: () => runtime && runtime.Editor && runtime.Editor.exportDocument ? runtime.Editor.exportDocument() : null,
      commitSavedDocument: (args) => runtime && runtime.Editor && runtime.Editor.commitSavedDocument ? runtime.Editor.commitSavedDocument(args) : false,
    },
    edit: {
      get active() { return !!(runtime && runtime.Edit && runtime.Edit.active); },
      enter: () => runtime && runtime.Edit && runtime.Edit.enter && runtime.Edit.enter(),
      exit: (save) => runtime && runtime.Edit && runtime.Edit.exit && runtime.Edit.exit(save),
      _focusSelected: () => runtime && runtime.Edit && runtime.Edit._focusSelected && runtime.Edit._focusSelected(),
      isViewportNavigationActive: () => runtime && runtime.Edit && runtime.Edit.isViewportNavigationActive ? runtime.Edit.isViewportNavigationActive() : false,
    },
    registerEditorRuntime,
    registerEditorPlugin,
  };

  if (window.__pendingEditorPlugin) {
    registerEditorPlugin(window.__pendingEditorPlugin);
    delete window.__pendingEditorPlugin;
  }
  if (window.__pendingEditorRuntime) {
    registerEditorRuntime(window.__pendingEditorRuntime);
    delete window.__pendingEditorRuntime;
  }

  function pollScene() {
    if (!scene) {
      scene = (window.gameInstance && window.gameInstance.scene) || null;
    }
    if (scene && !sceneReadyEmitted) {
      sceneReadyEmitted = true;
      window.__bridge.scene = true;
      event('mock.scene.ready', {});
      initRuntimeWithScene();
      return;
    }
    window.setTimeout(pollScene, scene ? 250 : 100);
  }
  pollScene();

  window.addEventListener('message', async (messageEvent) => {
    const msg = messageEvent.data;
    if (!msg || msg.source !== BRIDGE_SOURCE || msg.type !== POST_MSG.COMMAND) return;
    const payload = msg.payload || {};
    const { name, ...params } = payload;
    if (!name) return;

    if (!runtime || typeof runtime.handleCommand !== 'function') {
      event('mock.command.failed', { command: name, requestId: params.requestId, error: 'runtime_not_registered' });
      return;
    }

    try {
      await runtime.handleCommand(name, params);
      event('mock.command.completed', { command: name, requestId: params.requestId });
    } catch (error) {
      event('mock.command.failed', {
        command: name,
        requestId: params.requestId,
        error: error && error.message ? error.message : String(error),
      });
    }
  });

  event('mock.bridge.installed', {});
})();
