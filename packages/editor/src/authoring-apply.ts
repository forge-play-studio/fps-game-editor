import type {
  AuthoringApplyCommand,
  AuthoringApplyResult,
  AuthoringSourceRef,
  DocumentCommand,
  RuntimePatch,
} from '@fps-games/editor-core';

export interface AuthoringRuntimePatchApplyAdapter<TDocument, TPatch = unknown> {
  createPatchFromRuntimePatch(input: {
    source: AuthoringSourceRef;
    document: TDocument;
    runtimePatch: RuntimePatch;
  }): { patch: TPatch; label?: string } | null;
}

export interface CreateAuthoringApplyCommandOptions<TDocument, TPatch = unknown> {
  source: AuthoringSourceRef;
  document: TDocument;
  runtimePatch: RuntimePatch;
  adapter: AuthoringRuntimePatchApplyAdapter<TDocument, TPatch>;
}

export function createAuthoringApplyCommand<TDocument, TPatch = unknown>(
  options: CreateAuthoringApplyCommandOptions<TDocument, TPatch>,
): AuthoringApplyCommand<TPatch> | null {
  const { source, document, runtimePatch, adapter } = options;
  const binding = runtimePatch.sourceBinding;
  if (!runtimePatch.applyable || !binding) return null;
  if (runtimePatch.applyTarget !== source.sourceType) return null;
  if (binding.sourceId !== source.sourceId || binding.sourceType !== source.sourceType) return null;

  const result = adapter.createPatchFromRuntimePatch({
    source,
    document,
    runtimePatch,
  });
  if (!result) return null;

  return {
    source: { ...source },
    patch: result.patch,
    label: result.label ?? runtimePatch.label ?? `Apply ${runtimePatch.runtimePropertyPath}`,
    runtimePatch: cloneRuntimePatch(runtimePatch),
  };
}

export function createDocumentCommandFromAuthoringApply<TDocument, TPatch = unknown>(
  command: AuthoringApplyCommand<TPatch>,
): DocumentCommand<TDocument, TPatch> {
  return {
    type: 'document.patch',
    patch: command.patch,
    label: command.label,
  };
}

export function createAuthoringApplyResult<TDocument>(
  source: AuthoringSourceRef,
  document: TDocument,
): AuthoringApplyResult<TDocument> {
  return {
    source: { ...source },
    document,
    applied: true,
  };
}

function cloneRuntimePatch(patch: RuntimePatch): RuntimePatch {
  return {
    ...patch,
    sourceBinding: patch.sourceBinding ? { ...patch.sourceBinding } : patch.sourceBinding,
    metadata: patch.metadata ? { ...patch.metadata } : undefined,
  };
}
