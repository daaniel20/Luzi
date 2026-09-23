"use client"

import type { PointerEvent } from "react"

import type { TaskColor } from "@/lib/colors"
import { DAY_START, SLOT, formatRange } from "@/lib/time"
import { cn } from "cn"

type TaskBlockProps = {
  name: string
  emoji: string
  color: TaskColor
  start: number
  end: number
  slotPx: number
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
  slotPx,
  mode,
  active = false,
  onPointerDown,
  onResizePointerDown,
}: TaskBlockProps) {
  const slots = Math.max(1, (end - start) / SLOT)
  const left = ((start - DAY_START) / SLOT) * slotPx + 4
  const width = Math.max(slots * slotPx - 8, slotPx - 8)
  const showName = slots >= 2
  const showTime = slots >= 3
  const handleWidth = slots <= 1 ? "w-5" : "w-10"

  return (
    <div
      role="group"
      aria-label={`${name} ${formatRange(start, end)}`}
      onPointerDown={onPointerDown}
      dir="ltr"
      className={cn(
        "absolute top-[52px] z-10 flex h-[112px] cursor-grab touch-none select-none items-center justify-center overflow-hidden rounded-[22px] px-2 shadow-[0_8px_18px_rgba(80,70,90,0.12)] active:cursor-grabbing",
        active && "z-30 shadow-[0_14px_28px_rgba(80,70,90,0.2)]",
        mode === "invalid" && "opacity-60 saturate-50",
        mode === "deleting" && "scale-[0.97] opacity-45",
        mode === "preview" && "pointer-events-none ring-4 ring-white",
        !onPointerDown && "pointer-events-none"
      )}
      style={{
        left,
        width,
        background: color.bg,
        color: color.ink,
      }}
    >
      {onResizePointerDown && (
        <button
          type="button"
          aria-label="שינוי שעת ההתחלה"
          className={cn(
            "absolute inset-y-0 start-0 z-10 flex touch-none items-center justify-center",
            handleWidth
          )}
          onPointerDown={(event) => {
            event.stopPropagation()
            onResizePointerDown("start", event)
          }}
        >
          <span className="h-10 w-1.5 rounded-full bg-white/85 shadow-sm" />
        </button>
      )}

      <div className="pointer-events-none flex min-w-0 items-center justify-center gap-2">
        <span className="text-[32px] leading-none" aria-hidden>
          {emoji}
        </span>
        {showName && (
          <span className="min-w-0 text-start">
            <span className="block truncate text-base font-bold leading-5">{name}</span>
            {showTime && (
              <span dir="ltr" className="mt-0.5 block text-sm font-semibold opacity-80">
                {formatRange(start, end)}
              </span>
            )}
            {mode === "invalid" && (
              <span className="mt-0.5 block text-sm font-bold">תפוס</span>
            )}
          </span>
        )}
      </div>

      {onResizePointerDown && (
        <button
          type="button"
          aria-label="שינוי שעת הסיום"
          className={cn(
            "absolute inset-y-0 end-0 z-10 flex touch-none items-center justify-center",
            handleWidth
          )}
          onPointerDown={(event) => {
            event.stopPropagation()
            onResizePointerDown("end", event)
          }}
        >
          <span className="h-10 w-1.5 rounded-full bg-white/85 shadow-sm" />
        </button>
      )}
    </div>
  )
}
