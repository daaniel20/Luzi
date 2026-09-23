import type { TaskColorId } from "@/lib/types"

export type TaskColor = {
  id: TaskColorId
  label: string
  bg: string
  ink: string
  solid: string
}

export const TASK_COLORS: TaskColor[] = [
  { id: "pink", label: "ורוד", bg: "#FFB7CE", ink: "#72243F", solid: "#FF8FB3" },
  { id: "rose", label: "ורוד בהיר", bg: "#FFD0DE", ink: "#82344E", solid: "#FFA8C4" },
  { id: "orange", label: "כתום", bg: "#FFC48A", ink: "#73380A", solid: "#FFB067" },
  { id: "peach", label: "אפרסק", bg: "#FFD8B0", ink: "#734816", solid: "#FFC48A" },
  { id: "green", label: "ירוק", bg: "#A8E3B8", ink: "#145C32", solid: "#67CC7E" },
  { id: "mint", label: "מנטה", bg: "#C3F0DC", ink: "#0E5A46", solid: "#86D8B4" },
]

export function colorById(id: TaskColorId): TaskColor {
  return TASK_COLORS.find((color) => color.id === id) ?? TASK_COLORS[4]
}

export function isTaskColor(value: string): value is TaskColorId {
  return TASK_COLORS.some((color) => color.id === value)
}
