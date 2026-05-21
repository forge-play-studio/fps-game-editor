# Editor Package Migration Baseline

Date: 2026-05-15

## Baseline Scope

This document freezes the current migration source for extracting `lumber_order/src/editor-package` into `fps-game-editor`. It is a baseline record only. No source code has been moved or replaced in this round.

- Source project: `/Users/admin/work/UGIT/lumber_order`
- Source branch: `feat/editor-asset-manager`
- Source commit: `6f4d8b2`
- Source path: `src/editor-package`
- Target repository: `/Users/admin/work/UGIT/fps-game-editor`
- Target commit before Round 0 changes: `0e1bd6c`
- Total TypeScript files: 19
- Total source lines: 8509
- Public export rows captured: 111

## Source File Inventory

| File | Lines |
|---|---:|
| `src/editor-package/adapter.ts` | 139 |
| `src/editor-package/document.ts` | 2833 |
| `src/editor-package/index.ts` | 122 |
| `src/editor-package/runtime-core/camera-controller.ts` | 232 |
| `src/editor-package/runtime-core/edit-session.ts` | 357 |
| `src/editor-package/runtime-core/event-guard.ts` | 78 |
| `src/editor-package/runtime-core/input-controller.ts` | 216 |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 88 |
| `src/editor-package/runtime-core/inspector-host.ts` | 555 |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 507 |
| `src/editor-package/runtime-core/monitor.ts` | 1028 |
| `src/editor-package/runtime-core/outline-adapter.ts` | 352 |
| `src/editor-package/runtime-core/selection-controller.ts` | 398 |
| `src/editor-package/runtime-core/tool-controller.ts` | 82 |
| `src/editor-package/runtime-core/types.ts` | 4 |
| `src/editor-package/runtime.ts` | 919 |
| `src/editor-package/scene-node-duplicate.ts` | 262 |
| `src/editor-package/scene-node-field-schema.ts` | 126 |
| `src/editor-package/types.ts` | 211 |

## Public Export Baseline

This table records top-level named exports, type exports, async function exports, and re-export blocks. It is the API comparison source for migration reviews.

| File | Line | Export |
|---|---:|---|
| `src/editor-package/adapter.ts` | 98 | `export const lumberOrderEditorPlugin: ProjectEditorPlugin = {` |
| `src/editor-package/document.ts` | 59 | `export const PROJECT_EDITOR_SCENE_NODE_ERROR_CODES = sceneJsonV2Rules.errorCodes;` |
| `src/editor-package/document.ts` | 60 | `export type ProjectEditorSceneNodeErrorCode = typeof PROJECT_EDITOR_SCENE_NODE_ERROR_CODES[keyof typeof PROJECT_EDITOR_SCENE_NODE_ERROR_CODES];` |
| `src/editor-package/document.ts` | 62 | `export class ProjectEditorSceneNodeError extends Error {` |
| `src/editor-package/document.ts` | 73 | `export interface ProjectEditorDocumentState {` |
| `src/editor-package/document.ts` | 78 | `export interface ProjectDocumentBindingLocation {` |
| `src/editor-package/document.ts` | 1341 | `export function resolveProjectDocumentBindingLocation(` |
| `src/editor-package/document.ts` | 1348 | `export function loadProjectEditorDocument(sceneConfig: SceneConfig = configService.getSceneConfig()): ProjectEditorDocumentState {` |
| `src/editor-package/document.ts` | 1440 | `export function ensureProjectEditorDocumentLoaded(): ProjectEditorDocumentState {` |
| `src/editor-package/document.ts` | 1445 | `export function getProjectEditorDocumentState(): ProjectEditorDocumentState {` |
| `src/editor-package/document.ts` | 1449 | `export function getProjectEditorOriginalDocument(): SceneConfig {` |
| `src/editor-package/document.ts` | 1453 | `export function getProjectEditorWorkingDocument(): SceneConfig {` |
| `src/editor-package/document.ts` | 1457 | `export function resetProjectEditorDocument(): ProjectEditorDocumentState {` |
| `src/editor-package/document.ts` | 1462 | `export function isProjectEditorDocumentDirty(): boolean {` |
| `src/editor-package/document.ts` | 1466 | `export function exportProjectEditorDocument(): ProjectEditorDocumentExport {` |
| `src/editor-package/document.ts` | 1482 | `export function commitProjectEditorDocumentSave(` |
| `src/editor-package/document.ts` | 1527 | `export function canUndoProjectEditorDocumentChange(): boolean {` |
| `src/editor-package/document.ts` | 1531 | `export function canRedoProjectEditorDocumentChange(): boolean {` |
| `src/editor-package/document.ts` | 1535 | `export interface ProjectEditorAddAssetNodeArgs {` |
| `src/editor-package/document.ts` | 1540 | `export interface ProjectEditorCreateSceneNodeArgs {` |
| `src/editor-package/document.ts` | 1552 | `export interface ProjectEditorPatchSceneNodeArgs {` |
| `src/editor-package/document.ts` | 1695 | `export function addProjectEditorAssetNode(` |
| `src/editor-package/document.ts` | 1739 | `export function addProjectEditorSceneNode(` |
| `src/editor-package/document.ts` | 1788 | `export function patchProjectEditorSceneNode(` |
| `src/editor-package/document.ts` | 1865 | `export function removeProjectEditorSceneNode(` |
| `src/editor-package/document.ts` | 1917 | `export function beginProjectEditorTransformBatch(): void {` |
| `src/editor-package/document.ts` | 1922 | `export function endProjectEditorTransformBatch(): void {` |
| `src/editor-package/document.ts` | 2443 | `export function undoProjectEditorDocumentChange(context?: ProjectEditorPluginContext): ProjectEditorRuntimeChange | null {` |
| `src/editor-package/document.ts` | 2461 | `export function redoProjectEditorDocumentChange(context?: ProjectEditorPluginContext): ProjectEditorRuntimeChange | null {` |
| `src/editor-package/document.ts` | 2479 | `export function applyProjectDocumentChange(` |
| `src/editor-package/document.ts` | 2555 | `export function applyProjectMaterialDocumentChange(change: CanonicalMaterialChange): boolean {` |
| `src/editor-package/document.ts` | 2705 | `export function applyProjectOutlineDocumentChange(change: CanonicalOutlineChange): boolean {` |
| `src/editor-package/document.ts` | 2797 | `export function duplicateProjectEditorSelection(` |
| `src/editor-package/index.ts` | 24 | `export function registerProjectEditorPlugin(): void {` |
| `src/editor-package/index.ts` | 35 | `export function registerProjectEditorRuntime(runtime: ProjectEditorRuntime): void {` |
| `src/editor-package/index.ts` | 46 | `export function registerProjectEditorRuntimeBridge(): void {` |
| `src/editor-package/index.ts` | 104 | `export { lumberOrderEditorPlugin } from './adapter'; export { canRedoProjectEditorDocumentChange, canUndoProjectEditorDocumentChange, ensureProjectEditorDocumentLoaded, exportProjectEditorDocument, getProjectEditorDocumentState, getProjectEditorOriginalDocument, getProjectEditorWorkingDocument, isProjectEditorDocumentDirty, loadProjectEditorDocument, redoProjectEditorDocumentChange, resetProjectEditorDocument, resolveProjectDocumentBindingLocation, undoProjectEditorDocumentChange, } from './document';` |
| `src/editor-package/index.ts` | 120 | `export { createProjectEditorRuntimeBridge } from './runtime'; export type { ProjectEditorPlugin, ProjectEditorRuntime, ProjectPersistentBinding } from './types'; export type { ProjectDocumentBindingLocation, ProjectEditorDocumentState } from './document'; ` |
| `src/editor-package/runtime-core/camera-controller.ts` | 10 | `export interface ProjectViewportCameraCtx {` |
| `src/editor-package/runtime-core/camera-controller.ts` | 39 | `export async function createProjectViewportCamera(` |
| `src/editor-package/runtime-core/camera-controller.ts` | 115 | `export function attachProjectViewportMovement(scene: RuntimeScene, ctx: ProjectViewportCameraCtx): any {` |
| `src/editor-package/runtime-core/camera-controller.ts` | 164 | `export function disposeProjectViewportCamera(scene: RuntimeScene, ctx: ProjectViewportCameraCtx | null): void {` |
| `src/editor-package/runtime-core/camera-controller.ts` | 182 | `export function focusProjectViewportSelection(camera: RuntimeCamera | null, node: RuntimeNode | null): boolean {` |
| `src/editor-package/runtime-core/edit-session.ts` | 64 | `export function createProjectEditSession(options: ProjectEditSessionOptions) {` |
| `src/editor-package/runtime-core/event-guard.ts` | 69 | `export function activateProjectEventGuard(canvas: HTMLCanvasElement): void {` |
| `src/editor-package/runtime-core/event-guard.ts` | 74 | `export function deactivateProjectEventGuard(): void {` |
| `src/editor-package/runtime-core/input-controller.ts` | 1 | `export type ProjectEditorTool = 'pick' | 'move' | 'rotate' | 'scale';` |
| `src/editor-package/runtime-core/input-controller.ts` | 37 | `export const ProjectEditorInput = {` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 3 | `export type InspectorTransformTool = Exclude<ProjectEditorTool, 'pick'>;` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 5 | `export function getInspectorContainer(): HTMLElement | null {` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 10 | `export function readInspectorButtonLabel(button: HTMLButtonElement): string {` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 35 | `export function findInspectorTransformButtons(container = getInspectorContainer()) {` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 50 | `export function setInspectorPicking(enabled: boolean, container = getInspectorContainer()) {` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 61 | `export function isPickingToggleButton(button: HTMLButtonElement): 'enable' | 'disable' | null {` |
| `src/editor-package/runtime-core/inspector-adapter.ts` | 68 | `export function syncInspectorToolState(tool: ProjectEditorTool, container = getInspectorContainer()) {` |
| `src/editor-package/runtime-core/inspector-host.ts` | 361 | `export function createProjectInspectorHost(options: CreateProjectInspectorHostOptions) {` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 12 | `export const MATERIAL_CANONICAL_PATHS = [` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 37 | `export type CanonicalMaterialChange = {` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 132 | `export function resolveMaterialRuntimeKind(material: any): ProjectMaterialRuntimeKind {` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 398 | `export function adaptMaterialPropertyChange(` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 432 | `export function applyMaterialValueToRuntimeMaterial(` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 480 | `export function resolveMaterialOwnerNode(rootNode: RuntimeNode | null, ownerNodePath: string): RuntimeNode | null {` |
| `src/editor-package/runtime-core/material-property-adapter.ts` | 500 | `export function applyMaterialValueToRuntimeNode(` |
| `src/editor-package/runtime-core/monitor.ts` | 35 | `export type ProjectRuntimeMonitorChange = {` |
| `src/editor-package/runtime-core/monitor.ts` | 351 | `export function createProjectRuntimeMonitor(options: ProjectRuntimeMonitorOptions) {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 13 | `export const OUTLINE_PROPERTY_KEYS = [` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 19 | `export type OutlinePropertyKey = (typeof OUTLINE_PROPERTY_KEYS)[number];` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 21 | `export type OutlineTargetState = {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 26 | `export const OUTLINE_CANONICAL_PATHS = [` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 32 | `export type CanonicalOutlineChange = {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 92 | `export function isOutlinePropertyKey(value: string): value is OutlinePropertyKey {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 96 | `export function normalizeInstancedMeshOutlineProperties(entity: any): void {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 106 | `export function resolveOutlineTarget(entity: any): OutlineTargetState {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 179 | `export function resolveOutlineOwnerNode(rootNode: RuntimeNode | null): {` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 263 | `export function adaptOutlinePropertyChange(` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 297 | `export function applyOutlineValueToRuntimeNode(` |
| `src/editor-package/runtime-core/outline-adapter.ts` | 337 | `export function applyOutlinePropertyChange(args: OutlinePropertyChangeArgs): OutlineTargetState {` |
| `src/editor-package/runtime-core/selection-controller.ts` | 48 | `export function createProjectSelectionController(` |
| `src/editor-package/runtime-core/tool-controller.ts` | 11 | `export function createProjectToolController(options: CreateProjectToolControllerOptions) {` |
| `src/editor-package/runtime-core/types.ts` | 1 | `export type RuntimeScene = any;` |
| `src/editor-package/runtime-core/types.ts` | 2 | `export type RuntimeCamera = any;` |
| `src/editor-package/runtime-core/types.ts` | 3 | `export type RuntimeNode = any;` |
| `src/editor-package/runtime.ts` | 273 | `export function createProjectEditorRuntimeBridge(): ProjectEditorRuntime {` |
| `src/editor-package/scene-node-duplicate.ts` | 13 | `export interface SceneNodeDuplicateCommandEntry {` |
| `src/editor-package/scene-node-duplicate.ts` | 29 | `export function canDuplicateSceneNodeBinding(binding: ProjectPersistentBinding): boolean {` |
| `src/editor-package/scene-node-duplicate.ts` | 137 | `export function createSceneNodeDuplicateEntry(args: {` |
| `src/editor-package/scene-node-duplicate.ts` | 176 | `export function applySceneNodeDuplicateEntry(` |
| `src/editor-package/scene-node-duplicate.ts` | 214 | `export function undoSceneNodeDuplicateEntry(` |
| `src/editor-package/scene-node-duplicate.ts` | 243 | `export function redoSceneNodeDuplicateEntry(` |
| `src/editor-package/scene-node-field-schema.ts` | 3 | `export type SceneNodeFieldPatch = {` |
| `src/editor-package/scene-node-field-schema.ts` | 76 | `export const SCENE_NODE_FIELD_SCHEMA: ReadonlyArray<SceneNodeFieldSchemaEntry> = [` |
| `src/editor-package/scene-node-field-schema.ts` | 122 | `export function resolveSceneNodeFieldSchema(path: string, nodeKind: SceneNodeConfig['kind']): SceneNodeFieldSchemaEntry | null {` |
| `src/editor-package/types.ts` | 3 | `export type ProjectPersistentBinding = {` |
| `src/editor-package/types.ts` | 9 | `export type ProjectPersistentBindingSnapshot = {` |
| `src/editor-package/types.ts` | 14 | `export type ProjectRuntimeProp = 'position' | 'rotation' | 'scaling';` |
| `src/editor-package/types.ts` | 16 | `export type ProjectMaterialRuntimeKind = 'pbr' | 'standard' | 'unknown';` |
| `src/editor-package/types.ts` | 18 | `export type ProjectMaterialProp =` |
| `src/editor-package/types.ts` | 42 | `export type ProjectMaterialValue =` |
| `src/editor-package/types.ts` | 49 | `export type ProjectOutlineProp =` |
| `src/editor-package/types.ts` | 54 | `export type ProjectOutlineValue =` |
| `src/editor-package/types.ts` | 60 | `export interface ProjectRotation3D {` |
| `src/editor-package/types.ts` | 66 | `export interface ProjectEditorDocumentExport {` |
| `src/editor-package/types.ts` | 72 | `export interface ProjectEditorDocumentCommitArgs {` |
| `src/editor-package/types.ts` | 79 | `export interface ProjectEditorDuplicateResult {` |
| `src/editor-package/types.ts` | 83 | `export interface ProjectEditorRuntimeApi {` |
| `src/editor-package/types.ts` | 98 | `export interface ProjectEditRuntimeApi {` |
| `src/editor-package/types.ts` | 106 | `export interface ProjectEditorRuntime {` |
| `src/editor-package/types.ts` | 113 | `export interface ProjectSelectionController {` |
| `src/editor-package/types.ts` | 128 | `export type ProjectEditorRuntimeChange =` |
| `src/editor-package/types.ts` | 160 | `export interface ProjectEditorPluginContext {` |
| `src/editor-package/types.ts` | 165 | `export interface ProjectEditorPlugin {` |

## Coupling Baseline

These are the current coupling points that must be preserved as behavior but not leaked into generic `fps-game-editor` packages. Project-specific coupling may only live in a project adapter or in `examples/lumber-order-adapter`.

| Kind | File | Line | Reference |
|---|---|---:|---|
| Game runtime globals | `src/editor-package/adapter.ts` | 20 | `function getSceneBuilder(game: any): any | null {` |
| Game runtime globals | `src/editor-package/adapter.ts` | 21 | `return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;` |
| Game runtime globals | `src/editor-package/adapter.ts` | 24 | `function getSceneNodeRuntimeMap(game: any): Map<string, any> | null {` |
| Game runtime globals | `src/editor-package/adapter.ts` | 25 | `const sceneBuilder = getSceneBuilder(game);` |
| Game runtime globals | `src/editor-package/adapter.ts` | 26 | `const sceneNodeRuntimes = sceneBuilder?.sceneNodeRuntimes;` |
| Game runtime globals | `src/editor-package/adapter.ts` | 40 | `if (game && typeof game.getSceneNodeRuntime === 'function') {` |
| Game runtime globals | `src/editor-package/adapter.ts` | 41 | `const resolved = game.getSceneNodeRuntime(nodeId);` |
| Game runtime globals | `src/editor-package/adapter.ts` | 44 | `return getSceneNodeRuntimeMap(game)?.get(nodeId) ?? null;` |
| Game runtime globals | `src/editor-package/adapter.ts` | 48 | `const sceneNodeRuntimes = getSceneNodeRuntimeMap(game);` |
| Project config/schema | `src/editor-package/document.ts` | 1 | `import { configService } from '../config';` |
| Project config/schema | `src/editor-package/document.ts` | 2 | `import { validateSceneJsonV2 } from '../config/SceneJsonV2Validator';` |
| Project config/schema | `src/editor-package/document.ts` | 3 | `import sceneJsonV2Rules from '../config/scene-json-v2-rules.json';` |
| Project config/schema | `src/editor-package/document.ts` | 19 | `} from '../config';` |
| Game runtime globals | `src/editor-package/document.ts` | 425 | `function getSceneBuilder(context?: ProjectEditorPluginContext): any | null {` |
| Game runtime globals | `src/editor-package/document.ts` | 427 | `return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;` |
| Game runtime globals | `src/editor-package/document.ts` | 435 | `const sceneBuilder = getSceneBuilder(context);` |
| Game runtime globals | `src/editor-package/document.ts` | 436 | `if (!sceneBuilder?.addSceneNodeFromConfig) return null;` |
| Game runtime globals | `src/editor-package/document.ts` | 437 | `if (asset) sceneBuilder.upsertSceneAssetConfig?.(cloneJson(asset));` |
| Game runtime globals | `src/editor-package/document.ts` | 438 | `return sceneBuilder.addSceneNodeFromConfig(cloneJson(node), null);` |
| Game runtime globals | `src/editor-package/document.ts` | 442 | `const sceneBuilder = getSceneBuilder(context);` |
| Game runtime globals | `src/editor-package/document.ts` | 443 | `return sceneBuilder?.removeSceneNode?.(nodeId) ?? false;` |
| Project config/schema | `src/editor-package/document.ts` | 472 | `const errors = validateSceneJsonV2(sceneConfig, {` |
| Project config/schema | `src/editor-package/document.ts` | 1348 | `export function loadProjectEditorDocument(sceneConfig: SceneConfig = configService.getSceneConfig()): ProjectEditorDocumentState {` |
| Project config/schema | `src/editor-package/document.ts` | 1458 | `const source = documentState.original ?? configService.getSceneConfig();` |
| Project config/schema | `src/editor-package/document.ts` | 1512 | `configService.replaceSceneConfig(cloneSceneConfig(next));` |
| Project config/schema | `src/editor-package/document.ts` | 1682 | `const errors = validateSceneJsonV2(sceneConfig, {` |
| Game runtime globals | `src/editor-package/document.ts` | 2018 | `context?.game && typeof context.game.getSceneNodeRuntime === 'function'` |
| Game runtime globals | `src/editor-package/document.ts` | 2019 | `? context.game.getSceneNodeRuntime(entry.binding.nodeId)` |
| Game runtime globals | `src/editor-package/document.ts` | 2074 | `context?.game && typeof context.game.getSceneNodeRuntime === 'function'` |
| Game runtime globals | `src/editor-package/document.ts` | 2075 | `? context.game.getSceneNodeRuntime(entry.binding.nodeId)` |
| Game runtime globals | `src/editor-package/document.ts` | 2105 | `context?.game && typeof context.game.getSceneNodeRuntime === 'function'` |
| Game runtime globals | `src/editor-package/document.ts` | 2106 | `? context.game.getSceneNodeRuntime(entry.binding.nodeId)` |
| Game runtime globals | `src/editor-package/document.ts` | 2137 | `if (context?.game && typeof context.game.getSceneNodeRuntime === 'function') {` |
| Game runtime globals | `src/editor-package/document.ts` | 2140 | `const rootNode = context.game.getSceneNodeRuntime(node.id);` |
| Game runtime globals | `src/editor-package/document.ts` | 2173 | `context?.game && typeof context.game.getSceneNodeRuntime === 'function'` |
| Game runtime globals | `src/editor-package/document.ts` | 2174 | `? context.game.getSceneNodeRuntime(entry.binding.nodeId)` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 26 | `window.__pendingEditorPlugin = lumberOrderEditorPlugin;` |
| Browser globals | `src/editor-package/index.ts` | 26 | `window.__pendingEditorPlugin = lumberOrderEditorPlugin;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 28 | `const bridge = window.__bridge;` |
| Browser globals | `src/editor-package/index.ts` | 28 | `const bridge = window.__bridge;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 36 | `window.__pendingEditorRuntime = runtime;` |
| Browser globals | `src/editor-package/index.ts` | 36 | `window.__pendingEditorRuntime = runtime;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 38 | `const bridge = window.__bridge;` |
| Browser globals | `src/editor-package/index.ts` | 38 | `const bridge = window.__bridge;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 61 | `const bridge = window.__bridge;` |
| Browser globals | `src/editor-package/index.ts` | 61 | `const bridge = window.__bridge;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 75 | `__BRIDGE_EDITOR_RUNTIME_STATE?: ForgePlayRuntimeRegistryState;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 77 | `const registryState = win.__BRIDGE_EDITOR_RUNTIME_STATE;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 78 | `const previousLegacy = registryState?.legacyRuntime ?? win.__bridgeLegacyEditorRuntime ?? null;` |
| Forge Play bridge globals | `src/editor-package/index.ts` | 101 | `win.__bridgeLegacyEditorRuntime = proxy;` |
| Browser globals | `src/editor-package/runtime-core/camera-controller.ts` | 12 | `canvas: HTMLCanvasElement | null;` |
| Babylon runtime | `src/editor-package/runtime-core/camera-controller.ts` | 45 | `if ((window as any).BABYLON?.UniversalCamera) {` |
| Babylon runtime | `src/editor-package/runtime-core/camera-controller.ts` | 46 | `({ UniversalCamera, Vector3 } = (window as any).BABYLON);` |
| Babylon runtime | `src/editor-package/runtime-core/camera-controller.ts` | 91 | `const Vector3Ctor = (window as any).BABYLON?.Vector3;` |
| Babylon runtime | `src/editor-package/runtime-core/camera-controller.ts` | 118 | `const Vector3 = (window as any).BABYLON?.Vector3;` |
| Babylon runtime | `src/editor-package/runtime-core/camera-controller.ts` | 209 | `const Vector3 = (window as any).BABYLON?.Vector3;` |
| Browser globals | `src/editor-package/runtime-core/edit-session.ts` | 60 | `function getRenderCanvas(scene: RuntimeScene): HTMLCanvasElement | null {` |
| Babylon runtime | `src/editor-package/runtime-core/event-guard.ts` | 2 | `const INSPECTOR = '#babylon-inspector-container, #inspector-host';` |
| Browser globals | `src/editor-package/runtime-core/event-guard.ts` | 5 | `const guard = { active: false, canvas: null as HTMLCanvasElement | null };` |
| Babylon runtime | `src/editor-package/runtime-core/event-guard.ts` | 28 | `if ((e.target as Element)?.closest?.(INSPECTOR)) return;` |
| Browser globals | `src/editor-package/runtime-core/event-guard.ts` | 45 | `document.addEventListener(type, handler, true);` |
| Browser globals | `src/editor-package/runtime-core/event-guard.ts` | 48 | `document.addEventListener('wheel', (e) => {` |
| Babylon runtime | `src/editor-package/runtime-core/event-guard.ts` | 50 | `if ((e.target as Element)?.closest?.(INSPECTOR)) return;` |
| Browser globals | `src/editor-package/runtime-core/event-guard.ts` | 58 | `window.addEventListener(type, (e) => {` |
| Babylon runtime | `src/editor-package/runtime-core/event-guard.ts` | 60 | `if ((e.target as Element)?.closest?.(INSPECTOR)) return;` |
| Browser globals | `src/editor-package/runtime-core/event-guard.ts` | 69 | `export function activateProjectEventGuard(canvas: HTMLCanvasElement): void {` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 4 | `getCanvas: () => HTMLCanvasElement | null;` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 24 | `const el = target instanceof HTMLElement ? target : null;` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 159 | `window.addEventListener('keydown', this._onKeyDown);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 160 | `window.addEventListener('keyup', this._onKeyUp);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 161 | `window.addEventListener('pointerdown', this._onPointerDown, true);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 162 | `window.addEventListener('pointermove', this._onPointerMove, true);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 163 | `window.addEventListener('pointerup', this._onPointerUp, true);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 164 | `window.addEventListener('blur', this._onBlur);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 170 | `if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 171 | `if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 172 | `if (this._onPointerDown) window.removeEventListener('pointerdown', this._onPointerDown, true);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 173 | `if (this._onPointerMove) window.removeEventListener('pointermove', this._onPointerMove, true);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 174 | `if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp, true);` |
| Browser globals | `src/editor-package/runtime-core/input-controller.ts` | 175 | `if (this._onBlur) window.removeEventListener('blur', this._onBlur);` |
| Browser globals | `src/editor-package/runtime-core/inspector-adapter.ts` | 5 | `export function getInspectorContainer(): HTMLElement | null {` |
| Browser globals | `src/editor-package/runtime-core/inspector-adapter.ts` | 6 | `return document.getElementById('babylon-inspector-container')` |
| Browser globals | `src/editor-package/runtime-core/inspector-adapter.ts` | 7 | `|| document.querySelector('#inspector-host, #babylon-inspector-container');` |
| Browser globals | `src/editor-package/runtime-core/inspector-adapter.ts` | 13 | `? document.getElementById(describedById)?.textContent` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 8 | `const INSPECTOR_V2_URL = 'https://preview.babylonjs.com/inspector/babylon.inspector-v2.bundle.js';` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 28 | `const INSPECTOR_HIGHLIGHT_SETTING_KEY = 'Babylon/Inspector/HighlightSelectedEntity';` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 31 | `const proto = Selection.prototype as Selection & { __forgeProjectPatched?: boolean };` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 33 | `const original = Selection.prototype.addRange;` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 34 | `Selection.prototype.addRange = function patchedAddRange(range: Range) {` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 42 | `const element = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 243 | `localStorage.setItem(INSPECTOR_HIGHLIGHT_SETTING_KEY, 'false');` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 246 | `const BABYLON = (window as any).BABYLON;` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 247 | `patchInstancedMeshOutlineProperties(BABYLON, '__forgeInstancedOutlinePatched');` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 253 | `patchBabylonGizmoClasses((window as any).BABYLON, '__forgeWindow');` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 258 | `import('@babylonjs/core/Gizmos/gizmoManager'),` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 259 | `import('@babylonjs/core/Gizmos/rotationGizmo'),` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 260 | `import('@babylonjs/core/Gizmos/planeRotationGizmo'),` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 268 | `if (document.getElementById('project-inspector-style')) return;` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 269 | `const style = document.createElement('style');` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 282 | `document.head.appendChild(style);` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 334 | `const ensureInspectorReady = (window as any).ensureInspectorReady;` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 335 | `if (typeof ensureInspectorReady === 'function') {` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 337 | `const localInspector = await ensureInspectorReady();` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 342 | `const existing = (window as any).INSPECTOR as InspectorV2 | undefined;` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 345 | `const url = (window as any).BRIDGE_INSPECTOR_URL || INSPECTOR_V2_URL;` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 348 | `const script = document.createElement('script');` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 352 | `document.head.appendChild(script);` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 354 | `const loaded = (window as any).INSPECTOR as InspectorV2 | undefined;` |
| Forge Play bridge globals | `src/editor-package/runtime-core/inspector-host.ts` | 370 | `const messenger = window.__bridge?.messenger;` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 370 | `const messenger = window.__bridge?.messenger;` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 376 | `document.removeEventListener('dblclick', dblclickHandler);` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 393 | `?? (window as any).BABYLON?.Inspector?.OnPropertyChangedObservable` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 435 | `const target = rawTarget instanceof HTMLElement ? rawTarget : null;` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 445 | `document.addEventListener('dblclick', dblclickHandler);` |
| Browser globals | `src/editor-package/runtime-core/inspector-host.ts` | 488 | `window.setTimeout(() => tuneOutlineLayer(scene), 200);` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 496 | `initialTab: (window as any).BABYLON?.DebugLayerTab?.Properties ?? 0,` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 508 | `const Inspector = (window as any).BABYLON?.Inspector;` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 512 | `initialTab: (window as any).BABYLON?.DebugLayerTab?.Properties ?? 0,` |
| Babylon runtime | `src/editor-package/runtime-core/inspector-host.ts` | 536 | `const Inspector = (window as any).BABYLON?.Inspector;` |
| Babylon runtime | `src/editor-package/runtime-core/material-property-adapter.ts` | 1 | `import { Color3 } from '@babylonjs/core/Maths/math.color';` |
| Babylon runtime | `src/editor-package/runtime-core/material-property-adapter.ts` | 2 | `import { Texture } from '@babylonjs/core/Materials/Textures/texture';` |
| Browser globals | `src/editor-package/runtime-core/monitor.ts` | 960 | `window.addEventListener('pointerdown', onPointerDown, true);` |
| Browser globals | `src/editor-package/runtime-core/monitor.ts` | 961 | `window.addEventListener('pointerup', onPointerUp, true);` |
| Browser globals | `src/editor-package/runtime-core/monitor.ts` | 976 | `window.removeEventListener('pointerdown', onPointerDown, true);` |
| Browser globals | `src/editor-package/runtime-core/monitor.ts` | 977 | `window.removeEventListener('pointerup', onPointerUp, true);` |
| Babylon runtime | `src/editor-package/runtime-core/outline-adapter.ts` | 1 | `import { Color3 } from '@babylonjs/core/Maths/math.color';` |
| Project config/schema | `src/editor-package/runtime-core/outline-adapter.ts` | 5 | `} from '../../config';` |
| Browser globals | `src/editor-package/runtime-core/selection-controller.ts` | 310 | `const target = rawTarget instanceof HTMLElement ? rawTarget : null;` |
| Browser globals | `src/editor-package/runtime-core/selection-controller.ts` | 361 | `document.addEventListener('pointerdown', onPointerDown, true);` |
| Browser globals | `src/editor-package/runtime-core/selection-controller.ts` | 367 | `document.removeEventListener('pointerdown', selectionTrackingCtx.onPointerDown, true);` |
| Babylon runtime | `src/editor-package/runtime-core/tool-controller.ts` | 23 | `const GizmoManager = (window as any).BABYLON?.GizmoManager || (window as any).__forgeGizmoManagerCtor;` |
| Project assets/services | `src/editor-package/runtime.ts` | 26 | `} from '../services/AssetManager';` |
| Project assets/services | `src/editor-package/runtime.ts` | 27 | `import { isModelRegistered } from '../assets';` |
| Project assets/services | `src/editor-package/runtime.ts` | 31 | `} from '../services/SceneAssetPlacement';` |
| Project assets/services | `src/editor-package/runtime.ts` | 32 | `import { assertSceneAssetSourceUnused } from '../services/SceneAssetUsage';` |
| Project assets/services | `src/editor-package/runtime.ts` | 33 | `import type { AssetTransportPlan } from '../services/AssetManager';` |
| Browser globals | `src/editor-package/runtime.ts` | 67 | `DOCUMENT_EXPORT: 'document.export',` |
| Browser globals | `src/editor-package/runtime.ts` | 68 | `DOCUMENT_COMMIT: 'document.commit',` |
| Babylon runtime | `src/editor-package/runtime.ts` | 69 | `INSPECTOR_FLUSH: 'inspector.flush',` |
| Browser globals | `src/editor-package/runtime.ts` | 81 | `DOCUMENT_EXPORTED: 'document.exported',` |
| Babylon runtime | `src/editor-package/runtime.ts` | 82 | `INSPECTOR_FLUSHED: 'inspector.flushed',` |
| Forge Play bridge globals | `src/editor-package/runtime.ts` | 160 | `const messenger = window.__bridge?.messenger as { event?: (eventName: string, payload: Record<string, any>) => void } | undefined;` |
| Browser globals | `src/editor-package/runtime.ts` | 160 | `const messenger = window.__bridge?.messenger as { event?: (eventName: string, payload: Record<string, any>) => void } | undefined;` |
| Forge Play bridge globals | `src/editor-package/runtime.ts` | 165 | `const messenger = window.__bridge?.messenger as { send?: (type: string, payload: Record<string, any>) => void } | undefined;` |
| Browser globals | `src/editor-package/runtime.ts` | 165 | `const messenger = window.__bridge?.messenger as { send?: (type: string, payload: Record<string, any>) => void } | undefined;` |
| Game runtime globals | `src/editor-package/runtime.ts` | 170 | `const game = (window as any).gameInstance ?? null;` |
| Babylon runtime | `src/editor-package/runtime.ts` | 266 | `const ensureInspectorReady = (window as any).ensureInspectorReady;` |
| Babylon runtime | `src/editor-package/runtime.ts` | 267 | `if (typeof ensureInspectorReady !== 'function') return;` |
| Babylon runtime | `src/editor-package/runtime.ts` | 269 | `.then(() => ensureInspectorReady())` |
| Browser globals | `src/editor-package/runtime.ts` | 291 | `const selected = projectSelection.getSelectedEntity?.() ?? lastKnownSelection;` |
| Forge Play bridge globals | `src/editor-package/runtime.ts` | 317 | `(window as any).__bridgeProjectSelectionController = projectSelection;` |
| Browser globals | `src/editor-package/runtime.ts` | 321 | `getSelectedEntity: () => projectSelection.getSelectedEntity?.() ?? lastKnownSelection,` |
| Browser globals | `src/editor-package/runtime.ts` | 336 | `getSelectedEntity: () => projectSelection.getSelectedEntity?.() ?? lastKnownSelection,` |
| Browser globals | `src/editor-package/runtime.ts` | 341 | `onEnablePicking: () => projectSelection.enablePicking?.(),` |
| Browser globals | `src/editor-package/runtime.ts` | 355 | `getSelectedEntity: () => projectSelection.getSelectedEntity?.() ?? lastKnownSelection,` |
| Browser globals | `src/editor-package/runtime.ts` | 357 | `const selected = projectSelection.getSelectedEntities?.();` |
| Browser globals | `src/editor-package/runtime.ts` | 359 | `const fallback = projectSelection.getSelectedEntity?.() ?? lastKnownSelection;` |
| Browser globals | `src/editor-package/runtime.ts` | 407 | `return projectSelection.getSelectedEntity?.() ?? lastKnownSelection;` |
| Browser globals | `src/editor-package/runtime.ts` | 410 | `projectSelection.selectEntity?.(entity, syncInspector);` |
| Browser globals | `src/editor-package/runtime.ts` | 415 | `const node = projectSelection.getSelectedEntity?.() ?? lastKnownSelection;` |
| Browser globals | `src/editor-package/runtime.ts` | 442 | `projectSelection.selectEntity?.(rootNode, true);` |
| Browser globals | `src/editor-package/runtime.ts` | 469 | `projectMonitor.rebase(projectSelection.getSelectedEntity?.() ?? lastKnownSelection);` |
| Browser globals | `src/editor-package/runtime.ts` | 496 | `projectMonitor.rebase(projectSelection.getSelectedEntity?.() ?? lastKnownSelection);` |
| Browser globals | `src/editor-package/runtime.ts` | 543 | `rememberSelection(projectSelection.getSelectedEntity?.() ?? lastKnownSelection);` |
| Babylon runtime | `src/editor-package/runtime.ts` | 615 | `if (name === COMMAND_NAME.INSPECTOR_FLUSH) {` |
| Babylon runtime | `src/editor-package/runtime.ts` | 621 | `emitBridgeEvent(EVENT_NAME.INSPECTOR_FLUSHED, {});` |
| Browser globals | `src/editor-package/runtime.ts` | 719 | `projectSelection.selectEntity?.(result.rootNode, true);` |
| Project assets/services | `src/editor-package/runtime.ts` | 728 | `if (importedSourceId && !isModelRegistered(importedSourceId)) {` |
| Browser globals | `src/editor-package/runtime.ts` | 808 | `projectSelection.selectEntity?.(created.rootNode, true);` |
| Browser globals | `src/editor-package/runtime.ts` | 842 | `projectSelection.selectEntity?.(patched.rootNode, true);` |
| Project config/schema | `src/editor-package/scene-node-duplicate.ts` | 6 | `} from '../config';` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 53 | `function getSceneBuilder(context?: ProjectEditorPluginContext): any | null {` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 55 | `return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 60 | `const sceneBuilder = getSceneBuilder(context);` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 61 | `const rootNode = sceneBuilder?.getRootNode?.() ?? null;` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 79 | `context?.game && typeof (context.game as any).getSceneNodeRuntime === 'function'` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 80 | `? (context.game as any).getSceneNodeRuntime(entry.sourceBinding.nodeId)` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 90 | `const sceneBuilder = getSceneBuilder(context);` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 91 | `if (!sceneBuilder?.addSceneNodeFromConfig) return null;` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 92 | `return sceneBuilder.addSceneNodeFromConfig(cloneJson(node), parent ?? null);` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 96 | `const sceneBuilder = getSceneBuilder(context);` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 97 | `return sceneBuilder?.removeSceneNode?.(nodeId) ?? false;` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 227 | `context?.game && typeof (context.game as any).getSceneNodeRuntime === 'function'` |
| Game runtime globals | `src/editor-package/scene-node-duplicate.ts` | 228 | `? (context.game as any).getSceneNodeRuntime(entry.sourceBinding.nodeId)` |
| Project config/schema | `src/editor-package/scene-node-field-schema.ts` | 1 | `import type { ColorRGB, Position3D, Scale3D, SceneNodeConfig, TransformConfig } from '../config';` |
| Project config/schema | `src/editor-package/types.ts` | 1 | `import type { ColorRGB, Position3D, Scale3D } from '../config';` |
| Forge Play bridge globals | `src/editor-package/types.ts` | 206 | `__pendingEditorPlugin?: ProjectEditorPlugin;` |
| Forge Play bridge globals | `src/editor-package/types.ts` | 207 | `__pendingEditorRuntime?: ProjectEditorRuntime;` |
| Forge Play bridge globals | `src/editor-package/types.ts` | 208 | `__bridgeLegacyEditorRuntime?: ProjectEditorRuntime;` |
| Forge Play bridge globals | `src/editor-package/types.ts` | 209 | `__bridgeProjectSelectionController?: ProjectSelectionController;` |

## Current lumber_order Verification Commands

These commands are available in `/Users/admin/work/UGIT/lumber_order/package.json` and define the current regression surface for migration reviews.

- `npm run typecheck`
- `npm run sim:platform`
- `npm run test:asset-manager-boundaries`
- `npm run test:asset-registry-unregister`
- `npm run test:debug-panel-boundaries`
- `npm run test:debug-panel-lifecycle`
- `npm run test:debug-panel-persistence`
- `npm run test:debug-panels`
- `npm run test:panel-dsl-loader`

## Round 0 Status

- No `lumber_order` files were moved, deleted, or rewritten.
- No runtime registration path was changed.
- No generic package code was introduced yet.
- This baseline is the comparison source for migration review agents.
