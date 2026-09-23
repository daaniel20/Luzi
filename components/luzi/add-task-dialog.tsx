"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { TASK_COLORS, colorById } from "@/lib/colors"
import { EMOJI_GROUPS } from "@/lib/emojis"
import type { TaskColorId } from "@/lib/types"
import { cn } from "cn"

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (task: { name: string; emoji: string; color: TaskColorId }) => void
}

function hintFor(color: TaskColorId) {
  if (color === "green" || color === "mint") return "מתאים ללמידה"
  if (color === "pink" || color === "rose") return "מתאים לפנאי"
  return "מתאים לשגרה"
}

export function AddTaskDialog({ open, onOpenChange, onCreate }: AddTaskDialogProps) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("⭐")
  const [color, setColor] = useState<TaskColorId>("green")
  const [category, setCategory] = useState(EMOJI_GROUPS[0].id)
  const [query, setQuery] = useState("")
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName("")
      setEmoji("⭐")
      setColor("green")
      setCategory(EMOJI_GROUPS[0].id)
      setQuery("")
    }
  }

  const visibleGroups = useMemo(() => {
    const q = query.trim()
    if (!q) return EMOJI_GROUPS.filter((group) => group.id === category)
    return EMOJI_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.keywords.includes(q) || item.emoji.includes(q)
      ),
    })).filter((group) => group.items.length > 0)
  }, [category, query])

  const palette = colorById(color)
  const trimmed = name.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[min(760px,calc(100dvh-1.5rem))] flex-col gap-4 overflow-hidden rounded-[28px] p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">משימה חדשה</DialogTitle>
          <DialogDescription className="text-base">
            בוחרים שם, צבע ואימוג׳י. אחר כך גוררים אותה אל הלוח.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!trimmed) return
            onCreate({ name: trimmed, emoji, color })
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-[22px] text-4xl"
              style={{ background: palette.bg }}
              aria-hidden
            >
              {emoji}
            </div>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-bold">
              שם המשימה
              <Input
                value={name}
                maxLength={16}
                placeholder="לדוגמה: רכיבה"
                onChange={(event) => setName(event.target.value)}
                className="h-12 rounded-2xl px-4 text-lg"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">
              צבע · {palette.label} · {hintFor(color)}
            </p>
            <div className="flex flex-wrap gap-2">
              {TASK_COLORS.map((item) => {
                const selected = item.id === color
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={selected}
                    onClick={() => setColor(item.id)}
                    className={cn(
                      "size-12 rounded-full ring-offset-2 transition active:scale-95 sm:size-14",
                      selected && "ring-4 ring-[#3c4d5e]"
                    )}
                    style={{ background: item.solid }}
                  />
                )
              })}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <label className="text-sm font-bold" htmlFor="emoji-search">
              אימוג׳י
            </label>
            <Input
              id="emoji-search"
              value={query}
              placeholder="חיפוש: כדור, ספר, שינה..."
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 rounded-2xl px-4 text-base"
            />
            {query.trim() === "" && (
              <div className="luzi-scroll flex gap-2 overflow-x-auto pb-1">
                {EMOJI_GROUPS.map((group) => {
                  const selected = group.id === category
                  return (
                    <button
                      key={group.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCategory(group.id)}
                      className={cn(
                        "h-10 shrink-0 rounded-full px-4 text-sm font-bold",
                        selected
                          ? "bg-[#6bcf86] text-[#12351f]"
                          : "bg-[#eef4f8] text-[#4d6274]"
                      )}
                    >
                      {group.label}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="luzi-scroll min-h-[180px] flex-1 overflow-y-auto pe-1">
              {visibleGroups.length === 0 && (
                <p className="py-8 text-center text-base text-[#6d7e8e]">
                  לא מצאנו אימוג׳י כזה. נסו מילה אחרת.
                </p>
              )}
              {visibleGroups.map((group) => (
                <div key={group.id} className="mb-3">
                  {query.trim() !== "" && (
                    <p className="mb-2 text-sm font-bold text-[#6d7e8e]">{group.label}</p>
                  )}
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                    {group.items.map((item) => {
                      const selected = item.emoji === emoji
                      return (
                        <button
                          key={item.emoji}
                          type="button"
                          aria-label={item.keywords}
                          aria-pressed={selected}
                          onClick={() => setEmoji(item.emoji)}
                          className={cn(
                            "flex size-12 items-center justify-center rounded-2xl bg-[#f4f8fb] text-2xl transition active:scale-95 sm:size-12",
                            selected && "bg-[#d9f6e4] ring-4 ring-[#6bcf86]"
                          )}
                        >
                          {item.emoji}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-row justify-stretch gap-2 border-0 bg-transparent p-0 sm:justify-start">
            <Button
              type="submit"
              disabled={!trimmed}
              className="h-12 flex-1 rounded-2xl text-base font-bold sm:flex-none sm:px-8"
            >
              הוספה לבנק
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl text-base font-bold sm:flex-none sm:px-6"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
