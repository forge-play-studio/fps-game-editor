export type {
  EditorHostBootState,
  EditorHostBootStateProvider,
  EditorHostCapabilities,
  EditorHostServices,
  EditorHostStorageProvider,
} from './host-services';

export type KnownAuthoringSourceType =
  | 'scene'
  | 'effect'
  | 'material'
  | 'code';

export type AuthoringSourceType = KnownAuthoringSourceType | (string & {});

export interface AuthoringSourceRef {
  sourceId: string;
  sourceType: AuthoringSourceType;
  revision?: number;
}

export interface AuthoringSourceCapabilities {
  editable?: boolean;
  compilable?: boolean;
  runtimeApply?: boolean;
  aiWritable?: boolean;
  [key: string]: boolean | undefined;
}

export interface AuthoringSourceDescriptor {
  ref: AuthoringSourceRef;
  filePath?: string;
  schemaVersion?: number | string;
  capabilities?: AuthoringSourceCapabilities;
  metadata?: Record<string, unknown>;
}

export interface CompiledArtifactProvenance {
  sourceId: string;
  sourceType: AuthoringSourceType;
  revision?: number;
  compilerId: string;
  compilerVersion: number | string;
  compiledAt: string;
}

export interface RuntimeSourceBinding {
  sourceId: string;
  sourceType: AuthoringSourceType;
  revision?: number;
  objectId?: string;
  component?: string;
  propertyPath?: string;
}

export interface RuntimePatch {
  runtimeTargetId: string;
  runtimePropertyPath: string;
  before: unknown;
  after: unknown;
  sourceBinding?: RuntimeSourceBinding | null;
  applyable: boolean;
  applyTarget: AuthoringSourceType | 'discard-only';
  label?: string;
  metadata?: Record<string, unknown>;
}

export type AuthoringCommandIntent = 'preview' | 'commit';

export type AuthoringCommandOrigin = 'editor-ui' | 'ai' | 'platform' | 'debug';

export type AuthoringMaybePromise<T> = T | Promise<T>;

export interface AuthoringCommand<TPayload = unknown> {
  id: string;
  kind: string;
  source: AuthoringSourceRef;
  payload: TPayload;
  origin: AuthoringCommandOrigin;
  intent?: AuthoringCommandIntent;
  expectedRevision?: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export type AuthoringDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface AuthoringDiagnostic {
  severity: AuthoringDiagnosticSeverity;
  message: string;
  code?: string;
  path?: string;
  source?: AuthoringSourceRef;
  metadata?: Record<string, unknown>;
}

export interface CompiledArtifact {
  artifactType: string;
  artifactId?: string;
  provenance?: CompiledArtifactProvenance;
  summary?: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuthoringSourceLoadInput {
  ref: AuthoringSourceRef;
  descriptor?: AuthoringSourceDescriptor;
}

export interface AuthoringSourceLoadResult<TDocument = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  diagnostics?: AuthoringDiagnostic[];
  summary?: string;
}

export interface AuthoringSourceReduceInput<TDocument = unknown, TPayload = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  command: AuthoringCommand<TPayload>;
}

export interface AuthoringSourceValidateInput<TDocument = unknown, TPayload = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  command?: AuthoringCommand<TPayload>;
  intent?: AuthoringCommandIntent;
}

export interface AuthoringSourceSaveInput<TDocument = unknown, TPayload = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  command?: AuthoringCommand<TPayload>;
  expectedRevision?: number;
}

export interface AuthoringSourceSaveResult<TDocument = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  summary?: string;
  diagnostics?: AuthoringDiagnostic[];
  artifacts?: CompiledArtifact[];
  runtimePatches?: RuntimePatch[];
  metadata?: Record<string, unknown>;
}

export interface AuthoringSourceCompileInput<TDocument = unknown, TPayload = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  command?: AuthoringCommand<TPayload>;
  intent?: AuthoringCommandIntent;
}

export interface AuthoringSourceRuntimePatchInput<TDocument = unknown, TPayload = unknown> {
  source: AuthoringSourceDescriptor;
  beforeDocument: TDocument;
  afterDocument: TDocument;
  command: AuthoringCommand<TPayload>;
}

export interface AuthoringSourceDriver<TDocument = unknown, TPayload = unknown> {
  sourceType: AuthoringSourceType;
  load(input: AuthoringSourceLoadInput): AuthoringMaybePromise<AuthoringSourceLoadResult<TDocument>>;
  reduce?(
    input: AuthoringSourceReduceInput<TDocument, TPayload>,
  ): AuthoringMaybePromise<TDocument>;
  validate?(
    input: AuthoringSourceValidateInput<TDocument, TPayload>,
  ): AuthoringMaybePromise<AuthoringDiagnostic[]>;
  save(
    input: AuthoringSourceSaveInput<TDocument, TPayload>,
  ): AuthoringMaybePromise<AuthoringSourceSaveResult<TDocument>>;
  compile?(
    input: AuthoringSourceCompileInput<TDocument, TPayload>,
  ): AuthoringMaybePromise<CompiledArtifact[]>;
  compileRuntimePatch?(
    input: AuthoringSourceRuntimePatchInput<TDocument, TPayload>,
  ): AuthoringMaybePromise<RuntimePatch[]>;
}

export interface RuntimeApplyResult {
  patch: RuntimePatch;
  applied: boolean;
  reason?: string;
  diagnostics?: AuthoringDiagnostic[];
}

export interface RuntimeAdapter {
  kind: string;
  apply(patches: RuntimePatch[]): AuthoringMaybePromise<RuntimeApplyResult[]>;
  dispose?(): void;
}

export type AuthoringCommandFailureReason =
  | 'source_not_found'
  | 'source_driver_not_found'
  | 'source_revision_mismatch'
  | 'source_reduce_failed'
  | 'source_validation_failed'
  | 'source_save_failed'
  | 'source_compile_failed'
  | 'runtime_apply_failed'
  | 'unsupported_intent';

export interface AuthoringCommandResult<TDocument = unknown> {
  ok: boolean;
  intent: AuthoringCommandIntent;
  source?: AuthoringSourceDescriptor;
  document?: TDocument;
  saved: boolean;
  runtimeApplied: boolean;
  reason?: AuthoringCommandFailureReason;
  summary?: string;
  diagnostics: AuthoringDiagnostic[];
  artifacts?: CompiledArtifact[];
  runtimePatches?: RuntimePatch[];
  runtimeResults?: RuntimeApplyResult[];
  metadata?: Record<string, unknown>;
}

export interface ProjectAuthoringHostCommitInput<TDocument = unknown> {
  source: AuthoringSourceDescriptor;
  document: TDocument;
  beforeDocument?: TDocument;
  expectedRevision?: number;
  command?: AuthoringCommand;
}

export interface ProjectAuthoringHostOptions {
  sources?: AuthoringSourceDescriptor[];
  drivers?: AuthoringSourceDriver[];
  runtimeAdapter?: RuntimeAdapter | null;
}

export interface ProjectAuthoringHost {
  getSourceRegistry(): AuthoringSourceRegistry;
  registerSource(source: AuthoringSourceDescriptor): void;
  registerSourceDriver(driver: AuthoringSourceDriver): void;
  loadSource<TDocument = unknown>(ref: AuthoringSourceRef): Promise<AuthoringCommandResult<TDocument>>;
  commitSource<TDocument = unknown>(
    input: ProjectAuthoringHostCommitInput<TDocument>,
  ): Promise<AuthoringCommandResult<TDocument>>;
  dispatch<TDocument = unknown, TPayload = unknown>(
    command: AuthoringCommand<TPayload>,
  ): Promise<AuthoringCommandResult<TDocument>>;
  attachRuntimeAdapter(adapter: RuntimeAdapter): void;
  detachRuntimeAdapter(): void;
}

export interface AuthoringApplyCommand<TPatch = unknown> {
  source: AuthoringSourceRef;
  patch: TPatch;
  label?: string;
  runtimePatch?: RuntimePatch;
}

export interface AuthoringApplyResult<TDocument = unknown> {
  source: AuthoringSourceRef;
  document?: TDocument;
  applied: boolean;
  reason?: string;
}

export class AuthoringSourceRegistry {
  private readonly sources = new Map<string, AuthoringSourceDescriptor>();

  constructor(sources: AuthoringSourceDescriptor[] = []) {
    for (const source of sources) this.register(source);
  }

  register(source: AuthoringSourceDescriptor): void {
    this.sources.set(toAuthoringSourceKey(source.ref), cloneAuthoringSourceDescriptor(source));
  }

  get(ref: Pick<AuthoringSourceRef, 'sourceId' | 'sourceType'>): AuthoringSourceDescriptor | null {
    const source = this.sources.get(toAuthoringSourceKey(ref));
    return source ? cloneAuthoringSourceDescriptor(source) : null;
  }

  list(): AuthoringSourceDescriptor[] {
    return [...this.sources.values()].map(cloneAuthoringSourceDescriptor);
  }

  has(ref: Pick<AuthoringSourceRef, 'sourceId' | 'sourceType'>): boolean {
    return this.sources.has(toAuthoringSourceKey(ref));
  }

  unregister(ref: Pick<AuthoringSourceRef, 'sourceId' | 'sourceType'>): boolean {
    return this.sources.delete(toAuthoringSourceKey(ref));
  }
}

export function toAuthoringSourceKey(ref: Pick<AuthoringSourceRef, 'sourceId' | 'sourceType'>): string {
  return `${ref.sourceType}:${ref.sourceId}`;
}

export function cloneAuthoringSourceDescriptor(source: AuthoringSourceDescriptor): AuthoringSourceDescriptor {
  return {
    ...source,
    ref: { ...source.ref },
    capabilities: source.capabilities ? { ...source.capabilities } : undefined,
    metadata: source.metadata ? { ...source.metadata } : undefined,
  };
}

export function createProjectAuthoringHost(
  options: ProjectAuthoringHostOptions = {},
): ProjectAuthoringHost {
  return new DefaultProjectAuthoringHost(options);
}

class DefaultProjectAuthoringHost implements ProjectAuthoringHost {
  private readonly registry: AuthoringSourceRegistry;
  private readonly drivers = new Map<AuthoringSourceType, AuthoringSourceDriver>();
  private runtimeAdapter: RuntimeAdapter | null;

  constructor(options: ProjectAuthoringHostOptions) {
    this.registry = new AuthoringSourceRegistry(options.sources ?? []);
    this.runtimeAdapter = options.runtimeAdapter ?? null;
    for (const driver of options.drivers ?? []) this.registerSourceDriver(driver);
  }

  getSourceRegistry(): AuthoringSourceRegistry {
    return this.registry;
  }

  registerSource(source: AuthoringSourceDescriptor): void {
    this.registry.register(source);
  }

  registerSourceDriver(driver: AuthoringSourceDriver): void {
    this.drivers.set(driver.sourceType, driver);
  }

  async loadSource<TDocument = unknown>(
    ref: AuthoringSourceRef,
  ): Promise<AuthoringCommandResult<TDocument>> {
    const driver = this.getDriver(ref);
    if (!driver) {
      return failedAuthoringResult({
        intent: 'commit',
        reason: 'source_driver_not_found',
        diagnostics: [createDiagnostic('error', `No source driver registered for "${ref.sourceType}".`, ref)],
      });
    }

    try {
      const descriptor = this.registry.get(ref) ?? createSourceDescriptorFromRef(ref);
      const loaded = await driver.load({ ref: cloneAuthoringSourceRef(ref), descriptor });
      this.registry.register(loaded.source);
      return {
        ok: true,
        intent: 'commit',
        source: cloneAuthoringSourceDescriptor(loaded.source),
        document: loaded.document as TDocument,
        saved: false,
        runtimeApplied: false,
        summary: loaded.summary,
        diagnostics: cloneDiagnostics(loaded.diagnostics),
      };
    } catch (error) {
      return failedAuthoringResult({
        intent: 'commit',
        reason: 'source_not_found',
        diagnostics: [diagnosticFromError('source_not_found', error, ref)],
      });
    }
  }

  async commitSource<TDocument = unknown>(
    input: ProjectAuthoringHostCommitInput<TDocument>,
  ): Promise<AuthoringCommandResult<TDocument>> {
    const requestedSource = cloneAuthoringSourceDescriptor(input.source);
    const source = this.registry.get(requestedSource.ref) ?? requestedSource;
    const intent: AuthoringCommandIntent = 'commit';
    const driver = this.getDriver(source.ref);
    if (!driver) {
      return failedAuthoringResult({
        intent,
        source,
        document: input.document,
        reason: 'source_driver_not_found',
        diagnostics: [createDiagnostic('error', `No source driver registered for "${source.ref.sourceType}".`, source.ref)],
      });
    }

    if (input.expectedRevision !== undefined && source.ref.revision !== input.expectedRevision) {
      return failedAuthoringResult({
        intent,
        source,
        document: input.document,
        reason: 'source_revision_mismatch',
        diagnostics: [
          createDiagnostic(
            'error',
            `Source revision mismatch: expected ${input.expectedRevision}, current ${String(source.ref.revision)}.`,
            source.ref,
            'source_revision_mismatch',
          ),
        ],
      });
    }

    let diagnostics: AuthoringDiagnostic[];
    try {
      diagnostics = await validateWithDriver(driver, {
        source,
        document: input.document,
        command: input.command,
        intent,
      });
    } catch (error) {
      return failedAuthoringResult({
        intent,
        source,
        document: input.document,
        reason: 'source_validation_failed',
        diagnostics: [diagnosticFromError('source_validation_failed', error, source.ref)],
      });
    }
    if (hasErrorDiagnostic(diagnostics)) {
      return failedAuthoringResult({
        intent,
        source,
        document: input.document,
        reason: 'source_validation_failed',
        diagnostics,
      });
    }

    let saveResult: AuthoringSourceSaveResult<TDocument>;
    try {
      saveResult = await driver.save({
        source,
        document: input.document,
        command: input.command,
        expectedRevision: input.expectedRevision,
      }) as AuthoringSourceSaveResult<TDocument>;
    } catch (error) {
      return failedAuthoringResult({
        intent,
        source,
        document: input.document,
        reason: 'source_save_failed',
        diagnostics: [
          ...diagnostics,
          diagnosticFromError('source_save_failed', error, source.ref),
        ],
      });
    }

    const savedSource = cloneAuthoringSourceDescriptor(saveResult.source);
    this.registry.register(savedSource);
    diagnostics = [...diagnostics, ...cloneDiagnostics(saveResult.diagnostics)];
    const artifacts = [...(saveResult.artifacts ?? [])];

    try {
      if (driver.compile) {
        artifacts.push(...await driver.compile({
          source: savedSource,
          document: saveResult.document,
          command: input.command,
          intent,
        }));
      }
    } catch (error) {
      return {
        ok: false,
        intent,
        source: savedSource,
        document: saveResult.document,
        saved: true,
        runtimeApplied: false,
        reason: 'source_compile_failed',
        summary: saveResult.summary,
        diagnostics: [
          ...diagnostics,
          diagnosticFromError('source_compile_failed', error, savedSource.ref),
        ],
        artifacts,
        runtimePatches: saveResult.runtimePatches,
        metadata: saveResult.metadata,
      };
    }

    let runtimePatches = [...(saveResult.runtimePatches ?? [])];
    try {
      if (driver.compileRuntimePatch && input.beforeDocument && input.command) {
        runtimePatches = [
          ...runtimePatches,
          ...await driver.compileRuntimePatch({
            source: savedSource,
            beforeDocument: input.beforeDocument,
            afterDocument: saveResult.document,
            command: input.command,
          }),
        ];
      }
    } catch (error) {
      return {
        ok: false,
        intent,
        source: savedSource,
        document: saveResult.document,
        saved: true,
        runtimeApplied: false,
        reason: 'source_compile_failed',
        summary: saveResult.summary,
        diagnostics: [
          ...diagnostics,
          diagnosticFromError('source_compile_failed', error, savedSource.ref),
        ],
        artifacts,
        runtimePatches,
        metadata: saveResult.metadata,
      };
    }

    const runtimeResult = await this.applyRuntimePatches({
      patches: runtimePatches,
      source: savedSource.ref,
      intent,
      saved: true,
    });
    if (!runtimeResult.ok) {
      return {
        ok: false,
        intent,
        source: savedSource,
        document: saveResult.document,
        saved: true,
        runtimeApplied: false,
        reason: runtimeResult.reason,
        summary: saveResult.summary,
        diagnostics: [...diagnostics, ...runtimeResult.diagnostics],
        artifacts,
        runtimePatches,
        runtimeResults: runtimeResult.runtimeResults,
        metadata: saveResult.metadata,
      };
    }

    return {
      ok: true,
      intent,
      source: savedSource,
      document: saveResult.document,
      saved: true,
      runtimeApplied: runtimeResult.runtimeApplied,
      summary: saveResult.summary,
      diagnostics,
      artifacts,
      runtimePatches,
      runtimeResults: runtimeResult.runtimeResults,
      metadata: saveResult.metadata,
    };
  }

  async dispatch<TDocument = unknown, TPayload = unknown>(
    command: AuthoringCommand<TPayload>,
  ): Promise<AuthoringCommandResult<TDocument>> {
    const intent = command.intent ?? 'commit';
    if (intent !== 'preview' && intent !== 'commit') {
      return failedAuthoringResult({
        intent: 'commit',
        reason: 'unsupported_intent',
        diagnostics: [createDiagnostic('error', `Unsupported authoring intent "${String(command.intent)}".`, command.source)],
      });
    }

    const driver = this.getDriver(command.source);
    if (!driver) {
      return failedAuthoringResult({
        intent,
        reason: 'source_driver_not_found',
        diagnostics: [createDiagnostic('error', `No source driver registered for "${command.source.sourceType}".`, command.source)],
      });
    }

    let loaded: AuthoringSourceLoadResult<TDocument>;
    try {
      loaded = await driver.load({
        ref: cloneAuthoringSourceRef(command.source),
        descriptor: this.registry.get(command.source) ?? createSourceDescriptorFromRef(command.source),
      }) as AuthoringSourceLoadResult<TDocument>;
      this.registry.register(loaded.source);
    } catch (error) {
      return failedAuthoringResult({
        intent,
        reason: 'source_not_found',
        diagnostics: [diagnosticFromError('source_not_found', error, command.source)],
      });
    }

    const beforeDocument = loaded.document;
    if (intent === 'commit') {
      let afterDocument = beforeDocument;
      try {
        if (driver.reduce) {
          afterDocument = await driver.reduce({
            source: loaded.source,
            document: beforeDocument,
            command,
          }) as TDocument;
        }
      } catch (error) {
        return failedAuthoringResult({
          intent,
          source: loaded.source,
          document: beforeDocument,
          reason: 'source_reduce_failed',
          diagnostics: [
            ...cloneDiagnostics(loaded.diagnostics),
            diagnosticFromError('source_reduce_failed', error, loaded.source.ref),
          ],
        });
      }
      return this.commitSource({
        source: loaded.source,
        document: afterDocument,
        beforeDocument,
        expectedRevision: command.expectedRevision,
        command,
      });
    }

    let diagnostics: AuthoringDiagnostic[];
    try {
      diagnostics = await validateWithDriver(driver, {
        source: loaded.source,
        document: beforeDocument,
        command,
        intent,
      });
    } catch (error) {
      return failedAuthoringResult({
        intent,
        source: loaded.source,
        document: beforeDocument,
        reason: 'source_validation_failed',
        diagnostics: [diagnosticFromError('source_validation_failed', error, loaded.source.ref)],
      });
    }
    diagnostics = [...cloneDiagnostics(loaded.diagnostics), ...diagnostics];
    if (hasErrorDiagnostic(diagnostics)) {
      return failedAuthoringResult({
        intent,
        source: loaded.source,
        document: beforeDocument,
        reason: 'source_validation_failed',
        diagnostics,
      });
    }

    let runtimePatches: RuntimePatch[] = [];
    try {
      runtimePatches = driver.compileRuntimePatch
        ? await driver.compileRuntimePatch({
          source: loaded.source,
          beforeDocument,
          afterDocument: beforeDocument,
          command,
        })
        : [];
    } catch (error) {
      return failedAuthoringResult({
        intent,
        source: loaded.source,
        document: beforeDocument,
        reason: 'source_compile_failed',
        diagnostics: [
          ...diagnostics,
          diagnosticFromError('source_compile_failed', error, loaded.source.ref),
        ],
      });
    }

    const runtimeResult = await this.applyRuntimePatches({
      patches: runtimePatches,
      source: loaded.source.ref,
      intent,
      saved: false,
    });
    if (!runtimeResult.ok) {
      return {
        ok: false,
        intent,
        source: cloneAuthoringSourceDescriptor(loaded.source),
        document: beforeDocument,
        saved: false,
        runtimeApplied: false,
        reason: runtimeResult.reason,
        diagnostics: [...diagnostics, ...runtimeResult.diagnostics],
        runtimePatches,
        runtimeResults: runtimeResult.runtimeResults,
      };
    }

    return {
      ok: true,
      intent,
      source: cloneAuthoringSourceDescriptor(loaded.source),
      document: beforeDocument,
      saved: false,
      runtimeApplied: runtimeResult.runtimeApplied,
      diagnostics,
      runtimePatches,
      runtimeResults: runtimeResult.runtimeResults,
    };
  }

  attachRuntimeAdapter(adapter: RuntimeAdapter): void {
    if (this.runtimeAdapter && this.runtimeAdapter !== adapter) this.runtimeAdapter.dispose?.();
    this.runtimeAdapter = adapter;
  }

  detachRuntimeAdapter(): void {
    this.runtimeAdapter?.dispose?.();
    this.runtimeAdapter = null;
  }

  private getDriver(ref: Pick<AuthoringSourceRef, 'sourceType'>): AuthoringSourceDriver | null {
    return this.drivers.get(ref.sourceType) ?? null;
  }

  private async applyRuntimePatches(input: {
    patches: RuntimePatch[];
    source: AuthoringSourceRef;
    intent: AuthoringCommandIntent;
    saved: boolean;
  }): Promise<{
    ok: boolean;
    runtimeApplied: boolean;
    reason?: AuthoringCommandFailureReason;
    diagnostics: AuthoringDiagnostic[];
    runtimeResults?: RuntimeApplyResult[];
  }> {
    if (input.patches.length === 0) {
      return { ok: true, runtimeApplied: false, diagnostics: [] };
    }
    if (!this.runtimeAdapter) {
      return {
        ok: true,
        runtimeApplied: false,
        diagnostics: [
          createDiagnostic('warning', 'Runtime patches were produced but no runtime adapter is attached.', input.source),
        ],
      };
    }

    try {
      const runtimeResults = await this.runtimeAdapter.apply(input.patches);
      const failed = runtimeResults.filter(result => !result.applied);
      if (failed.length > 0) {
        return {
          ok: false,
          runtimeApplied: false,
          reason: 'runtime_apply_failed',
          diagnostics: failed.flatMap(result => result.diagnostics?.length
            ? cloneDiagnostics(result.diagnostics)
            : [createDiagnostic('error', result.reason ?? 'Runtime apply failed.', input.source, 'runtime_apply_failed')]),
          runtimeResults,
        };
      }
      return {
        ok: true,
        runtimeApplied: true,
        diagnostics: [],
        runtimeResults,
      };
    } catch (error) {
      return {
        ok: false,
        runtimeApplied: false,
        reason: 'runtime_apply_failed',
        diagnostics: [diagnosticFromError('runtime_apply_failed', error, input.source)],
      };
    }
  }
}

async function validateWithDriver<TDocument, TPayload>(
  driver: AuthoringSourceDriver<TDocument, TPayload>,
  input: AuthoringSourceValidateInput<TDocument, TPayload>,
): Promise<AuthoringDiagnostic[]> {
  if (!driver.validate) return [];
  return cloneDiagnostics(await driver.validate(input));
}

function hasErrorDiagnostic(diagnostics: readonly AuthoringDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error');
}

function failedAuthoringResult<TDocument>(input: {
  intent: AuthoringCommandIntent;
  source?: AuthoringSourceDescriptor;
  document?: TDocument;
  reason: AuthoringCommandFailureReason;
  diagnostics?: AuthoringDiagnostic[];
}): AuthoringCommandResult<TDocument> {
  return {
    ok: false,
    intent: input.intent,
    source: input.source ? cloneAuthoringSourceDescriptor(input.source) : undefined,
    document: input.document,
    saved: false,
    runtimeApplied: false,
    reason: input.reason,
    diagnostics: cloneDiagnostics(input.diagnostics),
  };
}

function createSourceDescriptorFromRef(ref: AuthoringSourceRef): AuthoringSourceDescriptor {
  return { ref: cloneAuthoringSourceRef(ref) };
}

function cloneAuthoringSourceRef(ref: AuthoringSourceRef): AuthoringSourceRef {
  return { ...ref };
}

function cloneDiagnostics(diagnostics: readonly AuthoringDiagnostic[] | undefined): AuthoringDiagnostic[] {
  return (diagnostics ?? []).map(diagnostic => ({
    ...diagnostic,
    source: diagnostic.source ? cloneAuthoringSourceRef(diagnostic.source) : undefined,
    metadata: diagnostic.metadata ? { ...diagnostic.metadata } : undefined,
  }));
}

function createDiagnostic(
  severity: AuthoringDiagnosticSeverity,
  message: string,
  source?: AuthoringSourceRef,
  code?: string,
): AuthoringDiagnostic {
  return {
    severity,
    message,
    code,
    source: source ? cloneAuthoringSourceRef(source) : undefined,
  };
}

function diagnosticFromError(
  code: AuthoringCommandFailureReason,
  error: unknown,
  source?: AuthoringSourceRef,
): AuthoringDiagnostic {
  return createDiagnostic('error', error instanceof Error ? error.message : String(error), source, code);
}
