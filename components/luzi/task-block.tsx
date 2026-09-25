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
  active?: boolean
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
  active = false,
  onPointerDown,
  onResizePointerDown,
}: TaskBlockProps) {
  const slots = Math.max(1, (end - start) / slot)
  const top = pad + ((start - rangeStart) / slot) * slotPx + 3
  const height = Math.max(slots * slotPx - 6, slotPx - 6)
  const showName = height >= 52
  const showTime = height >= 78
  const handleHeight = slots <= 1 ? "h-4" : "h-8"

  return (
    <div
      role="group"
      aria-label={`${name} ${formatRange(start, end)}`}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-x-16 z-10 flex cursor-grab touch-none items-center gap-2 overflow-hidden rounded-[20px] px-3 shadow-[0_8px_18px_rgba(80,70,90,0.12)] select-none active:cursor-grabbing",
        active && "z-30 shadow-[0_14px_28px_rgba(80,70,90,0.2)]",
        mode === "invalid" && "opacity-60 saturate-50",
        mode === "deleting" && "scale-[0.98] opacity-45",
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

      <span className="pointer-events-none text-[28px] leading-none" aria-hidden>
        {emoji}
      </span>
      {showName && (
        <span className="pointer-events-none min-w-0">
          <span className="block truncate text-base font-bold leading-5">{name}</span>
          {showTime && (
            <span dir="ltr" className="mt-0.5 block text-sm font-semibold opacity-80">
              {formatRange(start, end)}
            </span>
          )}
          {mode === "invalid" && <span className="mt-0.5 block text-sm font-bold">תפוס</span>}
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
