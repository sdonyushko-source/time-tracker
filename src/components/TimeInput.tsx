import { useEffect, useRef, useState } from "react";

interface TimeInputProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

// A 4-slot masked HH:MM input. Unlike a plain "strip non-digits and
// re-split in half" input, editing one digit only ever touches that exact
// slot — the other three stay put and the cursor doesn't jump. Typing into
// a fully-selected field (Cmd+A, or double/triple-click) still fills all
// four slots in order, so pasting/typing "1539" still gives "15:39".

// Reads slots by literal character position (0,1,3,4 — skipping the colon
// at index 2), not by collapsing all digits found anywhere in the string.
// Collapsing is exactly the bug this component fixes: a digit typed at one
// slot must never reflow into a neighboring slot.
function parseSlots(value: string): string[] {
  const slots = ["", "", "", ""];
  [0, 1, 3, 4].forEach((pos, slot) => {
    const c = value[pos];
    if (c && /[0-9]/.test(c)) slots[slot] = c;
  });
  return slots;
}

function slotsToValue(slots: string[]): string {
  const c = slots.map((s) => (s === "" ? " " : s));
  return `${c[0]}${c[1]}:${c[2]}${c[3]}`;
}

function normalizeSlots(slots: string[]): string {
  const h = parseInt((slots[0] || "0") + (slots[1] || "0"), 10);
  const m = parseInt((slots[2] || "0") + (slots[3] || "0"), 10);
  const hh = Math.min(23, isNaN(h) ? 0 : h);
  const mm = Math.min(59, isNaN(m) ? 0 : m);
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

// gap = caret position in the rendered "HH:MM" string (0..5)
function slotForDigit(gap: number): number {
  if (gap <= 1) return gap;
  return gap <= 3 ? 2 : 3;
}
function slotForBackspace(gap: number): number {
  if (gap <= 0) return -1;
  if (gap === 1) return 0;
  if (gap <= 3) return 1; // gap2 (after H1) or gap3 (after colon) both remove H1
  return gap === 4 ? 2 : 3;
}
function gapAfterFill(slot: number): number {
  return [1, 3, 4, 5][slot];
}
function gapAtSlot(slot: number): number {
  return [0, 1, 3, 4][slot];
}

export default function TimeInput({ value, onChange, style }: TimeInputProps) {
  const [slots, setSlots] = useState<string[]>(() => parseSlots(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  useEffect(() => {
    if (slotsToValue(slots) !== value) setSlots(parseSlots(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (pendingCursor.current !== null) {
      inputRef.current?.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [slots]);

  const apply = (nextSlots: string[], cursor: number) => {
    setSlots(nextSlots);
    onChange(slotsToValue(nextSlots));
    pendingCursor.current = cursor;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const gap = input.selectionStart ?? 0;
    const gapEnd = input.selectionEnd ?? gap;
    const allSelected = gap === 0 && gapEnd === input.value.length;

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const base = allSelected ? ["", "", "", ""] : slots;
      const slot = allSelected ? 0 : slotForDigit(gap);
      const next = [...base];
      next[slot] = e.key;
      apply(next, gapAfterFill(slot));
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      if (allSelected) {
        apply(["", "", "", ""], 0);
        return;
      }
      const slot = slotForBackspace(gap);
      if (slot === -1) return;
      const next = [...slots];
      next[slot] = "";
      apply(next, gapAtSlot(slot));
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      const slot = slotForDigit(gap);
      const next = [...slots];
      next[slot] = "";
      apply(next, gapAtSlot(slot));
      return;
    }

    if (e.key === "Enter") {
      input.blur();
      return;
    }
    // ArrowLeft/ArrowRight, Tab, and modifier shortcuts (Cmd+A, Cmd+C…)
    // pass through untouched.
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4).split("");
    if (digits.length === 0) return;
    const next = ["", "", "", ""];
    digits.forEach((d, i) => { next[i] = d; });
    apply(next, gapAfterFill(digits.length - 1));
  };

  const handleBlur = () => {
    const normalized = normalizeSlots(slots);
    setSlots(parseSlots(normalized));
    onChange(normalized);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={slotsToValue(slots)}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={handleBlur}
      style={style}
    />
  );
}
