# Inspector v2 Adapter Guide

Inspector v2 is a document-first framework contract. Adapters may add sections, properties, and browser controls, but persisted edits must always round-trip through the project document and patch reducer.

## Section Components

Use `createInspectorRegistry` when a package or project needs to contribute Inspector sections without changing the base adapter.

```ts
const registry = createInspectorRegistry<MyDocument>();

registry.register({
  id: 'gameplay.spawn',
  order: 40,
  requiredCapabilities: ['gameplay'],
  supports: context => context.targetKind === 'spawnPoint',
  createSections: context => [{
    id: 'spawn',
    title: 'Spawn',
    properties: [{
      path: 'spawn.team',
      label: 'Team',
      valueType: 'string',
      control: 'string',
      value: readTeam(context.document, context.activeId),
      readOnly: false,
      persistence: 'document',
      commitMode: 'blur',
      validate: value => typeof value === 'string' && value.trim()
        ? { ok: true, value: value.trim() }
        : { ok: false, message: 'Team is required.' },
    }],
  }],
});
```

Registration rules:

1. Component ids are stable public ids. Empty ids throw.
2. Components sort by `order`, then id.
3. Sections that omit `order` inherit their component order.
4. `requiredCapabilities` must be present in `InspectorSelectionContext.capabilities`.
5. `supports` is an additional project-specific predicate.
6. Duplicate ids use the registry conflict strategy: `error` by default, or `ignore` / `replace` when explicitly requested.
7. Editable document-backed property paths must be unique after base and extension sections are merged. Duplicate paths throw by default; `propertyConflict: 'ignore'` keeps the first field, and `propertyConflict: 'replace'` lets the later extension field replace the earlier one.

In the local harness, pass either a registry or an array of registrations:

```ts
createLocalEditorHarness({
  inspector: {
    components: registry,
    propertyConflict: 'error',
  },
  // other options
});
```

Component properties are included in the same edit validation path as adapter-provided properties. The document adapter still owns patch creation through `createSerializedPropertyPatch` and `createSerializedMultiPropertyPatch`.

## Custom Browser Controls

For project-specific controls, keep the data contract in `InspectorProperty` and register only the DOM renderer in the browser layer.

```ts
const controls = [{
  id: 'gameplay.team-swatch',
  customControl: 'gameplay.team-swatch',
  render({ doc, property, bindInput }) {
    const select = doc.createElement('select');
    for (const team of ['red', 'blue']) {
      const option = doc.createElement('option');
      option.value = team;
      option.textContent = team;
      option.selected = property.value === team;
      select.appendChild(option);
    }
    bindInput(select, { source: 'custom' });
    return select;
  },
}];
```

The matching property should use `control: 'custom'` and the same `customControl` id. `bindInput` attaches the target/path/value metadata needed by the shared edit event pipeline. If no custom renderer matches, the browser falls back to a read-only value.

Custom controls should not invent persistence. They only render a value and emit the same property metadata that built-in controls emit. The harness re-resolves the property from the merged Inspector object before creating a patch, so duplicate editable paths must be resolved by the merge conflict policy above.

## Adding a Persisted Field Safely

1. Add the field to the project document schema and default/migration path.
2. Expose an `InspectorProperty` with `persistence: 'document'`, `readOnly: false`, a stable `path`, and the narrowest useful `control`.
3. Add `validate` and `coerce` when the schema allows only a subset of the raw browser value.
4. Handle the same path in the adapter patch factory and reducer.
5. Verify undo/redo, dirty state, save/reload, and projection rebuild behavior.
6. Add unit tests for valid edits, invalid edits, optional-field deletion, and multi-selection if the field is shared.

Runtime observations should use `persistence: 'runtime'`, `runtimeOnly: true`, and read-only controls. Do not use runtime object state as the persistence source for document-backed fields.
