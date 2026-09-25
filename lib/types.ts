export type TaskColorId =
  | "pink"
  | "rose"
  | "coral"
  | "orange"
  | "peach"
  | "yellow"
  | "lemon"
  | "green"
  | "mint"
  | "teal"
  | "sky"
  | "blue"
  | "lilac"
  | "purple"

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
