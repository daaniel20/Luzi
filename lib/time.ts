export const DAY_START = 7 * 60
export const DAY_END = 20 * 60
export const SLOT = 15
export const SLOT_COUNT = (DAY_END - DAY_START) / SLOT
export const DEFAULT_DURATION = 60

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function snap(minutes: number) {
  return Math.round(minutes / SLOT) * SLOT
}

export function formatClock(minutes: number) {
  const normalized = ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60)
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

export function formatRange(start: number, end: number) {
  return `${formatClock(start)}–${formatClock(end)}`
}

export function overlaps(
  tasks: { id?: string; start: number; end: number }[],
  start: number,
  end: number,
  ignoreId?: string
) {
  return tasks.some(
    (task) => task.id !== ignoreId && start < task.end && end > task.start
  )
}

export function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function greetingFor(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return "בוקר טוב"
  if (hour < 17) return "צהריים טובים"
  if (hour < 21) return "ערב טוב"
  return "לילה טוב"
}
