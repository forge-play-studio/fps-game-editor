import type {
  EditorSelectionState,
  SelectionCommand,
} from './editor-session';

export type EditorSelectionGesture = 'click' | 'box';
export type EditorSelectionModifier = 'replace' | 'additive' | 'toggle';

export interface ResolveEditorSelectionCommandInput {
  selection: EditorSelectionState;
  targetIds: readonly string[];
  activeId?: string | null;
  gesture: EditorSelectionGesture;
  modifier: EditorSelectionModifier;
}

export function resolveEditorSelectionCommand(
  input: ResolveEditorSelectionCommandInput,
): SelectionCommand | null {
  const targetIds = uniqueSelectionIds(input.targetIds);
  if (targetIds.length === 0) {
    return input.modifier === 'replace'
      ? { type: 'selection.clear', label: 'Clear Selection' }
      : null;
  }

  const activeId = input.activeId ?? targetIds[targetIds.length - 1] ?? null;
  if (input.modifier === 'replace') {
    return {
      type: 'selection.replace',
      selectedIds: targetIds,
      activeId,
      label: input.gesture === 'box' ? 'Box Select' : 'Select Object',
    };
  }

  if (input.modifier === 'toggle') {
    return {
      type: 'selection.toggle',
      selectedIds: targetIds,
      activeId,
      label: input.gesture === 'box' ? 'Box Toggle Selection' : 'Toggle Selection',
    };
  }

  if (
    input.gesture === 'click'
    && targetIds.length === 1
    && input.selection.selectedIds.includes(targetIds[0]!)
  ) {
    return {
      type: 'selection.remove',
      selectedIds: targetIds,
      label: 'Remove Selection',
    };
  }

  return {
    type: 'selection.add',
    selectedIds: targetIds,
    activeId,
    label: input.gesture === 'box' ? 'Box Add Selection' : 'Add Selection',
  };
}

function uniqueSelectionIds(ids: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
