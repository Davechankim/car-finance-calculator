'use client';
import { fmtMan, parseDigits } from '@/lib/format';
import type { ModeValue } from '@/lib/engine/types';

export function MoneyInput(props: {
  label: string; value: number; onChange: (v: number) => void; placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <input
        inputMode="numeric"
        value={props.value === 0 ? '' : props.value.toLocaleString('ko-KR')}
        placeholder={props.placeholder ?? '0'}
        onChange={(e) => props.onChange(parseDigits(e.target.value))}
      />
      <span className="hint">{fmtMan(props.value)}원</span>
    </div>
  );
}

export function NumInput(props: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; step?: number; min?: number; max?: number;
}) {
  return (
    <div className="field">
      <label>{props.label}{props.suffix ? ` (${props.suffix})` : ''}</label>
      <input
        type="number" value={props.value} step={props.step ?? 0.1}
        min={props.min} max={props.max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) props.onChange(v); // 부분 입력('-', '3e')의 NaN이 엔진으로 전파되는 것 차단
        }}
      />
    </div>
  );
}

export function SelectInput(props: {
  label: string; value: number; options: string[]; onChange: (idx: number) => void;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <select value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}>
        {props.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
      </select>
    </div>
  );
}

export function Chips<T extends string>(props: {
  value: T; options: { key: T; label: string }[]; onChange: (k: T) => void;
}) {
  return (
    <span className="chips">
      {props.options.map((o) => (
        <button
          key={o.key} type="button"
          className={`chip ${props.value === o.key ? 'on' : ''}`}
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
  const resolved = props.mv.mode === 'pct' ? props.base * (props.mv.value / 100) : props.mv.value;
  return (
    <div className="field">
      <label>{props.label}</label>
      <div className="row" style={{ marginBottom: 0 }}>
        <Chips
          value={props.mv.mode}
          options={[{ key: 'pct', label: '비율' }, { key: 'amount', label: '금액' }]}
          onChange={(mode) =>
            props.onChange(mode === 'pct'
              ? { mode, value: props.base > 0 ? Math.round((props.mv.value / props.base) * 100) : 30 }
              : { mode, value: resolved })}
        />
        {props.mv.mode === 'pct' ? (
          <input
            style={{ width: 70 }} type="number" value={props.mv.value} min={0} max={100}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) props.onChange({ mode: 'pct', value: v });
            }}
          />
        ) : (
          <input
            style={{ flex: 1 }} inputMode="numeric"
            value={props.mv.value === 0 ? '' : props.mv.value.toLocaleString('ko-KR')}
            onChange={(e) => props.onChange({ mode: 'amount', value: parseDigits(e.target.value) })}
          />
        )}
      </div>
      <span className="hint">= {fmtMan(resolved)}원</span>
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
  return <span className="badge-warn">⚠ {children}</span>;
}
