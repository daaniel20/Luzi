export const DEFAULT_RANGE_START = 6 * 60 + 30
export const DAY_MINUTES = 24 * 60
export const DEFAULT_RANGE_END = DEFAULT_RANGE_START + DAY_MINUTES
export const DEFAULT_SLOT = 15
export const SLOT_STEPS = [60, 30, 15, 10, 5] as const
export const DEFAULT_DURATION = 60

export type SlotStep = (typeof SLOT_STEPS)[number]

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function isSlotStep(value: number): value is SlotStep {
  return (SLOT_STEPS as readonly number[]).includes(value)
}

export function snap(minutes: number, slot: number) {
  return Math.round(minutes / slot) * slot
}

export function formatClock(minutes: number) {
  const normalized = ((Math.round(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

export function formatRange(start: number, end: number) {
  const endLabel = end - start >= DAY_MINUTES && end % DAY_MINUTES === start % DAY_MINUTES
    ? `${formatClock(end)} למחרת`
    : formatClock(end)
  return `${formatClock(start)}–${endLabel}`
}

export function slotLabel(slot: number) {
  if (slot === 60) return "כל שעה"
  if (slot === 30) return "כל חצי שעה"
  if (slot === 15) return "כל רבע שעה"
  return `כל ${slot} דקות`
}

export function resolveRange(startClock: number, endClock: number) {
  const start = clamp(Math.round(startClock), 0, DAY_MINUTES - 1)
  let end = clamp(Math.round(endClock), 0, DAY_MINUTES)
  if (end <= start) end += DAY_MINUTES
  if (end - start < 30) end = start + 30
  return { rangeStart: start, rangeEnd: end }
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

export function nowMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes()
}
