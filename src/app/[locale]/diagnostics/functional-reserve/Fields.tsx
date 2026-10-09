import React from "react";

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-leaf/40";

export function Field({
  id, label, hint, value, onChange, error, unit, disabled, units, unit2, onUnit,
}: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void;
  error?: boolean; unit?: string; disabled?: boolean; units?: string[]; unit2?: string; onUnit?: (u: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${error ? "border-red-400" : ""} ${disabled ? "opacity-50" : ""}`}
        />
        {units && onUnit ? (
          <select
            aria-label={`${label} unit`}
            value={unit2}
            onChange={(e) => onUnit(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2 py-3 text-sm"
          >
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        ) : unit ? (
          <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>
        ) : null}
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Select({
  id, label, options, value, onChange,
}: { id: string; label: string; options: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} className={inputCls}>
        {options.map((o, i) => <option key={o} value={i}>{o}</option>)}
      </select>
    </div>
  );
}

export function Check({
  id, label, checked, onChange, disabled,
}: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-green-700" />
      <span className="text-sm text-gray-800">{label}</span>
    </label>
  );
}

export const num = (s: string): number => parseFloat(s.replace(",", "."));
export const inRange = (s: string, lo: number, hi: number): boolean => {
  const v = num(s);
  return !isNaN(v) && v >= lo && v <= hi;
};
