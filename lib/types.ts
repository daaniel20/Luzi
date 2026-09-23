export type TaskColorId =
  | "pink"
  | "rose"
  | "orange"
  | "peach"
  | "green"
  | "mint"

export type TaskType = {
  id: string
  name: string
  emoji: string
  color: TaskColorId
}

export type ScheduledTask = {
  id: string
  typeId: string
  start: number
  end: number
}
