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
  { id: "coral", label: "אלמוג", bg: "#FFB5A8", ink: "#7A2E24", solid: "#FF8E7D" },
  { id: "orange", label: "כתום", bg: "#FFC48A", ink: "#73380A", solid: "#FFB067" },
  { id: "peach", label: "אפרסק", bg: "#FFD8B0", ink: "#734816", solid: "#FFC48A" },
  { id: "yellow", label: "צהוב", bg: "#FFE08A", ink: "#6A4E04", solid: "#F5C84C" },
  { id: "lemon", label: "לימון", bg: "#FFF1A8", ink: "#64580A", solid: "#F3E27A" },
  { id: "green", label: "ירוק", bg: "#A8E3B8", ink: "#145C32", solid: "#67CC7E" },
  { id: "mint", label: "מנטה", bg: "#C3F0DC", ink: "#0E5A46", solid: "#86D8B4" },
  { id: "teal", label: "טורקיז", bg: "#A8E6E0", ink: "#0C4E52", solid: "#6FCFC6" },
  { id: "sky", label: "תכלת", bg: "#B9E2FB", ink: "#1A4E72", solid: "#7EC8F5" },
  { id: "blue", label: "כחול", bg: "#C5D4FF", ink: "#2A3A86", solid: "#9AAFF6" },
  { id: "lilac", label: "לילך", bg: "#E4D4FB", ink: "#532A78", solid: "#C9A8F0" },
  { id: "purple", label: "סגול", bg: "#D7C4F5", ink: "#432468", solid: "#B794E8" },
]

export function colorById(id: TaskColorId): TaskColor {
  return TASK_COLORS.find((color) => color.id === id) ?? TASK_COLORS[4]
}

export function isTaskColor(value: string): value is TaskColorId {
  return TASK_COLORS.some((color) => color.id === value)
}
