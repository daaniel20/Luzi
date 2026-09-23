import { isTaskColor } from "@/lib/colors"
import { DEFAULT_TASK_TYPES } from "@/lib/defaults"
import type { ScheduledTask, TaskType } from "@/lib/types"
import {
  DAY_END,
  DAY_START,
  SLOT,
  clamp,
  overlaps,
  snap,
  todayKey,
} from "@/lib/time"

const STORAGE_KEY = "luzi-schedule-v1"

export type ScheduleState = {
  types: TaskType[]
  tasks: ScheduledTask[]
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
    const name = item.name.trim().slice(0, 16)
    if (!name) continue
    types.push({
      id: item.id,
      name,
      emoji: item.emoji,
      color: item.color,
    })
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
    const start = clamp(snap(item.start), DAY_START, DAY_END - SLOT)
    const end = clamp(snap(item.end), start + SLOT, DAY_END)
    if (overlaps(tasks, start, end)) continue
    tasks.push({ id: item.id, typeId: item.typeId, start, end })
  }
  return tasks
}

export function loadSchedule(): ScheduleState {
  if (typeof window === "undefined") {
    return { types: DEFAULT_TASK_TYPES, tasks: [] }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { types: DEFAULT_TASK_TYPES, tasks: [] }
    const parsed = JSON.parse(raw) as {
      types?: unknown
      tasks?: unknown
      day?: unknown
    }
    const types = sanitizeTypes(parsed.types)
    const typeIds = new Set(types.map((type) => type.id))
    const tasks =
      parsed.day === todayKey() ? sanitizeTasks(parsed.tasks, typeIds) : []
    return { types: types.length > 0 ? types : DEFAULT_TASK_TYPES, tasks }
  } catch {
    return { types: DEFAULT_TASK_TYPES, tasks: [] }
  }
}

export function saveSchedule(state: ScheduleState) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      types: state.types,
      tasks: state.tasks,
      day: todayKey(),
    })
  )
}
