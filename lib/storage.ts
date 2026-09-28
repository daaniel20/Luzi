import { isTaskColor } from "@/lib/colors"
import { DEFAULT_TASK_TYPES, withCurrentDefaults } from "@/lib/defaults"
import type { ScheduledTask, TaskType } from "@/lib/types"
import {
  DAY_MINUTES,
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  DEFAULT_SLOT,
  clamp,
  isSlotStep,
  overlaps,
  todayKey,
} from "@/lib/time"

const STORAGE_KEY = "luzi-schedule-v1"

export type ScheduleState = {
  types: TaskType[]
  tasks: ScheduledTask[]
  rangeStart: number
  rangeEnd: number
  slot: number
  split: number
}

function sanitizeTypes(value: unknown): TaskType[] {
  if (!Array.isArray(value)) return DEFAULT_TASK_TYPES
  const types: TaskType[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Partial<TaskType>
    if (typeof item.id !== "string" || typeof item.name !== "string") continue
    if (typeof item.emoji !== "string" || typeof item.color !== "string") continue
    if (!isTaskColor(item.color)) continue
    const name = item.name.trim().slice(0, 32)
    if (!name) continue
    types.push({ id: item.id, name, emoji: item.emoji, color: item.color })
  }
  return types
}

function sanitizeTasks(value: unknown, typeIds: Set<string>): ScheduledTask[] {
  if (!Array.isArray(value)) return []
  const tasks: ScheduledTask[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Partial<ScheduledTask>
    if (typeof item.id !== "string" || typeof item.typeId !== "string") continue
    if (!typeIds.has(item.typeId)) continue
    if (typeof item.start !== "number" || typeof item.end !== "number") continue
    const start = clamp(Math.round(item.start), 0, DAY_MINUTES * 2 - 5)
    const end = clamp(Math.round(item.end), start + 5, DAY_MINUTES * 2)
    if (overlaps(tasks, start, end)) continue
    tasks.push({
      id: item.id,
      typeId: item.typeId,
      start,
      end,
      done: item.done === true,
    })
  }
  return tasks
}

function readAxis(parsed: { rangeStart?: unknown; rangeEnd?: unknown; slot?: unknown }) {
  const rangeStart =
    typeof parsed.rangeStart === "number" ? parsed.rangeStart : DEFAULT_RANGE_START
  const rangeEnd = typeof parsed.rangeEnd === "number" ? parsed.rangeEnd : DEFAULT_RANGE_END
  const slot = typeof parsed.slot === "number" && isSlotStep(parsed.slot) ? parsed.slot : DEFAULT_SLOT
  return {
    rangeStart: clamp(Math.round(rangeStart), 0, DAY_MINUTES - 1),
    rangeEnd: clamp(Math.round(rangeEnd), 30, DAY_MINUTES * 2),
    slot,
  }
}

const empty = (): ScheduleState => ({
  types: DEFAULT_TASK_TYPES,
  tasks: [],
  rangeStart: DEFAULT_RANGE_START,
  rangeEnd: DEFAULT_RANGE_END,
  slot: DEFAULT_SLOT,
  split: 0.5,
})

export function loadSchedule(): ScheduleState {
  if (typeof window === "undefined") return empty()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as {
      types?: unknown
      tasks?: unknown
      day?: unknown
      rangeStart?: unknown
      rangeEnd?: unknown
      slot?: unknown
      split?: unknown
    }
    const types = withCurrentDefaults(sanitizeTypes(parsed.types))
    const typeIds = new Set(types.map((type) => type.id))
    const tasks = parsed.day === todayKey() ? sanitizeTasks(parsed.tasks, typeIds) : []
    return {
      types: types.length > 0 ? types : DEFAULT_TASK_TYPES,
      tasks,
      ...readAxis(parsed),
      split:
        typeof parsed.split === "number"
          ? clamp(parsed.split, 0.22, 0.78)
          : 0.5,
    }
  } catch {
    return empty()
  }
}

export function saveSchedule(state: ScheduleState) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      types: state.types,
      tasks: state.tasks,
      day: todayKey(),
      rangeStart: state.rangeStart,
      rangeEnd: state.rangeEnd,
      slot: state.slot,
      split: state.split,
    })
  )
}
