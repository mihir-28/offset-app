"use client";

import * as React from "react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

const OPERATORS = ["+", "-", "*", "/"] as const;

/**
 * Amount field that accepts math expressions ("100+50*2").
 *
 * Mobile keypads set by inputMode="decimal" only offer digits and ".", so the
 * operator row supplies the rest. Buttons insert at the caret and never take
 * focus, which keeps the keypad open mid-expression.
 */
export function AmountInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const insert = (operator: string) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    onValueChange(value.slice(0, start) + operator + value.slice(end));
    // Restore the caret after React re-renders with the new value.
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + operator.length, start + operator.length);
    });
  };

  return (
    <div className="space-y-1.5">
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={className}
        {...props}
      />
      <div className="flex gap-1.5">
        {OPERATORS.map((operator) => (
          <button
            key={operator}
            type="button"
            aria-label={`Insert ${operator}`}
            // Keeps focus (and the mobile keypad) on the input.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insert(operator)}
            className={cn(
              "h-7 flex-1 rounded-md border border-zinc-800 bg-zinc-900 text-xs font-semibold",
              "text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700"
            )}
          >
            {operator}
          </button>
        ))}
      </div>
    </div>
  );
}
