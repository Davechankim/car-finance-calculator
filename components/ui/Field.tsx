'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { fmtMan, parseDigits } from '@/lib/format';
import type { ModeValue } from '@/lib/engine/types';

const MAX_INPUT_WON = 10_000_000_000;
const parseMoney = (value: string) => Math.min(parseDigits(value), MAX_INPUT_WON);

export function convertModeValue(
  mv: ModeValue,
  mode: ModeValue['mode'],
  base: number,
): ModeValue {
  if (mode === mv.mode) return mv;
  const resolved = mv.mode === 'pct' ? base * (mv.value / 100) : mv.value;
  return mode === 'pct'
    ? {
        mode,
        value: base > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round((mv.value / base) * 100 * 1_000_000) / 1_000_000,
              ),
            )
          : 0,
      }
    : { mode, value: Math.round(resolved) };
}

export function MoneyInput(props: {
  label: string; value: number; onChange: (v: number) => void; placeholder?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={props.value === 0 ? '' : Math.round(props.value).toLocaleString('ko-KR')}
        placeholder={props.placeholder ?? '0'}
        aria-describedby={hintId}
        onChange={(e) => props.onChange(parseMoney(e.target.value))}
      />
      <span className="hint" id={hintId}>{fmtMan(props.value)}원</span>
    </div>
  );
}

export function NumInput(props: {
  label: string; value: number; onChange: (v: number) => boolean | void;
  suffix?: string; step?: number; min?: number; max?: number;
  empty?: boolean; onEmpty?: () => void; integer?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const initial = props.empty ? '' : String(props.value);
  const [draft, setDraft] = useState(initial);
  const focused = useRef(false);
  const cancelBlur = useRef(false);
  useEffect(() => {
    if (!focused.current) {
      setDraft(props.empty ? '' : String(props.value));
    }
  }, [props.empty, props.value]);

  const parsed = draft.trim() === '' ? null : Number(draft);
  const invalid = parsed != null && (
    !Number.isFinite(parsed) ||
    (props.integer === true && !Number.isInteger(parsed)) ||
    (props.min != null && parsed < props.min) ||
    (props.max != null && parsed > props.max)
  );
  const commit = () => {
    if (parsed == null) {
      props.onEmpty?.();
      setDraft(props.onEmpty ? '' : String(props.value));
      return;
    }
    if (!Number.isFinite(parsed)) {
      setDraft(String(props.value));
      return;
    }
    const normalized = props.integer ? Math.round(parsed) : parsed;
    const bounded = Math.min(
      props.max ?? Infinity,
      Math.max(props.min ?? -Infinity, normalized),
    );
    const accepted = props.onChange(bounded);
    setDraft(accepted === false
      ? (props.empty ? '' : String(props.value))
      : String(bounded));
  };

  return (
    <div className="field">
      <label htmlFor={id}>{props.label}{props.suffix ? ` (${props.suffix})` : ''}</label>
      <input
        id={id}
        type="number" value={draft} step={props.step ?? 0.1}
        min={props.min} max={props.max}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onFocus={() => {
          focused.current = true;
          cancelBlur.current = false;
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          if (next.trim() === '') {
            props.onEmpty?.();
            return;
          }
          const v = Number(next);
          if (
            Number.isFinite(v) &&
            (!props.integer || Number.isInteger(v)) &&
            (props.min == null || v >= props.min) &&
            (props.max == null || v <= props.max)
          ) {
            const accepted = props.onChange(v);
            if (accepted === false) {
              setDraft(props.empty ? '' : String(props.value));
            }
          }
        }}
        onBlur={() => {
          focused.current = false;
          if (cancelBlur.current) {
            cancelBlur.current = false;
            setDraft(props.empty ? '' : String(props.value));
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelBlur.current = true;
            setDraft(props.empty ? '' : String(props.value));
            e.currentTarget.blur();
          }
        }}
      />
      {invalid && <span className="field-error" id={errorId}>허용 범위를 확인해 주세요.</span>}
    </div>
  );
}

export function SelectInput(props: {
  label: string; value: number; options: string[]; onChange: (idx: number) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
      </select>
    </div>
  );
}

export function Chips<T extends string>(props: {
  value: T; options: { key: T; label: string }[]; onChange: (k: T) => void;
  ariaLabel?: string;
}) {
  return (
    <span className="chips" role="group" aria-label={props.ariaLabel ?? '선택'}>
      {props.options.map((o) => (
        <button
          key={o.key} type="button"
          className={`chip ${props.value === o.key ? 'on' : ''}`}
          aria-pressed={props.value === o.key}
          onClick={() => props.onChange(o.key)}
        >{o.label}</button>
      ))}
    </span>
  );
}

/** 비율/금액 토글 입력 (스펙 §3 ModeValue) */
export function PctOrAmountInput(props: {
  label: string; mv: ModeValue; base: number; onChange: (mv: ModeValue) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const resolved = props.mv.mode === 'pct' ? props.base * (props.mv.value / 100) : props.mv.value;
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <div className="row" style={{ marginBottom: 0 }}>
        <Chips
          ariaLabel={`${props.label} 입력 방식`}
          value={props.mv.mode}
          options={[{ key: 'pct', label: '비율' }, { key: 'amount', label: '금액' }]}
          onChange={(mode) => {
            const next = convertModeValue(props.mv, mode, props.base);
            if (next !== props.mv) props.onChange(next);
          }}
        />
        {props.mv.mode === 'pct' ? (
          <input
            id={id}
            style={{ width: 70 }} type="number" step={0.1} value={props.mv.value} min={0} max={100}
            aria-describedby={hintId}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                props.onChange({ mode: 'pct', value: Math.min(Math.max(v, 0), 100) });
              }
            }}
          />
        ) : (
          <input
            id={id}
            style={{ flex: 1 }} inputMode="numeric"
            value={props.mv.value === 0 ? '' : Math.round(props.mv.value).toLocaleString('ko-KR')}
            aria-describedby={hintId}
            onChange={(e) => props.onChange({ mode: 'amount', value: parseMoney(e.target.value) })}
          />
        )}
      </div>
      <span className="hint" id={hintId}>= {fmtMan(resolved)}원</span>
    </div>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="row" style={{ fontSize: 12, cursor: 'pointer', marginBottom: 0 }}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      {props.label}
    </label>
  );
}

export function WarnBadge({ children }: { children: React.ReactNode }) {
  return <span className="badge-warn" role="status">⚠ {children}</span>;
}
