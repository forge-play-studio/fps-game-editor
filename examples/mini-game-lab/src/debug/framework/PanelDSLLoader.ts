import type { PanelDSL, PanelPersistence, ParamType, PanelDSLValidationError } from './types';

export type PanelJSONModule = string | { default?: string };

const ALLOWED_PARAM_TYPES: ParamType[] = ['number', 'boolean', 'color', 'select', 'string', 'curve', 'texture', 'vector3', 'action', 'log'];
const ALLOWED_PERSISTENCE: PanelPersistence[] = ['config', 'runtime', 'none'];

function failPanelValidation(filePath: string, errors: PanelDSLValidationError[]): never {
  const lines = errors.map((error) => `- field: ${error.field}\n  reason: ${error.reason}`).join('\n');
  throw new Error(`[PanelDSL] Invalid panel file: ${filePath}\n${lines}`);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCurvePoint(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1]);
}

function isColorChannel(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function isColorValue(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length >= 3
    && isColorChannel(value[0])
    && isColorChannel(value[1])
    && isColorChannel(value[2]);
}

function readRawPanelJSONModule(entry: PanelJSONModule): string {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry.default === 'string') return entry.default;
  throw new Error('[PanelDSL] JSON module must resolve to a raw string');
}

export function validatePanelDSL(dsl: unknown, filePath = '<inline>'): PanelDSL {
  const errors: PanelDSLValidationError[] = [];

  if (!dsl || typeof dsl !== 'object') {
    failPanelValidation(filePath, [{ field: '<root>', reason: 'must be an object' }]);
  }

  const panel = dsl as Record<string, unknown>;
  const requireString = (field: string) => {
    if (typeof panel[field] !== 'string' || !String(panel[field]).trim()) {
      errors.push({ field, reason: 'must be a non-empty string' });
    }
  };

  requireString('id');
  requireString('title');
  requireString('configFile');
  requireString('category');
  const persistence = typeof panel.persistence === 'string'
    ? panel.persistence as PanelPersistence
    : (panel.configFile === 'runtime' ? 'runtime' : 'config');

  if (panel.persistence != null && (
    typeof panel.persistence !== 'string'
    || !ALLOWED_PERSISTENCE.includes(panel.persistence as PanelPersistence)
  )) {
    errors.push({ field: 'persistence', reason: `must be one of ${ALLOWED_PERSISTENCE.join(', ')}` });
  }

  if (!Array.isArray(panel.params)) {
    errors.push({ field: 'params', reason: 'must be an array' });
  } else {
    panel.params.forEach((param, index) => {
      if (!param || typeof param !== 'object') {
        errors.push({ field: `params[${index}]`, reason: 'must be an object' });
        return;
      }

      const next = param as Record<string, unknown>;
      const prefix = `params[${index}]`;
      if (typeof next.key !== 'string' || !next.key.trim()) {
        errors.push({ field: `${prefix}.key`, reason: 'must be a non-empty string' });
      }
      if (typeof next.label !== 'string' || !next.label.trim()) {
        errors.push({ field: `${prefix}.label`, reason: 'must be a non-empty string' });
      }
      if (typeof next.type !== 'string' || !ALLOWED_PARAM_TYPES.includes(next.type as ParamType)) {
        errors.push({ field: `${prefix}.type`, reason: `must be one of ${ALLOWED_PARAM_TYPES.join(', ')}` });
      }
      if (!Array.isArray(next.configPaths) || next.configPaths.some((path) => typeof path !== 'string')) {
        errors.push({ field: `${prefix}.configPaths`, reason: 'must be an array of strings' });
      }
      if (!Object.prototype.hasOwnProperty.call(next, 'default')) {
        errors.push({ field: `${prefix}.default`, reason: 'is required' });
      }
      if (next.group != null && (typeof next.group !== 'string' || !next.group.trim())) {
        errors.push({ field: `${prefix}.group`, reason: 'must be a non-empty string when provided' });
      }
      if (next.type === 'select' && (!Array.isArray(next.options) || next.options.length === 0)) {
        errors.push({ field: `${prefix}.options`, reason: 'required for param.type="select"' });
      }
      if (next.runtimePath != null && (typeof next.runtimePath !== 'string' || !next.runtimePath.trim())) {
        errors.push({ field: `${prefix}.runtimePath`, reason: 'must be a non-empty string when provided' });
      }
      if (next.type === 'action') {
        if (typeof next.action !== 'string' || !next.action.trim()) {
          errors.push({ field: `${prefix}.action`, reason: 'required for param.type="action"' });
        }
        if (next.actionArgs != null && (typeof next.actionArgs !== 'object' || Array.isArray(next.actionArgs))) {
          errors.push({ field: `${prefix}.actionArgs`, reason: 'must be an object when provided' });
        }
      }
      if (next.type === 'boolean' && typeof next.default !== 'boolean') {
        errors.push({ field: `${prefix}.default`, reason: 'must be a boolean for param.type="boolean"' });
      }
      if ((next.type === 'string' || next.type === 'log') && typeof next.default !== 'string') {
        errors.push({ field: `${prefix}.default`, reason: `must be a string for param.type="${next.type}"` });
      }
      if (next.type === 'color' && !isColorValue(next.default)) {
        errors.push({ field: `${prefix}.default`, reason: 'must be [r, g, b] with 0..1 numbers for param.type="color"' });
      }
      if (next.type === 'number') {
        if (next.range != null) {
          const range = next.range;
          const validRange = Array.isArray(range)
            && range.length === 2
            && isFiniteNumber(range[0])
            && isFiniteNumber(range[1])
            && range[0] <= range[1];
          if (!validRange) {
            errors.push({ field: `${prefix}.range`, reason: 'must be [min, max] with finite numbers and min <= max' });
          }
        }
        if (next.step != null && !isFiniteNumber(next.step)) {
          errors.push({ field: `${prefix}.step`, reason: 'must be a finite number' });
        }
        if (next.default != null && !isFiniteNumber(next.default)) {
          errors.push({ field: `${prefix}.default`, reason: 'must be a finite number for param.type="number"' });
        }
      }
      if (next.type === 'vector3') {
        if (!Array.isArray(next.default) || next.default.length < 3 || next.default.some((item) => !isFiniteNumber(item))) {
          errors.push({ field: `${prefix}.default`, reason: 'must be [x, y, z] with finite numbers for param.type="vector3"' });
        }
        if (persistence === 'config' && (!Array.isArray(next.configPaths) || next.configPaths.length < 3)) {
          errors.push({ field: `${prefix}.configPaths`, reason: 'must include three paths for param.type="vector3"' });
        }
        if (next.range != null) {
          const range = next.range;
          const validRange = Array.isArray(range)
            && range.length === 2
            && isFiniteNumber(range[0])
            && isFiniteNumber(range[1])
            && range[0] <= range[1];
          if (!validRange) {
            errors.push({ field: `${prefix}.range`, reason: 'must be [min, max] with finite numbers and min <= max' });
          }
        }
        if (next.step != null && !isFiniteNumber(next.step)) {
          errors.push({ field: `${prefix}.step`, reason: 'must be a finite number' });
        }
      }
      if (next.type === 'curve') {
        if (!Array.isArray(next.default) || next.default.some((point) => !isCurvePoint(point))) {
          errors.push({ field: `${prefix}.default`, reason: 'must be an array of [x, y] points for param.type="curve"' });
        }
        if (next.curveMaxPoints != null && (!Number.isInteger(next.curveMaxPoints) || Number(next.curveMaxPoints) < 2)) {
          errors.push({ field: `${prefix}.curveMaxPoints`, reason: 'must be an integer >= 2' });
        }
      }
      if (next.type === 'texture') {
        if (typeof next.default !== 'string') {
          errors.push({ field: `${prefix}.default`, reason: 'must be a string for param.type="texture"' });
        }
      }
      if (next.type === 'select') {
        const options = Array.isArray(next.options) ? next.options : [];
        const invalidOptionIndex = options.findIndex((option) => {
          if (!option || typeof option !== 'object') return true;
          const record = option as Record<string, unknown>;
          return typeof record.label !== 'string' || !record.label.trim() || !Object.prototype.hasOwnProperty.call(record, 'value');
        });
        if (invalidOptionIndex >= 0) {
          errors.push({ field: `${prefix}.options[${invalidOptionIndex}]`, reason: 'must be an object with non-empty string label and value' });
        }
        const hasDefaultMatch = options.some((option) => option && typeof option === 'object' && (option as Record<string, unknown>).value === next.default);
        if (options.length > 0 && !hasDefaultMatch) {
          errors.push({ field: `${prefix}.default`, reason: 'must match one of options[*].value for param.type="select"' });
        }
      }
    });
  }

  if (panel.preview != null) {
    errors.push({
      field: 'preview',
      reason: 'is deprecated; use controller + runtimePath for live apply and param.type="action" for explicit runtime actions',
    });
  }

  if (errors.length > 0) {
    failPanelValidation(filePath, errors);
  }

  return panel as unknown as PanelDSL;
}

export function parsePanelDSLJSON(text: string, filePath = '<inline-json>'): PanelDSL {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`[PanelDSL] Failed to parse JSON panel file: ${filePath}\n${String(error)}`);
  }

  return validatePanelDSL(parsed, filePath);
}

export async function loadPanelsFromJSONModules(modules: Record<string, PanelJSONModule>): Promise<PanelDSL[]> {
  const panels: PanelDSL[] = [];
  for (const [filePath, entry] of Object.entries(modules)) {
    panels.push(parsePanelDSLJSON(readRawPanelJSONModule(entry), filePath));
  }
  return panels;
}
