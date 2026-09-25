import type { ScheduledTask } from "@/lib/types"
import { DEFAULT_DURATION, clamp, overlaps, snap } from "@/lib/time"

export type Zone = "timeline" | "trash" | "bank" | "outside"

export type DragKind = "create" | "move" | "resize-start" | "resize-end"

export type DragPreview = {
  kind: DragKind
  typeId: string
  taskId?: string
  x: number
  y: number
  zone: Zone
  start: number
  end: number
  valid: boolean
  deleting: boolean
}

export type Axis = {
  rangeStart: number
  rangeEnd: number
  slot: number
}

export function zoneAt(
  x: number,
  y: number,
  rects: {
    timeline: DOMRect | null
    trash: DOMRect | null
    bank: DOMRect | null
  }
): Zone {
  const hit = (rect: DOMRect | null) =>
    !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  if (hit(rects.trash)) return "trash"
  if (hit(rects.bank)) return "bank"
  if (hit(rects.timeline)) return "timeline"
  return "outside"
}

export function minuteAtY(
  clientY: number,
  rect: DOMRect,
  scrollTop: number,
  slotPx: number,
  axis: Axis,
  pad = 0
) {
  const y = clientY - rect.top + scrollTop - pad
  const span = axis.rangeEnd - axis.rangeStart
  const maxY = (span / axis.slot) * slotPx
  const clamped = Math.min(Math.max(0, y), maxY)
  return axis.rangeStart + (clamped / slotPx) * axis.slot
}

export function previewDrag(
  input: {
    kind: DragKind
    typeId: string
    taskId?: string
    x: number
    y: number
    originStart: number
    originEnd: number
    grabOffset: number
    tasks: ScheduledTask[]
    zone: Zone
    minute: number
  } & Axis
): DragPreview {
  const { rangeStart, rangeEnd, slot } = input
  const base = {
    kind: input.kind,
    typeId: input.typeId,
    taskId: input.taskId,
    x: input.x,
    y: input.y,
    zone: input.zone,
  }

  if (input.kind === "create") {
    if (input.zone !== "timeline") {
      return {
        ...base,
        start: rangeStart,
        end: rangeStart + DEFAULT_DURATION,
        valid: false,
        deleting: false,
      }
    }
    let start = snap(input.minute, slot)
    start = clamp(start, rangeStart, rangeEnd - slot)
    const occupied = input.tasks.some((task) => start >= task.start && start < task.end)
    if (occupied) {
      return { ...base, start, end: start + slot, valid: false, deleting: false }
    }
    const nextStart = input.tasks
      .filter((task) => task.start >= start)
      .reduce((min, task) => Math.min(min, task.start), rangeEnd)
    const room = nextStart - start
    const duration = Math.floor(Math.min(DEFAULT_DURATION, room) / slot) * slot
    if (duration < slot) {
      return { ...base, start, end: start + slot, valid: false, deleting: false }
    }
    return { ...base, start, end: start + duration, valid: true, deleting: false }
  }

  if (input.kind === "move") {
    const duration = input.originEnd - input.originStart
    let start = snap(input.minute - input.grabOffset, slot)
    start = clamp(start, rangeStart, rangeEnd - duration)
    const end = start + duration
    if (input.zone === "trash" || input.zone === "bank") {
      return { ...base, start, end, valid: true, deleting: true }
    }
    return {
      ...base,
      start,
      end,
      valid: !overlaps(input.tasks, start, end, input.taskId),
      deleting: false,
    }
  }

  if (input.kind === "resize-end") {
    const ceiling = input.tasks
      .filter((task) => task.id !== input.taskId && task.start >= input.originEnd)
      .reduce((min, task) => Math.min(min, task.start), rangeEnd)
    const end = clamp(snap(input.minute, slot), input.originStart + slot, ceiling)
    return {
      ...base,
      zone: "timeline",
      start: input.originStart,
      end,
      valid: true,
      deleting: false,
    }
  }

  const floor = input.tasks
    .filter((task) => task.id !== input.taskId && task.end <= input.originStart)
    .reduce((max, task) => Math.max(max, task.end), rangeStart)
  const start = clamp(snap(input.minute, slot), floor, input.originEnd - slot)
  return {
    ...base,
    zone: "timeline",
    start,
    end: input.originEnd,
    valid: true,
    deleting: false,
  }
}
