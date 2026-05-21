import type { DebugPanelInstanceState, IDebugPanel, PanelDSL } from './types';

type CurvePoint = [number, number];

function normalizeColor(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length >= 3) {
    const [r, g, b] = value.map((v) => Math.max(0, Math.min(255, Math.round(Number(v) <= 1 ? Number(v) * 255 : Number(v)))));
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#ffffff';
}

function colorToArray(value: string): [number, number, number] {
  const hex = value.replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function normalizeVector3(value: unknown): [number, number, number] {
  if (!Array.isArray(value)) return [0, 0, 0];
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

function normalizeCurve(value: unknown): CurvePoint[] {
  if (!Array.isArray(value)) {
    return [[0, 0], [1, 1]];
  }

  const points = value
    .map((point) => Array.isArray(point) && point.length >= 2
      ? [Number(point[0]), Number(point[1])] as CurvePoint
      : null)
    .filter((point): point is CurvePoint => !!point && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map(([x, y]) => [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))] as CurvePoint)
    .sort((a, b) => a[0] - b[0]);

  if (points.length === 0) return [[0, 0], [1, 1]];
  if (points[0]![0] !== 0) points.unshift([0, points[0]![1]]);
  if (points[points.length - 1]![0] !== 1) points.push([1, points[points.length - 1]![1]]);

  return points;
}

function cloneCurve(points: CurvePoint[]): CurvePoint[] {
  return points.map(([x, y]) => [x, y]);
}

function drawCurve(canvas: HTMLCanvasElement, points: CurvePoint[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const x = (width / 4) * i;
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const px = x * width;
    const py = (1 - y) * height;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.fillStyle = '#81d4fa';
  points.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x * width, (1 - y) * height, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function updateTexturePreview(img: HTMLImageElement, value: unknown): void {
  const src = typeof value === 'string' ? value.trim() : '';
  img.src = src || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
}

export function generatePanel(
  dsl: PanelDSL,
  onParamChanged?: (key: string, value: unknown) => void,
  onLayoutChanged?: () => void,
): IDebugPanel {
  const _container: { current: HTMLElement | null } = { current: null };
  const controlMap = new Map<string, HTMLElement>();
  const curveStateMap = new Map<string, { setValue: (value: unknown) => void }>();
  const resetButtonMap = new Map<string, HTMLButtonElement>();
  const valueMap = new Map<string, unknown>();
  const baselineValueMap = new Map<string, unknown>();
  /**
   * Generated panel lifecycle state.
   *
   * Keep this local to the generated instance so PanelRegistry and
   * DebugPanelFramework can reason about collapsed/expanded/disposed panels
   * without knowing the DOM details of every generated control.
   */
  let _instanceState: DebugPanelInstanceState = 'registered';

  const countUsedParams = (): number => dsl.params.length;

  // 初始化 valueMap
  for (const p of dsl.params) {
    valueMap.set(p.key, p.default);
    baselineValueMap.set(p.key, p.default);
  }

  const cloneValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(item => cloneValue(item));
    if (value && typeof value === 'object') return { ...(value as Record<string, unknown>) };
    return value;
  };

  const valuesEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

  const getParamValue = (key: string): unknown => valueMap.get(key);

  const syncResetButton = (key: string): void => {
    const btn = resetButtonMap.get(key);
    if (!btn) return;
    const changed = !valuesEqual(getParamValue(key), baselineValueMap.get(key));
    btn.disabled = !changed;
    btn.style.opacity = changed ? '1' : '0.35';
    btn.style.cursor = changed ? 'pointer' : 'default';
  };

  const syncResetButtons = (): void => {
    for (const param of dsl.params) syncResetButton(param.key);
  };

  const setParamValue = (key: string, value: unknown, liveApply = true): void => {
    valueMap.set(key, value);
    syncResetButton(key);
    // onParamChanged is the only bridge from generated controls back to the
    // framework. It may trigger live binding and dirty tracking, so callers can
    // suppress it while hydrating saved config.
    if (liveApply) onParamChanged?.(key, value);
  };

  const handleExternalParamValue = (event: Event): void => {
    const detail = (event as CustomEvent).detail as {
      panelId?: string;
      key?: string;
      value?: unknown;
      scrollToEnd?: boolean;
    } | undefined;
    if (!detail || detail.panelId !== dsl.id || typeof detail.key !== 'string') return;
    applyParamValue(detail.key, detail.value, false);
    if (detail.scrollToEnd) {
      const ctrl = controlMap.get(detail.key);
      if (ctrl instanceof HTMLTextAreaElement) {
        ctrl.scrollTop = ctrl.scrollHeight;
      }
    }
  };
  window.addEventListener('debug-panel:set-param', handleExternalParamValue);

  // ── L1: 折叠标题行 ──
  const renderHeader = (container: HTMLElement): void => {
    container.innerHTML = '';
    container.style.cssText = 'padding:5px 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;background:#1e1e2e;border-radius:4px;font-size:11px;color:#ccc;transition:background .15s';
    container.onmouseenter = () => { container.style.background = '#2a2a3e'; };
    container.onmouseleave = () => { container.style.background = '#1e1e2e'; };

    const left = document.createElement('span');
    left.style.cssText = 'display:flex;align-items:center;gap:6px';

    const arrow = document.createElement('span');
    arrow.textContent = '▶';
    arrow.style.cssText = 'font-size:9px;color:#8e97b3';
    left.appendChild(arrow);

    const title = document.createElement('span');
    title.textContent = dsl.title;
    title.style.cssText = 'font-weight:500';
    left.appendChild(title);

    const badge = document.createElement('span');
    badge.textContent = `(${countUsedParams()})`;
    badge.style.cssText = 'font-size:10px;color:#8e97b3;background:rgba(255,255,255,0.05);padding:1px 5px;border-radius:8px';
    left.appendChild(badge);

    container.appendChild(left);
  };

  const renderCollapsedState = (container: HTMLElement): void => {
    if (_instanceState !== 'disposed') {
      // collapsed still has a container and click handler, but no heavy control
      // DOM. This is the cheap state used for non-active panels.
      _instanceState = 'collapsed';
    }
    renderHeader(container);
    container.onclick = () => {
      if (_instanceState === 'collapsed' && _container.current) {
        renderFull(_container.current);
        onLayoutChanged?.();
      }
    };
  };

  // ── L2: 完整控件渲染 ──
  const renderFull = (container: HTMLElement): void => {
    // Re-rendering a full panel intentionally rebuilds control DOM from
    // valueMap. The maps below are DOM lookup caches, not the source of truth.
    controlMap.clear();
    curveStateMap.clear();
    resetButtonMap.clear();
    container.onclick = null;
    container.onmouseenter = null;
    container.onmouseleave = null;
    container.innerHTML = '';
    container.style.cssText = '';

    const inner = document.createElement('div');
    inner.style.cssText = 'border:1px solid #3b445d;border-radius:0 0 6px 6px;overflow:hidden';

    const header = document.createElement('div');
    header.style.cssText = 'padding:5px 10px;background:#2a2a3e;color:#ddd;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:space-between';

    const left = document.createElement('span');
    left.textContent = dsl.title;

    const collapseBtn = document.createElement('button');
    collapseBtn.textContent = '▲';
    collapseBtn.title = '折叠';
    collapseBtn.style.cssText = 'background:none;border:none;color:#8e97b3;cursor:pointer;font-size:10px;padding:0 4px;line-height:1';
    collapseBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (_container.current) {
        renderCollapsedState(_container.current);
        onLayoutChanged?.();
      }
    });

    header.appendChild(left);
    header.appendChild(collapseBtn);
    inner.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 10px 8px;background:#1a1a2e';

    const hasParamGroups = dsl.params.some(param => !!param.group);
    let currentGroup = '';
    let currentParamContainer: HTMLElement = body;
    let groupIndex = 0;

    for (const param of dsl.params) {
      if (hasParamGroups) {
        const groupName = param.group || currentGroup || '基础';
        if (groupName !== currentGroup) {
          currentGroup = groupName;
          const section = document.createElement('details');
          section.open = groupIndex < 2;
          section.style.cssText = 'margin-bottom:7px;border:1px solid #2f3850;border-radius:5px;background:rgba(255,255,255,0.025);overflow:hidden';
          section.addEventListener('toggle', () => onLayoutChanged?.());

          const summary = document.createElement('summary');
          summary.textContent = groupName;
          summary.style.cssText = 'cursor:pointer;color:#cfd6ef;font-size:11px;font-weight:700;padding:5px 7px;background:#202638;list-style:none';
          section.appendChild(summary);

          currentParamContainer = document.createElement('div');
          currentParamContainer.style.cssText = 'padding:7px 7px 2px';
          section.appendChild(currentParamContainer);
          body.appendChild(section);
          groupIndex += 1;
        }
      }

      const paramBlock = document.createElement('div');
      paramBlock.style.cssText = 'margin-bottom:7px';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px';

      const label = document.createElement('label');
      label.style.cssText = 'color:#aaa;font-size:11px;min-width:54px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      label.textContent = param.label;
      if (param.description) {
        label.title = param.description;
      }
      row.appendChild(label);

      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'R';
      resetBtn.title = '恢复到当前配置值';
      resetBtn.style.cssText = 'width:20px;height:20px;flex:0 0 20px;background:#24293a;color:#8e97b3;border:1px solid #3b445d;border-radius:3px;font-size:10px;line-height:18px;padding:0';
      resetBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const baseline = cloneValue(baselineValueMap.get(param.key));
        applyParamValue(param.key, baseline, true);
      });
      resetButtonMap.set(param.key, resetBtn);

      if (param.type === 'number') {
        const range = param.range ?? [0, 100];
        const step = param.step ?? (range[1] - range[0]) / 100;
        const val = valueMap.get(param.key) ?? param.default;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(range[0]);
        slider.max = String(range[1]);
        slider.step = String(step);
        slider.value = String(val);
        slider.style.cssText = 'flex:1;accent-color:#4fc3f7;min-width:0';

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.min = String(range[0]);
        numInput.max = String(range[1]);
        numInput.step = String(step);
        numInput.value = String(val);
        numInput.style.cssText = 'width:48px;background:#333;color:#eee;border:1px solid #555;border-radius:2px;font-size:10px;text-align:center;padding:2px';

        const unit = param.unit ? document.createElement('span') : null;
        if (unit) {
          unit.style.cssText = 'color:#888;font-size:10px;min-width:18px';
          unit.textContent = param.unit!;
        }

        slider.addEventListener('input', () => {
          const v = parseFloat(slider.value);
          setParamValue(param.key, v, false);
          numInput.value = slider.value;
          onParamChanged?.(param.key, v);
        });
        numInput.addEventListener('change', () => {
          const v = parseFloat(numInput.value);
          if (!isNaN(v)) {
            setParamValue(param.key, v, false);
            slider.value = String(v);
            onParamChanged?.(param.key, v);
          }
        });

        controlMap.set(param.key, slider);
        row.appendChild(slider);
        row.appendChild(numInput);
        if (unit) row.appendChild(unit);
      }

      if (param.type === 'vector3') {
        const range = param.range ?? [-10, 10];
        const step = param.step ?? 0.01;
        const values = normalizeVector3(valueMap.get(param.key) ?? param.default);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:4px;min-width:0;flex:1';
        const inputs: HTMLInputElement[] = [];

        const commitVector = () => {
          const next = inputs.map(input => parseFloat(input.value)).map(value => Number.isFinite(value) ? value : 0) as [number, number, number];
          setParamValue(param.key, next);
        };

        (['X', 'Y', 'Z'] as const).forEach((axis, index) => {
          const axisWrap = document.createElement('label');
          axisWrap.style.cssText = 'display:flex;align-items:center;gap:2px;color:#8e97b3;font-size:9px;min-width:0';
          const axisLabel = document.createElement('span');
          axisLabel.textContent = axis;
          const input = document.createElement('input');
          input.type = 'number';
          input.min = String(range[0]);
          input.max = String(range[1]);
          input.step = String(step);
          input.value = String(values[index]);
          input.style.cssText = 'width:48px;background:#333;color:#eee;border:1px solid #555;border-radius:2px;font-size:10px;text-align:center;padding:2px';
          input.addEventListener('change', commitVector);
          input.addEventListener('input', commitVector);
          inputs.push(input);
          axisWrap.appendChild(axisLabel);
          axisWrap.appendChild(input);
          wrap.appendChild(axisWrap);
        });

        controlMap.set(param.key, wrap);
        row.appendChild(wrap);
      }

      if (param.type === 'boolean') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(valueMap.get(param.key));
        checkbox.style.cssText = 'margin-left:auto;accent-color:#4fc3f7';
        checkbox.addEventListener('change', () => {
          setParamValue(param.key, checkbox.checked);
        });
        controlMap.set(param.key, checkbox);
        row.appendChild(checkbox);
      }

      if (param.type === 'color') {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = normalizeColor(valueMap.get(param.key) ?? param.default);
        colorInput.style.cssText = 'margin-left:auto;width:38px;height:24px;background:transparent;border:1px solid #555;border-radius:4px;padding:2px';
        colorInput.addEventListener('input', () => {
          const next = colorToArray(colorInput.value);
          setParamValue(param.key, next);
        });
        controlMap.set(param.key, colorInput);
        row.appendChild(colorInput);
      }

      if (param.type === 'select') {
        const select = document.createElement('select');
        select.style.cssText = 'margin-left:auto;min-width:100px;background:#333;color:#eee;border:1px solid #555;border-radius:4px;font-size:10px;padding:3px 4px';
        for (const option of param.options ?? []) {
          const optionEl = document.createElement('option');
          optionEl.value = String(option.value);
          optionEl.textContent = option.label;
          select.appendChild(optionEl);
        }
        select.value = String(valueMap.get(param.key) ?? param.default);
        select.addEventListener('change', () => {
          const matched = (param.options ?? []).find((option) => String(option.value) === select.value);
          const next = matched ? matched.value : select.value;
          setParamValue(param.key, next);
        });
        controlMap.set(param.key, select);
        row.appendChild(select);
      }

      if (param.type === 'string') {
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = String(valueMap.get(param.key) ?? param.default ?? '');
        textInput.style.cssText = 'margin-left:auto;min-width:100px;background:#333;color:#eee;border:1px solid #555;border-radius:4px;font-size:10px;padding:3px 6px';
        textInput.addEventListener('input', () => {
          setParamValue(param.key, textInput.value);
        });
        controlMap.set(param.key, textInput);
        row.appendChild(textInput);
      }

      if (param.type === 'log') {
        row.style.alignItems = 'flex-start';
        const textArea = document.createElement('textarea');
        textArea.readOnly = true;
        textArea.value = String(valueMap.get(param.key) ?? param.default ?? '');
        textArea.rows = 9;
        textArea.style.cssText = 'margin-left:auto;min-width:0;flex:1;resize:vertical;background:#10131d;color:#d7def7;border:1px solid #3b445d;border-radius:4px;font-family:monospace;font-size:10px;line-height:1.45;padding:6px;white-space:pre;overflow:auto';
        controlMap.set(param.key, textArea);
        row.appendChild(textArea);
      }

      if (param.type === 'curve') {
        const curveWrap = document.createElement('div');
        curveWrap.style.cssText = 'margin-left:auto;display:flex;flex-direction:column;gap:4px;align-items:flex-end';

        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 72;
        canvas.style.cssText = 'width:110px;height:66px;border:1px solid #3b445d;border-radius:4px;cursor:crosshair;background:#141824';

        const pointsLabel = document.createElement('div');
        pointsLabel.style.cssText = 'font-size:9px;color:#8e97b3;max-width:120px;text-align:right';

        const maxPoints = param.curveMaxPoints ?? 6;
        let points = normalizeCurve(valueMap.get(param.key) ?? param.default);
        let activeIndex: number | null = null;

        const renderCurveValue = (value: unknown) => {
          points = normalizeCurve(value);
          setParamValue(param.key, cloneCurve(points), false);
          pointsLabel.textContent = points.map(([x]) => `${x.toFixed(2)}`).join(' | ');
          drawCurve(canvas, points);
        };

        const syncCurve = () => {
          renderCurveValue(points);
        };

        const getCanvasPoint = (event: PointerEvent): CurvePoint => {
          const rect = canvas.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, 1 - ((event.clientY - rect.top) / rect.height)));
          return [x, y];
        };

        const findNearest = ([x, y]: CurvePoint): number => {
          let bestIndex = 0;
          let bestDistance = Number.POSITIVE_INFINITY;
          points.forEach(([px, py], index) => {
            const distance = Math.hypot(px - x, py - y);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIndex = index;
            }
          });
          return bestDistance < 0.12 ? bestIndex : -1;
        };

        const updatePoint = (index: number, next: CurvePoint) => {
          const prevX = index > 0 ? points[index - 1]![0] + 0.02 : 0;
          const nextX = index < points.length - 1 ? points[index + 1]![0] - 0.02 : 1;
          const lockedX = index === 0 ? 0 : index === points.length - 1 ? 1 : Math.max(prevX, Math.min(nextX, next[0]));
          points[index] = [lockedX, next[1]];
          syncCurve();
          onParamChanged?.(param.key, cloneCurve(points));
        };

        canvas.addEventListener('pointerdown', (event) => {
          const next = getCanvasPoint(event);
          const nearest = findNearest(next);
          if (nearest >= 0) {
            activeIndex = nearest;
          } else if (points.length < maxPoints) {
            points.push(next);
            points.sort((a, b) => a[0] - b[0]);
            activeIndex = findNearest(next);
            syncCurve();
            onParamChanged?.(param.key, cloneCurve(points));
          }
          canvas.setPointerCapture(event.pointerId);
        });

        canvas.addEventListener('pointermove', (event) => {
          if (activeIndex == null) return;
          updatePoint(activeIndex, getCanvasPoint(event));
        });

        const releasePointer = (event: PointerEvent) => {
          activeIndex = null;
          if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
          }
        };

        canvas.addEventListener('pointerup', releasePointer);
        canvas.addEventListener('pointercancel', releasePointer);
        canvas.addEventListener('dblclick', (event) => {
          const nearest = findNearest(getCanvasPoint(event as PointerEvent));
          if (nearest > 0 && nearest < points.length - 1) {
            points.splice(nearest, 1);
            syncCurve();
            onParamChanged?.(param.key, cloneCurve(points));
          }
        });

        syncCurve();
        controlMap.set(param.key, canvas);
        curveStateMap.set(param.key, { setValue: renderCurveValue });
        curveWrap.appendChild(canvas);
        curveWrap.appendChild(pointsLabel);
        row.appendChild(curveWrap);
      }

      if (param.type === 'texture') {
        const textureWrap = document.createElement('div');
        textureWrap.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:4px;min-width:0';

        const preview = document.createElement('img');
        preview.alt = `${param.label} preview`;
        preview.width = 32;
        preview.height = 32;
        preview.style.cssText = 'width:32px;height:32px;object-fit:cover;border:1px solid #555;border-radius:4px;background:#111;flex-shrink:0';

        const fieldWrap = document.createElement('div');
        fieldWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:1;min-width:0';

        const select = (param.options?.length ?? 0) > 0 ? document.createElement('select') : null;
        if (select) {
          select.style.cssText = 'background:#333;color:#eee;border:1px solid #555;border-radius:4px;font-size:10px;padding:3px 4px;width:100%';
          const customOption = document.createElement('option');
          customOption.value = '';
          customOption.textContent = 'Custom';
          select.appendChild(customOption);
          for (const option of param.options ?? []) {
            const optionEl = document.createElement('option');
            optionEl.value = String(option.value);
            optionEl.textContent = option.label;
            select.appendChild(optionEl);
          }
        }

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = String(valueMap.get(param.key) ?? param.default ?? '');
        textInput.placeholder = 'Texture URL';
        textInput.style.cssText = 'background:#333;color:#eee;border:1px solid #555;border-radius:4px;font-size:10px;padding:3px 6px;width:100%;box-sizing:border-box';

        const syncTexture = (next: string) => {
          setParamValue(param.key, next, false);
          textInput.value = next;
          updateTexturePreview(preview, next);
          if (select) {
            const hasMatch = Array.from(select.options).some((option) => option.value === next);
            select.value = hasMatch ? next : '';
          }
        };

        if (select) {
          select.addEventListener('change', () => {
            const next = select.value;
            syncTexture(next);
            onParamChanged?.(param.key, next);
          });
          fieldWrap.appendChild(select);
        }

        textInput.addEventListener('change', () => {
          const next = textInput.value.trim();
          syncTexture(next);
          onParamChanged?.(param.key, next);
        });
        textInput.addEventListener('input', () => updateTexturePreview(preview, textInput.value));

        syncTexture(String(valueMap.get(param.key) ?? param.default ?? ''));
        controlMap.set(param.key, textInput);
        textureWrap.appendChild(preview);
        fieldWrap.appendChild(textInput);
        textureWrap.appendChild(fieldWrap);
        row.appendChild(textureWrap);
      }

      if (param.type === 'action') {
        const button = document.createElement('button');
        button.textContent = param.label;
        button.title = param.description ?? param.label;
        button.style.cssText = 'margin-left:auto;min-width:104px;background:#2d8cff;color:#fff;border:1px solid #5aa7ff;border-radius:4px;font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer';
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          setParamValue(param.key, Date.now());
        });
        controlMap.set(param.key, button);
        row.appendChild(button);
      }

      row.appendChild(resetBtn);
      syncResetButton(param.key);
      paramBlock.appendChild(row);

      if (param.description) {
        const description = document.createElement('div');
        description.className = 'debug-param-description';
        description.textContent = param.description;
        description.style.cssText = 'margin:3px 28px 0 62px;color:#7f8aa6;font-size:10px;line-height:1.35;white-space:normal';
        paramBlock.appendChild(description);
      }

      currentParamContainer.appendChild(paramBlock);
    }

    inner.appendChild(body);
    container.appendChild(inner);
    // expanded means full control DOM is live and can receive user input.
    _instanceState = 'expanded';
  };

  return {
    id: dsl.id,
    title: dsl.title,
    configFile: dsl.configFile,
    persistence: dsl.persistence ?? 'config',
    category: dsl.category,
    controller: dsl.controller,
    params: dsl.params,

    get isMounted(): boolean {
      return _container.current !== null;
    },

    get isExpanded(): boolean {
      return _instanceState === 'expanded';
    },

    get instanceState(): DebugPanelInstanceState {
      return _instanceState;
    },

    mount(container: HTMLElement): void {
      if (_instanceState === 'disposed') return;
      _container.current = container;
      renderFull(container);
    },

    renderCollapsed(container: HTMLElement): void {
      if (_instanceState === 'disposed') return;
      _container.current = container;
      renderCollapsedState(container);
    },

    expand(): void {
      if (_instanceState !== 'collapsed' || !_container.current) return;
      renderFull(_container.current);
    },

    collapse(): void {
      if (_instanceState !== 'expanded' || !_container.current) return;
      renderCollapsedState(_container.current);
    },

    unmount(): void {
      if (_instanceState === 'disposed') return;
      // unmount is reversible: keep valueMap/baselineValueMap so the panel can
      // remount with the same editable values after category or runtime changes.
      _container.current = null;
      _instanceState = 'registered';
      controlMap.clear();
      curveStateMap.clear();
      resetButtonMap.clear();
    },

    dispose(): void {
      // dispose is final for this generated instance. Clear values as well as
      // DOM lookup caches so a disposed panel cannot be accidentally reused by a
      // later session.
      _container.current = null;
      _instanceState = 'disposed';
      controlMap.clear();
      curveStateMap.clear();
      resetButtonMap.clear();
      valueMap.clear();
      baselineValueMap.clear();
      window.removeEventListener('debug-panel:set-param', handleExternalParamValue);
    },

    snapshot(): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const param of dsl.params) {
        result[param.key] = valueMap.get(param.key);
      }
      return result;
    },

    apply(config: Record<string, unknown>): void {
      for (const param of dsl.params) {
        if (param.key in config) {
          applyParamValue(param.key, config[param.key], false);
        }
      }
    },

    setResetBaseline(config: Record<string, unknown>): void {
      for (const param of dsl.params) {
        if (param.key in config) {
          baselineValueMap.set(param.key, cloneValue(config[param.key]));
        }
      }
      syncResetButtons();
    },
  };

  function applyParamValue(key: string, value: unknown, liveApply: boolean): void {
    const param = dsl.params.find(item => item.key === key);
    if (!param) return;

    // valueMap is the canonical panel state. DOM controls are synchronized only
    // when they exist; collapsed/registered panels still retain values here.
    valueMap.set(key, cloneValue(value));
    const ctrl = controlMap.get(key);
    if (ctrl instanceof HTMLInputElement) {
      if (ctrl.type === 'checkbox') {
        ctrl.checked = Boolean(value);
      } else if (ctrl.type === 'color') {
        ctrl.value = normalizeColor(value);
      } else {
        ctrl.value = String(value ?? '');
        if (param.type === 'number') {
          const numberInput = ctrl.parentElement?.querySelector('input[type="number"]');
          if (numberInput instanceof HTMLInputElement) {
            numberInput.value = String(value ?? '');
          }
        }
      }
    }
    if (ctrl instanceof HTMLDivElement && param.type === 'vector3') {
      const values = normalizeVector3(value);
      const inputs = Array.from(ctrl.querySelectorAll('input[type="number"]'));
      inputs.forEach((input, index) => {
        if (input instanceof HTMLInputElement) input.value = String(values[index] ?? 0);
      });
      valueMap.set(key, values);
    }
    if (ctrl instanceof HTMLSelectElement) {
      ctrl.value = String(value ?? '');
    }
    if (ctrl instanceof HTMLTextAreaElement) {
      ctrl.value = String(value ?? '');
    }
    if (ctrl instanceof HTMLCanvasElement) {
      curveStateMap.get(key)?.setValue(value);
    }
    if (ctrl instanceof HTMLInputElement && ctrl.type === 'text' && param.type === 'texture') {
      ctrl.value = String(value ?? '');
      const wrap = ctrl.closest('div');
      const previewImage = wrap?.parentElement?.querySelector('img');
      if (previewImage instanceof HTMLImageElement) {
        updateTexturePreview(previewImage, value);
      }
      const select = wrap?.querySelector('select');
      if (select instanceof HTMLSelectElement) {
        const next = String(value ?? '');
        const hasMatch = Array.from(select.options).some((option) => option.value === next);
        select.value = hasMatch ? next : '';
      }
    }
    syncResetButton(key);
    if (liveApply) onParamChanged?.(key, valueMap.get(key));
  }
}
