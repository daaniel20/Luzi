"use client"

import type { PointerEvent } from "react"

import type { TaskColor } from "@/lib/colors"
import { formatRange } from "@/lib/time"
import { cn } from "cn"

type TaskBlockProps = {
  name: string
  emoji: string
  color: TaskColor
  start: number
  end: number
  rangeStart: number
  slot: number
  slotPx: number
  pad?: number
  mode: "idle" | "invalid" | "deleting" | "preview"
  done?: boolean
  active?: boolean
  onToggleDone?: () => void
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onResizePointerDown?: (
    edge: "start" | "end",
    event: PointerEvent<HTMLButtonElement>
  ) => void
}

export function TaskBlock({
  name,
  emoji,
  color,
  start,
  end,
  rangeStart,
  slot,
  slotPx,
  pad = 0,
  mode,
  done = false,
  active = false,
  onToggleDone,
  onPointerDown,
  onResizePointerDown,
}: TaskBlockProps) {
  const slots = Math.max(1, (end - start) / slot)
  const top = pad + ((start - rangeStart) / slot) * slotPx + 3
  const height = Math.max(slots * slotPx - 6, slotPx - 6)
  const showName = height >= 64
  const showTime = height >= 96
  const handleHeight = slots <= 1 ? "h-4" : "h-8"

  return (
    <div
      role="group"
      aria-label={`${name} ${formatRange(start, end)}${done ? " בוצע" : ""}`}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute start-20 end-3 z-10 flex cursor-grab touch-none items-center justify-center gap-2 overflow-hidden rounded-[20px] px-3 text-center shadow-[0_8px_18px_rgba(80,70,90,0.12)] select-none active:cursor-grabbing",
        onToggleDone && "ps-14",
        active && "z-30 shadow-[0_14px_28px_rgba(80,70,90,0.2)]",
        mode === "invalid" && "opacity-60 saturate-50",
        mode === "deleting" && "scale-[0.98] opacity-45",
        done && "opacity-80",
        mode === "preview" && "pointer-events-none ring-4 ring-white",
        !onPointerDown && "pointer-events-none"
      )}
      style={{ top, height, background: color.bg, color: color.ink }}
    >
      {onResizePointerDown && (
        <button
          type="button"
          aria-label="שינוי שעת ההתחלה"
          className={cn(
            "absolute inset-x-0 top-0 z-10 flex touch-none items-center justify-center",
            handleHeight
          )}
          onPointerDown={(event) => {
            event.stopPropagation()
            onResizePointerDown("start", event)
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-white/85 shadow-sm" />
        </button>
      )}

      {onToggleDone && (
        <button
          type="button"
          data-no-drag
          aria-label={done ? `${name} סומן כבוצע` : `סימון ${name} כבוצע`}
          aria-pressed={done}
          className={cn(
            "absolute start-2 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border-2 text-2xl font-bold leading-none shadow-sm",
            done
              ? "border-[#1f6b45] bg-[#1f6b45] text-white"
              : "border-white/90 bg-white/85 text-[#355067]/35"
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleDone()
          }}
        >
          <span aria-hidden>✓</span>
        </button>
      )}

      <span className="pointer-events-none text-[36px] leading-none" aria-hidden>
        {emoji}
      </span>
      {showName && (
        <span className="pointer-events-none min-w-0 text-center">
          <span className={cn("block truncate text-xl font-bold leading-6", done && "line-through")}>
            {name}
          </span>
          {showTime && (
            <span dir="ltr" className="mt-0.5 block text-base font-semibold opacity-80">
              {formatRange(start, end)}
            </span>
          )}
          {mode === "invalid" && <span className="mt-0.5 block text-base font-bold">תפוס</span>}
        </span>
      )}

      {onResizePointerDown && (
        <button
          type="button"
          aria-label="שינוי שעת הסיום"
          className={cn(
            "absolute inset-x-0 bottom-0 z-10 flex touch-none items-center justify-center",
            handleHeight
          )}
          onPointerDown={(event) => {
            event.stopPropagation()
            onResizePointerDown("end", event)
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-white/85 shadow-sm" />
        </button>
      )}
    </div>
  )
}
