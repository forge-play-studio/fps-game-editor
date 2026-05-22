import { describe, expect, it } from 'vitest';
import {
  toPlacementModeLabel,
  toTransformActionLabel,
  toTransformHandleListLabel,
  toTransformMouseHint,
  toTransformOperationStatusLabel,
  toTransformSnapStatusLabel,
  toTransformToolStatusLabel,
} from '../../packages/editor-browser/src/local-editor-ui-shared';
import { DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS } from '../../packages/editor-core/src/transform-operations';

describe('local editor transform UI descriptors', () => {
  it('derives toolbar status labels from transform tool descriptors', () => {
    expect(toTransformHandleListLabel('move')).toBe('轴向 / 平面 / 自由');
    expect(toTransformHandleListLabel('rotate')).toBe('轴向');
    expect(toTransformHandleListLabel('scale')).toBe('轴向 / 统一');
    expect(toTransformToolStatusLabel('move', 'world')).toBe('移动 · 世界 · 轴向 / 平面 / 自由');
  });

  it('describes simultaneous move handles instead of a view-plane mode toggle', () => {
    expect(toTransformMouseHint('move')).toContain('轴向箭头 / 平面方块 / 中心自由拖拽');
    expect(toTransformMouseHint('move')).not.toContain('视图平面移动');
  });

  it('derives operation toolbar labels from core defaults', () => {
    expect(toTransformSnapStatusLabel(DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS))
      .toBe('吸附关 · 移动 0.5 · 旋转 15° · 缩放 0.1');
    expect(toTransformOperationStatusLabel(DEFAULT_EDITOR_TRANSFORM_OPERATION_SETTINGS))
      .toBe('吸附关 · 移动 0.5 · 旋转 15° · 缩放 0.1 · 放置关');
    expect(toPlacementModeLabel('ground')).toBe('地面');
    expect(toPlacementModeLabel('surface')).toBe('表面');
  });

  it('names align and distribute actions without defining their behavior in the UI', () => {
    expect(toTransformActionLabel('align-x')).toBe('对齐 X');
    expect(toTransformActionLabel('align-all')).toBe('对齐全');
    expect(toTransformActionLabel('distribute-z')).toBe('分布 Z');
  });
});
