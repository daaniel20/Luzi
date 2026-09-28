import type { TaskType } from "@/lib/types"

const LEGACY_DEFAULT_IDS = [
  "wake",
  "breakfast",
  "dress",
  "teeth",
  "school",
  "read",
  "homework",
  "math",
  "music",
  "draw",
  "play",
  "screen",
  "friends",
  "park",
  "lego",
  "lunch",
  "snack",
  "dinner",
  "shower",
  "sleep",
]

export const DEFAULT_TASK_TYPES: TaskType[] = [
  { id: "screen-tv", name: "זמן מסך - טלוויזיה", emoji: "📺", color: "rose" },
  { id: "screen-tablet", name: "זמן מסך - טאבלט", emoji: "💻", color: "sky" },
  { id: "screen-sony", name: "זמן מסך - סוני", emoji: "🎮", color: "lilac" },
  { id: "podcast", name: "פודקאסט", emoji: "🎙️", color: "purple" },
  { id: "bike", name: "רכיבה באופניים", emoji: "🚴", color: "green" },
  { id: "bed", name: "לסדר את המיטה", emoji: "🛏️", color: "mint" },
  { id: "wake", name: "התעוררות", emoji: "☀️", color: "orange" },
  { id: "breakfast", name: "ארוחת בוקר", emoji: "🥣", color: "orange" },
  { id: "teeth", name: "שיניים", emoji: "🦷", color: "peach" },
  { id: "school", name: "בית ספר", emoji: "🏫", color: "green" },
  { id: "read", name: "קריאה", emoji: "📖", color: "green" },
  { id: "homework", name: "שיעורי בית", emoji: "✏️", color: "green" },
  { id: "draw", name: "ציור", emoji: "🎨", color: "rose" },
  { id: "play", name: "משחק", emoji: "⚽", color: "pink" },
  { id: "friends", name: "חברים", emoji: "🤝", color: "pink" },
  { id: "park", name: "פארק", emoji: "🌳", color: "mint" },
  { id: "lego", name: "לגו", emoji: "🧱", color: "pink" },
  { id: "lunch", name: "צהריים", emoji: "🍽️", color: "orange" },
  { id: "snack", name: "חטיף", emoji: "🍎", color: "peach" },
  { id: "dinner", name: "ארוחת ערב", emoji: "🍲", color: "orange" },
  { id: "shower", name: "מקלחת", emoji: "🚿", color: "orange" },
  { id: "sleep", name: "שינה", emoji: "🌙", color: "mint" },
]

export function withCurrentDefaults(types: TaskType[]): TaskType[] {
  const legacy = new Set(LEGACY_DEFAULT_IDS)
  const untouched =
    types.length === LEGACY_DEFAULT_IDS.length && types.every((type) => legacy.has(type.id))
  return untouched ? DEFAULT_TASK_TYPES : types
}
