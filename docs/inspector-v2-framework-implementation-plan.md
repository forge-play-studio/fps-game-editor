# Inspector v2 Framework Implementation Plan

## Goal

Build Inspector v2 as a framework-level editor capability, not a collection of extra right-panel fields.

The Inspector must be driven by structured, validated, transaction-aware edit metadata. It should support project-specific authoring data, future runtime detail panels, multi-selection, undo/redo, save/reload semantics, and extension by adapters/plugins.

The source of truth for normal editing is the project document. Babylon runtime objects may provide preview/runtime context, but they must not silently become the primary persistence model.

## Non-Goals

1. Do not copy BabylonJS Editor's runtime inspector directly into the main editor path.
2. Do not add one-off fields directly to the current flat serialized property renderer.
3. Do not expose runtime-only Babylon properties as normal editable fields unless they are backed by document schema and save/reload behavior.
4. Do not break existing lightweight editor-lab and mini-game-lab flows while migrating.

## Review Gate Rule

After each implementation step, an independent review agent must be started before moving to the next step.

The review agent must:

1. Review the step objectively and strictly.
2. Inspect the diff and relevant tests.
3. Identify architecture drift, hidden runtime-first persistence, missing tests, API instability, or UX regressions.
4. Produce a clear verdict: `PASS` or `FAIL`.
5. Avoid editing files during the review.

The next implementation step may start only when the latest review verdict is `PASS`.

If the verdict is `FAIL`, fix the findings in the same step, rerun targeted verification, then start another independent review for that step.

## Global Acceptance Criteria

Inspector v2 is complete only when:

1. Inspector data is section-based, not path-prefix grouped.
2. Properties carry enough metadata for UI rendering, validation, persistence, mixed values, and transactions.
3. UI controls are selected by a renderer registry, not hard-coded field type branches.
4. Existing serialized-object adapters continue to work through a compatibility layer.
5. Mini-game-lab exposes document-backed sections for common node data, transform, asset/renderer, ground decal, material override, outline, and metadata where supported by schema.
6. Multi-selection remains supported for shared editable properties.
7. Undo/redo, dirty state, save/export, reload/rebuild expectations are preserved.
8. Runtime-only details are visibly separated from persisted editing.
9. Tests and docs cover the public framework contract.

## Step 1: Inspector v2 Data Model

### Objective

Introduce the framework contract for Inspector v2 without changing visible behavior.

### Work

1. Add core Inspector v2 types:
   - selection context
   - inspector section
   - inspector property
   - control kind
   - validation/coercion result
   - persistence/runtime flags
   - mixed value metadata
2. Add a compatibility adapter that converts current `SerializedObject` / `SerializedProperty` into Inspector v2 sections.
3. Keep the current inspector rendering behavior intact through the compatibility path.
4. Document the contract in code comments and framework docs.

### Expected Files

Likely areas:

1. `packages/editor-core/src/serialized-object.ts`
2. new `packages/editor-core/src/inspector.ts`
3. `packages/editor-browser/src/local-editor-ui-types.ts`
4. adapter/export files in `packages/editor-core/src/index.ts`

### Verification

1. `npm run typecheck`
2. targeted unit tests for compatibility conversion

### Review Gate

Independent reviewer checks:

1. Is the v2 model framework-level and stable enough for project adapters?
2. Does it preserve backward compatibility?
3. Is persistence explicit instead of implied by UI fields?
4. Are runtime-only and document-backed fields distinguishable?

Proceed only on `PASS`.

## Step 2: Section Renderer and Control Registry

### Objective

Replace the current path-prefix renderer with a structured section renderer and extensible control registry.

### Work

1. Render Inspector v2 sections with ordered, collapsible blocks.
2. Add control renderers:
   - readonly
   - string
   - number
   - boolean
   - enum
   - vec2/vec3/color vector grouping
   - color
   - asset reference
3. Preserve compact editor-panel ergonomics.
4. Keep the old flat renderer available only as compatibility input, not as the primary design.
5. Add search/filter support based on section title, property label, path, and tags.

### Expected Files

Likely areas:

1. `packages/editor-browser/src/local-editor-ui-panels.ts`
2. `packages/editor-browser/src/local-editor-ui-types.ts`
3. possible new `packages/editor-browser/src/local-editor-ui-inspector.ts`
4. `packages/editor-browser/src/local-editor-ui-theme.ts`

### Verification

1. `npm run typecheck`
2. browser/unit tests for renderer behavior where available
3. visual smoke check after implementation phase that changes UI

### Review Gate

Independent reviewer checks:

1. Does UI use the section/control metadata instead of hard-coded project assumptions?
2. Are controls accessible and stable in small inspector widths?
3. Do non-number fields submit typed values correctly?
4. Does compatibility behavior still render existing inspector content?

Proceed only on `PASS`.

## Step 3: Transaction, Validation, and Patch Bridge

### Objective

Make all Inspector v2 edits flow through a single validate/coerce/patch/transaction path.

### Work

1. Add property edit payloads that include target id(s), path, value, control kind, and edit source.
2. Add validation/coercion before patch creation.
3. Support commit timing metadata:
   - live input
   - commit on blur/change
   - immediate toggle/select
4. Keep undo/redo and dirty-state behavior document-first.
5. Preserve multi-select edit flow for shared fields.

### Expected Files

Likely areas:

1. `packages/editor-browser/src/local-editor-ui.ts`
2. `packages/editor/src/local-editor-harness.ts`
3. `packages/editor-core/src/inspector.ts`
4. tests under `tests/unit`

### Verification

1. `npm run typecheck`
2. targeted tests for edit payload coercion
3. targeted tests for multi-select mixed values

### Review Gate

Independent reviewer checks:

1. Are validation errors handled without corrupting document state?
2. Are numeric/color/boolean/enum values typed correctly?
3. Does undo/redo remain command-based rather than direct DOM/runtime mutation?
4. Does multi-selection keep mixed-value semantics?

Proceed only on `PASS`.

## Step 4: Project Adapter Inspector Components

### Objective

Expose mini-game-lab document-backed inspector sections using the new framework.

### Work

1. Convert mini-game-lab adapter from flat descriptors to Inspector v2 sections.
2. Add document-backed sections where supported:
   - Common
   - Transform
   - Renderer / Asset
   - Ground Decal
   - Material Override
   - Outline
   - Metadata
3. Connect existing scene-node field schema validators where possible.
4. Ensure fields that are not document-backed stay hidden or marked runtime-only.
5. Keep old editor-lab working through compatibility adapter or a minimal v2 adapter.

### Expected Files

Likely areas:

1. `examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session.ts`
2. `examples/mini-game-lab/src/fps-game-editor-adapter/scene-node-field-schema.ts`
3. `examples/editor-lab/src/lab-project.ts`
4. possibly adapter helper files under `examples/mini-game-lab/src/fps-game-editor-adapter`

### Verification

1. `npm run typecheck`
2. targeted adapter tests
3. browser smoke test for selecting instance/transform/group nodes

### Review Gate

Independent reviewer checks:

1. Are all exposed fields backed by document schema or clearly marked read-only/runtime-only?
2. Do material/outline/ground decal edits create valid document patches?
3. Are field labels and grouping coherent for real editor users?
4. Does editor-lab remain functional?

Proceed only on `PASS`.

## Step 5: Runtime Detail Separation

### Objective

Add a clear framework path for runtime-derived information without confusing it with persisted authoring fields.

### Work

1. Add section/property metadata for runtime-only details.
2. Add visual affordance for read-only/runtime-only fields.
3. Surface useful runtime info conservatively:
   - runtime class/type
   - material runtime kind
   - selected binding info
   - projection/root node diagnostics
4. Do not add runtime-editable fields unless a document-backed patch exists.

### Expected Files

Likely areas:

1. `packages/editor-babylon/src/*`
2. `packages/editor/src/local-editor-harness.ts`
3. `packages/editor-browser/src/local-editor-ui-panels.ts`
4. mini-game adapter integration points

### Verification

1. `npm run typecheck`
2. targeted tests for runtime-only metadata rendering
3. visual smoke check

### Review Gate

Independent reviewer checks:

1. Can a user distinguish persisted fields from runtime-only information?
2. Is Babylon runtime data treated as context, not as the persistence source of truth?
3. Are runtime diagnostics useful but not noisy?

Proceed only on `PASS`.

## Step 6: Extensibility and Customization API

### Objective

Make Inspector v2 extensible by future packages and project adapters.

### Work

1. Add registration APIs for inspector components/sections where appropriate.
2. Support project-defined custom controls without coupling editor-browser to mini-game-lab.
3. Define ordering, capability checks, and conflict behavior.
4. Add examples for adapter authors.
5. Document how to add a new persisted field safely.

### Expected Files

Likely areas:

1. `packages/editor-core/src/inspector.ts`
2. `packages/editor/src/local-editor-harness.ts`
3. `packages/editor-browser/src/*`
4. docs under `docs/`

### Verification

1. `npm run typecheck`
2. unit tests for registration/ordering
3. docs review

### Review Gate

Independent reviewer checks:

1. Is the extension API small and hard to misuse?
2. Does it avoid project-specific leakage into framework packages?
3. Are ordering and capability rules deterministic?
4. Is documentation enough for a future adapter author?

Proceed only on `PASS`.

## Step 7: End-to-End Verification and Cleanup

### Objective

Validate the full Inspector v2 behavior across framework, examples, and browser UI.

### Work

1. Add or update browser tests for inspector flows:
   - select object
   - edit transform
   - edit boolean
   - edit color
   - edit enum/asset reference where available
   - multi-select mixed values
2. Run full relevant checks.
3. Remove obsolete inspector rendering paths only if compatibility no longer needs them.
4. Update implementation notes and final migration docs.

### Verification

1. `npm run typecheck`
2. `npm run test:unit`
3. targeted browser tests
4. `npm run build:editor-lab` if UI bundling changes require it

### Review Gate

Independent reviewer checks:

1. Does the whole sequence satisfy the framework-level goal?
2. Are there leftover small-patch assumptions?
3. Are tests sufficient for the new public contract?
4. Is the final diff understandable and maintainable?

Proceed to final summary only on `PASS`.

## Final Summary Requirement

When all steps pass review, summarize:

1. What changed in each step.
2. Which files/modules became part of Inspector v2.
3. What fields are now persisted/document-backed.
4. What remains runtime-only.
5. Verification commands and results.
6. Review verdicts for every step.
7. Any remaining follow-up work that is intentionally out of scope.

## Operating Log

Use this section during implementation to record step completion and review verdicts.

| Step | Status | Review Verdict | Notes |
| --- | --- | --- | --- |
| 1. Inspector v2 Data Model | Complete | PASS | Added core Inspector v2 model, compatibility conversion, registry skeleton, and unit tests. First review failed; fixed compatibility order preservation, removed project-specific core ordering, and added multi-object/mixed/runtime-only tests. Verification: `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npm run test:unit -- inspector-core`. Full `npm run typecheck` currently hits baseline workspace dist/forge-play issues. |
| 2. Section Renderer and Control Registry | Complete | PASS | Added browser-side Inspector v2 UI types, harness-provided inspector objects, structured section renderer, control registry, typed property payload metadata, search filtering, and legacy fallback conversion. First review failed; fixed editable vec2/vec3 controls, typed enum option payloads, explicit `placement: summary` handling, and summary-only multi-select fallback. Second review failed; fixed editor-lab compatibility by narrowing scalar patch behavior at the adapter helper boundary. Verification: `npx tsc -p packages/editor-browser/tsconfig.json --noEmit`, `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npx tsc -p examples/editor-lab/tsconfig.json --noEmit`, `npx tsc -b packages/editor-protocol packages/editor-core packages/editor-browser`, `npm run test:unit`, `npm run check:boundaries`. Independent review verified Step 2 and returned PASS. `npx tsc -p packages/editor/tsconfig.json --noEmit` still reports baseline editor-babylon/forge-play dist and implicit-any issues; Step 2-specific type error was fixed. |
| 3. Transaction, Validation, and Patch Bridge | Complete | PASS | Added core edit payload creation with property-sourced coerce/validate, browser edit sources and commit timing handling (`live`, `blur`, `change`, `immediate`), harness-side validation before patch creation, payload metadata forwarding into document adapters, and multi-select transform patch protection in editor-lab. First review failed; fixed immediate rendering of validation errors, removed the browser-metadata fallback when a property cannot be resolved, and added default typed rejection for malformed number/boolean edits. Verification: `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npx tsc -p packages/editor-browser/tsconfig.json --noEmit`, `npx tsc -p examples/editor-lab/tsconfig.json --noEmit`, `npx tsc -b packages/editor-protocol packages/editor-core packages/editor-browser`, `npm run test:unit -- inspector-core editor-lab-source`, `npm run test:unit`, `npm run check:boundaries`. Second independent review verified fixes and returned PASS. Full `npm run typecheck` still reports baseline editor-babylon/editor-forge-play dist and existing implicit-any issues in `packages/editor`. |
| 4. Project Adapter Inspector Components | Complete | PASS | Added optional harness v2 inspector hooks, wired mini-game-lab to provide Inspector v2 objects, added document-backed Common, Transform, Renderer / Asset, Ground Decal, Material Override, Outline, and read-only Metadata sections where supported by `EditorSceneDocument`, connected patch validation to `scene-node-field-schema`, added generic document-backed field patches, preserved multi-select transform editing, and compiled transform nodes / visual overrides back into scene JSON. First review failed; fixed blank `groundDecal.textureId` normalization to delete the optional field, tightened texture id schema validation, and honored `allowDelete: false` in inspector-backed field validation. Verification: `npm run test:unit -- mini-game-editor-scene-session inspector-core editor-lab-source`, `npm run test:unit`, `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npx tsc -p packages/editor-browser/tsconfig.json --noEmit`, `npx tsc -b packages/editor-protocol packages/editor-core packages/editor-browser`, `npx tsc -p examples/editor-lab/tsconfig.json --noEmit`, `npm run check:boundaries`. Second independent review verified fixes and returned PASS. `npx tsc -p examples/mini-game-lab/tsconfig.json --noEmit` still reports baseline unresolved workspace aliases / Babylon loader aliases and existing implicit-any issues; Step 4-specific errors were fixed. Full `npm run typecheck` still reports baseline `packages/editor` dist and implicit-any issues. |
| 5. Runtime Detail Separation | Complete | PASS | Added a harness-level runtime inspector section hook, conservative default projection/root runtime diagnostics, mini-game-lab runtime binding/material-kind read-only sections, and stronger browser affordance for runtime-only readonly values. Runtime details use `persistence: runtime` / `runtimeOnly: true` and do not participate in document-backed patches. Verification: `npm run test:unit -- mini-game-editor-scene-session inspector-core editor-lab-source`, `npm run test:unit`, `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npx tsc -p packages/editor-browser/tsconfig.json --noEmit`, `npx tsc -b packages/editor-protocol packages/editor-core packages/editor-browser`, `npx tsc -p examples/editor-lab/tsconfig.json --noEmit`, `npm run check:boundaries`, `git diff --check`. Independent review returned PASS. `npx tsc -p examples/mini-game-lab/tsconfig.json --noEmit` still reports baseline unresolved workspace aliases / Babylon loader aliases and existing implicit-any issues. |
| 6. Extensibility and Customization API | Complete | PASS | Added deterministic `createInspectorRegistry` behavior with component ids, capability gates, support predicates, inherited ordering, conflict strategies, unregister/list/get handles, and edit-path inclusion through local harness inspector components. Added section merge conflict handling for editable document-backed property paths (`error` by default, `ignore`/`replace` opt-in) so extension rows cannot validate against a different field with the same path. Added browser custom control registrations with `customControl`, `controlOptions`, `bindInput`, explicit custom edit source support, and read-only fallback for non-document fields. Added `docs/inspector-v2-adapter-guide.md` with section component, custom control, property conflict, and persisted-field guidance. First review failed; fixed ambiguous duplicate path handling and added browser/harness extension contract tests. Verification: `npm run test:unit -- inspector-core inspector-browser inspector-harness`, `npm run test:unit -- inspector-core editor-lab-source mini-game-editor-scene-session`, `npm run test:unit`, `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npx tsc -p packages/editor-browser/tsconfig.json --noEmit`, `npx tsc -p examples/editor-lab/tsconfig.json --noEmit`, `npx tsc -b packages/editor-protocol packages/editor-core packages/editor-browser`, `npm run check:boundaries`, `git diff --check`. Independent re-review returned PASS. `npx tsc -p packages/editor/tsconfig.json --noEmit` still reports baseline editor-babylon/editor-forge-play dist and existing implicit-any issues; `npx tsc -p examples/mini-game-lab/tsconfig.json --noEmit` still reports baseline unresolved workspace / Babylon loader aliases and existing implicit-any issues. |
| 7. End-to-End Verification and Cleanup | Complete | PASS | Added editor-lab Inspector v2 fixture fields for document-backed active boolean, asset enum, and tint color, plus a narrow `reprojectIds` patch hint so non-transform document edits can refresh the projected node without turning transform edits into full reprojections. Expanded Playwright coverage to select/edit transform with undo/redo/save, edit boolean/enum/color fields, and verify multi-selection mixed transform values. Kept legacy serialized-object rendering paths because compatibility fallback remains part of the framework contract. Verification: `npm run test:unit`, `npm run test:browser`, `npm run build:editor-lab`, `npx tsc -p packages/editor-core/tsconfig.json --noEmit`, `npx tsc -p packages/editor-browser/tsconfig.json --noEmit`, `npx tsc -p examples/editor-lab/tsconfig.json --noEmit`, `npx tsc -b packages/editor-protocol packages/editor-core packages/editor-browser`, `npm run check:boundaries`, `git diff --check`. Independent review returned PASS. `npm run typecheck` still reports baseline `packages/editor` TS6305 dist and implicit-any issues; `npx tsc -p examples/mini-game-lab/tsconfig.json --noEmit` still reports baseline unresolved workspace / Babylon loader aliases and existing implicit-any issues. Optional `npm run test:pack` was not part of Step 7 acceptance and still requires a full package build first (`editor-forge-play` dist missing). |
