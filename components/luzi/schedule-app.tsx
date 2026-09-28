"use client"

import { ChevronDown, ChevronUp, Download, Minus, Pencil, Plus, Trash2 } from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { AddTaskDialog } from "@/components/luzi/add-task-dialog"
import { TaskBlock } from "@/components/luzi/task-block"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { colorById } from "@/lib/colors"
import { renderSchedulePng } from "@/lib/export-board"
import { DEFAULT_TASK_TYPES } from "@/lib/defaults"
import {
  minuteAtY,
  previewDrag,
  zoneAt,
  type DragKind,
  type DragPreview,
} from "@/lib/drag"
import { loadSchedule, saveSchedule } from "@/lib/storage"
import type { ScheduledTask, TaskColorId, TaskType } from "@/lib/types"
import {
  DAY_MINUTES,
  DEFAULT_DURATION,
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  DEFAULT_SLOT,
  SLOT_STEPS,
  clamp,
  formatClock,
  formatRange,
  greetingFor,
  isSlotStep,
  nowMinutes,
  overlaps,
  resolveRange,
  slotLabel,
} from "@/lib/time"
import { cn } from "cn"

type Session = {
  pointerId: number
  kind: DragKind
  typeId: string
  taskId?: string
  originX: number
  originY: number
  x: number
  y: number
  active: boolean
  originStart: number
  originEnd: number
  grabOffset: number
}

type ToastState = {
  message: string
  undo?: () => void
}

function readSlotPx() {
  if (typeof window === "undefined") return 44
  return window.matchMedia("(max-width: 760px)").matches ? 40 : 48
}

const TRACK_PAD = 22

function clockToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return DEFAULT_RANGE_START
  return clamp(hours, 0, 23) * 60 + clamp(minutes, 0, 59)
}

function countLabel(count: number) {
  if (count === 0) return "הלוח עדיין ריק"
  if (count === 1) return "משימה אחת בלוח"
  if (count === 2) return "שתי משימות בלוח"
  return `${count} משימות בלוח`
}

export function ScheduleApp() {
  const [types, setTypes] = useState<TaskType[]>(DEFAULT_TASK_TYPES)
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [slotPx, setSlotPx] = useState(44)
  const [rangeStart, setRangeStart] = useState(DEFAULT_RANGE_START)
  const [rangeEnd, setRangeEnd] = useState(DEFAULT_RANGE_END)
  const [slot, setSlot] = useState(DEFAULT_SLOT)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [draftStart, setDraftStart] = useState("06:30")
  const [draftEnd, setDraftEnd] = useState("06:30")
  const [exporting, setExporting] = useState(false)
  const [canShareImage, setCanShareImage] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const [split, setSplit] = useState(0.5)
  const [drag, setDrag] = useState<DragPreview | null>(null)
  const [editor, setEditor] = useState<TaskType | "new" | null>(null)
  const [deleteType, setDeleteType] = useState<TaskType | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const tasksRef = useRef(tasks)
  const typesRef = useRef(types)
  const orderRef = useRef<string[] | null>(null)
  const slotRef = useRef(slotPx)
  const axisRef = useRef({ rangeStart, rangeEnd, slot })
  const exportRef = useRef<HTMLDivElement>(null)
  const wasCompleteRef = useRef(false)
  const splitRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<Session | null>(null)
  const loopRef = useRef(0)
  const toastTimer = useRef(0)
  const didInitialScroll = useRef(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bankRef = useRef<HTMLElement>(null)
  const bankScrollRef = useRef<HTMLDivElement>(null)
  const trashRef = useRef<HTMLButtonElement>(null)

  const showToast = useCallback((message: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current)
    setToast({ message, undo })
    toastTimer.current = window.setTimeout(() => setToast(null), 4200)
  }, [])

  const stopLoop = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current)
    loopRef.current = 0
  }, [])

  const readMinute = useCallback((clientY: number) => {
    const element = scrollerRef.current
    const axis = axisRef.current
    if (!element) return axis.rangeStart
    return minuteAtY(
      clientY,
      element.getBoundingClientRect(),
      element.scrollTop,
      slotRef.current,
      axis,
      TRACK_PAD
    )
  }, [])

  const buildPreview = useCallback(
    (session: Session) => {
      const timeline = scrollerRef.current
      return previewDrag({
        kind: session.kind,
        typeId: session.typeId,
        taskId: session.taskId,
        x: session.x,
        y: session.y,
        originStart: session.originStart,
        originEnd: session.originEnd,
        grabOffset: session.grabOffset,
        tasks: tasksRef.current,
        zone: zoneAt(session.x, session.y, {
          timeline: timeline?.getBoundingClientRect() ?? null,
          trash: trashRef.current?.getBoundingClientRect() ?? null,
          bank: bankRef.current?.getBoundingClientRect() ?? null,
        }),
        minute: readMinute(session.y),
        ...axisRef.current,
      })
    },
    [readMinute]
  )

  const publish = useCallback(() => {
    const session = sessionRef.current
    const scroller = scrollerRef.current
    if (!session?.active || !scroller) return
    const view = buildPreview(session)
    setDrag((previous) => {
      if (
        previous &&
        previous.kind === view.kind &&
        previous.typeId === view.typeId &&
        previous.taskId === view.taskId &&
        previous.zone === view.zone &&
        previous.start === view.start &&
        previous.end === view.end &&
        previous.valid === view.valid &&
        previous.deleting === view.deleting &&
        Math.abs(previous.x - view.x) < 0.5 &&
        Math.abs(previous.y - view.y) < 0.5
      ) {
        return previous
      }
      return view
    })

    if (session.kind === "create" && orderRef.current) {
      if (view.zone === "bank") {
        const bank = bankScrollRef.current
        if (bank) {
          const bankRect = bank.getBoundingClientRect()
          if (session.y < bankRect.top + 40) bank.scrollTop -= 12
          else if (session.y > bankRect.bottom - 40) bank.scrollTop += 12
          const chips = [...bank.querySelectorAll<HTMLElement>("[data-testid^='chip-']")]
          let target = 0
          let best = Number.POSITIVE_INFINITY
          chips.forEach((chip, index) => {
            const chipRect = chip.getBoundingClientRect()
            const distance = Math.hypot(
              session.x - (chipRect.left + chipRect.width / 2),
              session.y - (chipRect.top + chipRect.height / 2)
            )
            if (distance < best) {
              best = distance
              target = index
            }
          })
          setTypes((previous) => {
            const from = previous.findIndex((type) => type.id === session.typeId)
            if (from < 0 || from === target) return previous
            const next = previous.slice()
            const [item] = next.splice(from, 1)
            next.splice(target, 0, item)
            return next
          })
        }
      } else {
        const ids = orderRef.current
        setTypes((previous) => {
          const byId = new Map(previous.map((type) => [type.id, type]))
          const next = ids.flatMap((id) => {
            const type = byId.get(id)
            return type ? [type] : []
          })
          for (const type of previous) {
            if (!ids.includes(type.id)) next.push(type)
          }
          if (next.length === previous.length && next.every((type, index) => type.id === previous[index]?.id)) {
            return previous
          }
          return next
        })
      }
    }

    const rect = scroller.getBoundingClientRect()
    const nearTimeline = session.x > rect.left - 48 && session.x < rect.right + 48
    if (!nearTimeline) return
    if (session.y < rect.top + 72) scroller.scrollTop -= 18
    else if (session.y > rect.bottom - 72) scroller.scrollTop += 18
  }, [buildPreview])

  const ensureLoop = useCallback(() => {
    if (loopRef.current) return
    const tick = () => {
      publish()
      loopRef.current = requestAnimationFrame(tick)
    }
    loopRef.current = requestAnimationFrame(tick)
  }, [publish])

  const commit = useCallback(
    (session: Session) => {
      const view = buildPreview(session)
      if (session.kind === "create") {
        if (!view.valid) {
          if (view.zone === "timeline") showToast("אופס, השעה הזו תפוסה")
          return
        }
        setTasks((previous) => [
          ...previous,
          {
            id: crypto.randomUUID(),
            typeId: session.typeId,
            start: view.start,
            end: view.end,
            done: false,
          },
        ])
        return
      }

      if (session.kind === "move") {
        if (view.deleting && session.taskId) {
          const current = tasksRef.current.find((task) => task.id === session.taskId)
          if (!current) return
          setTasks((previous) => previous.filter((task) => task.id !== current.id))
          showToast("המשימה ירדה מהלוח", () => {
            setTasks((previous) => {
              if (previous.some((task) => task.id === current.id)) return previous
              if (overlaps(previous, current.start, current.end)) return previous
              return [...previous, current]
            })
          })
          return
        }
        if (view.zone !== "timeline" || !session.taskId) return
        if (!view.valid) {
          showToast("אופס, השעה הזו תפוסה")
          return
        }
        setTasks((previous) =>
          previous.map((task) =>
            task.id === session.taskId
              ? { ...task, start: view.start, end: view.end }
              : task
          )
        )
        return
      }

      if (!session.taskId) return
      setTasks((previous) =>
        previous.map((task) =>
          task.id === session.taskId
            ? { ...task, start: view.start, end: view.end }
            : task
        )
      )
    },
    [buildPreview, showToast]
  )

  const begin = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      kind: DragKind,
      typeId: string,
      task?: ScheduledTask
    ) => {
      if (event.button !== 0 || sessionRef.current) return
      const target = event.target
      if (target instanceof Element && target.closest("[data-no-drag]")) return
      event.preventDefault()

      const session: Session = {
        pointerId: event.pointerId,
        kind,
        typeId,
        taskId: task?.id,
        originX: event.clientX,
        originY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        active: false,
        originStart: task?.start ?? axisRef.current.rangeStart,
        originEnd: task?.end ?? axisRef.current.rangeStart + DEFAULT_DURATION,
        grabOffset: 0,
      }
      sessionRef.current = session

      const onMove = (native: PointerEvent) => {
        if (native.pointerId !== session.pointerId || !sessionRef.current) return
        session.x = native.clientX
        session.y = native.clientY
        if (!session.active) {
          const distance = Math.hypot(native.clientX - session.originX, native.clientY - session.originY)
          const threshold = session.kind.startsWith("resize") ? 3 : 8
          if (distance < threshold) return
          session.active = true
          if (session.kind === "create") {
            orderRef.current = typesRef.current.map((type) => type.id)
          }
          if (session.kind === "move") {
            session.grabOffset = readMinute(native.clientY) - session.originStart
          }
        }
        native.preventDefault()
        ensureLoop()
      }

      const finish = (native: PointerEvent, shouldCommit: boolean) => {
        if (native.pointerId !== session.pointerId) return
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onCancel)
        stopLoop()
        const droppedInBank =
          shouldCommit &&
          session.active &&
          session.kind === "create" &&
          zoneAt(session.x, session.y, {
            timeline: scrollerRef.current?.getBoundingClientRect() ?? null,
            trash: trashRef.current?.getBoundingClientRect() ?? null,
            bank: bankRef.current?.getBoundingClientRect() ?? null,
          }) === "bank"
        if (session.kind === "create" && session.active && !droppedInBank && orderRef.current) {
          const ids = orderRef.current
          setTypes((previous) => {
            const byId = new Map(previous.map((type) => [type.id, type]))
            const next = ids.flatMap((id) => {
              const type = byId.get(id)
              return type ? [type] : []
            })
            for (const type of previous) {
              if (!ids.includes(type.id)) next.push(type)
            }
            return next
          })
        }
        orderRef.current = null
        if (shouldCommit && session.active) commit(session)
        if (sessionRef.current === session) sessionRef.current = null
        setDrag(null)
      }

      const onUp = (native: PointerEvent) => finish(native, true)
      const onCancel = (native: PointerEvent) => finish(native, false)

      window.addEventListener("pointermove", onMove, { passive: false })
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onCancel)
    },
    [commit, ensureLoop, readMinute, stopLoop]
  )

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = loadSchedule()
      setTypes(loaded.types)
      setTasks(loaded.tasks)
      setRangeStart(loaded.rangeStart)
      setRangeEnd(loaded.rangeEnd)
      setSlot(loaded.slot)
      setSplit(loaded.split)
      axisRef.current = {
        rangeStart: loaded.rangeStart,
        rangeEnd: loaded.rangeEnd,
        slot: loaded.slot,
      }
      setHydrated(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    tasksRef.current = tasks
    typesRef.current = types
    slotRef.current = slotPx
    axisRef.current = { rangeStart, rangeEnd, slot }
  }, [tasks, types, slotPx, rangeStart, rangeEnd, slot])

  useEffect(() => {
    const onResize = () => {
      const next = readSlotPx()
      slotRef.current = next
      setSlotPx(next)
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveSchedule({ types, tasks, rangeStart, rangeEnd, slot, split })
  }, [hydrated, tasks, types, rangeStart, rangeEnd, slot, split])

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (didInitialScroll.current || !scrollerRef.current) return
    didInitialScroll.current = true
    const axis = axisRef.current
    const clock = nowMinutes(new Date())
    const absolute = clock >= axis.rangeStart ? clock : clock + DAY_MINUTES
    const anchor = clamp(absolute - 40, axis.rangeStart, Math.max(axis.rangeStart, axis.rangeEnd - 60))
    scrollerRef.current.scrollTop = ((anchor - axis.rangeStart) / axis.slot) * slotRef.current
  }, [slotPx])

  useEffect(() => stopLoop, [stopLoop])

  useEffect(() => {
    try {
      const file = new File([new Uint8Array([1])], "luzi.png", { type: "image/png" })
      setCanShareImage(Boolean(navigator.canShare?.({ files: [file] })))
    } catch {
      setCanShareImage(false)
    }
  }, [])

  const allDone = tasks.length > 0 && tasks.every((task) => task.done === true)

  useEffect(() => {
    if (allDone && !wasCompleteRef.current) setBurstKey((key) => key + 1)
    wasCompleteRef.current = allDone
  }, [allDone])

  const typeMap = useMemo(() => new Map(types.map((type) => [type.id, type])), [types])

  const dateLabel = now
    ? new Intl.DateTimeFormat("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now)
    : ""

  const clockNow = now ? nowMinutes(now) : null
  const absoluteNow =
    clockNow === null
      ? null
      : clockNow >= rangeStart && clockNow <= rangeEnd
        ? clockNow
        : clockNow + DAY_MINUTES <= rangeEnd
          ? clockNow + DAY_MINUTES
          : null
  const slotCount = Math.max(1, Math.round((rangeEnd - rangeStart) / slot))
  const trackHeight = slotCount * slotPx + TRACK_PAD
  const deleting = drag?.deleting === true
  const slotIndex = SLOT_STEPS.indexOf(isSlotStep(slot) ? slot : DEFAULT_SLOT)
  const marks = Array.from({ length: slotCount + 1 }, (_, index) => rangeStart + index * slot).filter(
    (minute) => minute % 60 === 0 || minute === rangeStart || minute === rangeEnd
  )

  function createType(input: { name: string; emoji: string; color: TaskColorId }) {
    setTypes((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: input.name,
        emoji: input.emoji,
        color: input.color,
      },
    ])
    setEditor(null)
    showToast("המשימה נוספה לבנק")
    requestAnimationFrame(() => {
      const scroller = bankScrollRef.current
      if (scroller) scroller.scrollTop = scroller.scrollHeight
    })
  }

  function saveEdit(input: { name: string; emoji: string; color: TaskColorId }) {
    if (!editor || editor === "new") return
    const id = editor.id
    setTypes((previous) =>
      previous.map((type) => (type.id === id ? { ...type, ...input } : type))
    )
    setEditor(null)
    showToast("המשימה עודכנה")
  }

  function confirmDeleteType() {
    if (!deleteType) return
    const id = deleteType.id
    setTypes((previous) => previous.filter((type) => type.id !== id))
    setTasks((previous) => previous.filter((task) => task.typeId !== id))
    setDeleteType(null)
    showToast("הסוג נמחק מהבנק")
  }

  function changeSlot(direction: -1 | 1) {
    const next = SLOT_STEPS[slotIndex + direction]
    if (!next) return
    setSlot(next)
    showToast(slotLabel(next))
  }

  function openRange() {
    setDraftStart(formatClock(rangeStart))
    setDraftEnd(formatClock(rangeEnd))
    setRangeOpen(true)
  }

  function applyRange() {
    const next = resolveRange(clockToMinutes(draftStart), clockToMinutes(draftEnd))
    setRangeStart(next.rangeStart)
    setRangeEnd(next.rangeEnd)
    setRangeOpen(false)
  }

  async function exportImage() {
    const node = exportRef.current
    if (!node || exporting) return
    setExporting(true)
    try {
      const image = await renderSchedulePng({
        dateLabel,
        rangeStart,
        rangeEnd,
        slot,
        tasks: tasks.flatMap((task) => {
          const type = typeMap.get(task.typeId)
          if (!type || task.end <= rangeStart || task.start >= rangeEnd) return []
          const color = colorById(type.color)
          return [
            {
              name: type.name,
              emoji: type.emoji,
              bg: color.bg,
              ink: color.ink,
              start: task.start,
              end: task.end,
              done: task.done === true,
            },
          ]
        }),
      })
      const fileName = `luzi-${new Date().toISOString().slice(0, 10)}.png`
      const file = new File([image], fileName, { type: "image/png" })
      const share = { files: [file], title: "LUZI" }
      if (navigator.canShare?.(share)) {
        try {
          await navigator.share(share)
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return
        }
      }
      const link = document.createElement("a")
      link.href = URL.createObjectURL(image)
      link.download = fileName
      link.click()
      URL.revokeObjectURL(link.href)
    } catch {
      showToast("לא הצלחנו לייצא תמונה")
    } finally {
      setExporting(false)
    }
  }

  const dragType = drag ? typeMap.get(drag.typeId) : undefined

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#c5ebff] to-[#d9f6e4] text-3xl shadow-[0_8px_18px_rgba(120,170,200,0.18)]">
            <span aria-hidden>🌤️</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-[32px] leading-none font-bold tracking-tight text-[#355067]">
              LUZI
            </h1>
            <p className="mt-1 truncate text-sm font-medium text-[#6d7e8e] sm:text-base">
              {now ? `${greetingFor(now)} · ${dateLabel}` : "הלוח היומי שלי"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={exportImage}
            disabled={exporting}
            className="flex h-[72px] items-center gap-1 rounded-[24px] bg-[#d9f6e4] px-4 text-sm font-bold text-[#1f6b45] shadow-[0_8px_18px_rgba(107,207,134,0.2)] active:scale-95 disabled:opacity-60"
          >
            <Download className="size-5" />
            {exporting ? "שומר..." : canShareImage ? "שליחה" : "תמונה"}
          </button>
          <button
            ref={trashRef}
            type="button"
            aria-label="פח אשפה. גוררים לכאן משימה כדי למחוק אותה מהלוח"
            className={cn(
              "flex h-[72px] w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[24px] bg-[#ffe3ec] text-[#7a2944] shadow-[0_8px_18px_rgba(255,143,179,0.22)] transition",
              deleting && drag?.zone === "trash" && "scale-110 bg-[#ff8fb3] ring-4 ring-[#ffd5e2]"
            )}
          >
            <Trash2 className="size-7" />
            <span className="text-sm font-bold">{deleting ? "לשחרר" : "פח"}</span>
          </button>
        </div>
      </header>

      <div ref={splitRef} dir="ltr" className="flex min-h-0 flex-1">

      <section
        ref={bankRef}
        dir="rtl"
        data-testid="task-bank"
        className={cn(
          "flex min-h-0 min-w-0 flex-col rounded-[28px] bg-white/92 px-3 py-2.5 shadow-[0_10px_30px_rgba(90,130,160,0.08)] ring-1 ring-white transition",
          deleting && drag?.zone === "bank" && "bg-[#fff6f8] ring-4 ring-[#ff8fb3]"
        )}
        style={{ width: `${split * 100}%` }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-[#355067]">
            {deleting ? "שחררו כאן כדי להוריד מהלוח" : "בנק המשימות"}
          </h2>
          <button
            type="button"
            onClick={() => setEditor("new")}
            className="inline-flex h-11 items-center gap-1 rounded-2xl bg-primary px-3 text-sm font-bold text-primary-foreground active:scale-95"
          >
            <Plus className="size-4" />
            חדשה
          </button>
        </div>
        <div
          ref={bankScrollRef}
          className="luzi-scroll grid min-h-0 flex-1 content-start gap-2 overflow-y-auto py-1"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
          role="list"
          aria-label="קוביות המשימות"
        >
            {types.map((type) => {
              const color = colorById(type.color)
              const lifted = drag?.kind === "create" && drag.typeId === type.id
              return (
                <div
                  key={type.id}
                  role="listitem"
                  aria-label={type.name}
                  data-testid={`chip-${type.id}`}
                  onPointerDown={(event) => begin(event, "create", type.id)}
                  className={cn(
                    "relative flex h-[104px] w-full cursor-grab touch-none flex-col items-center justify-center gap-1 rounded-[20px] px-2 select-none active:cursor-grabbing",
                    lifted && "scale-95 opacity-45"
                  )}
                  style={{ background: color.bg, color: color.ink }}
                >
                  <button
                    type="button"
                    data-no-drag
                    aria-label={`עריכת ${type.name}`}
                    className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-white/80 text-[#355067]"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setEditor(type)}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    data-no-drag
                    aria-label={`מחיקת ${type.name}`}
                    className="absolute top-1 left-1 flex size-8 items-center justify-center rounded-full bg-white/80 text-lg leading-none font-bold"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setDeleteType(type)}
                  >
                    ×
                  </button>
                  <span className="text-[30px] leading-none" aria-hidden>
                    {type.emoji}
                  </span>
                  <span className="line-clamp-3 w-full text-center text-[15px] leading-5 font-bold">
                    {type.name}
                  </span>
                </div>
              )
            })}
            {types.length === 0 && (
              <button
                type="button"
                onClick={() => setTypes(DEFAULT_TASK_TYPES)}
                className="flex h-[80px] shrink-0 items-center rounded-[20px] bg-[#e7f3fb] px-4 text-sm font-bold text-[#355067]"
              >
                החזרת המשימות המקוריות
              </button>
            )}
        </div>
      </section>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="גרירת השוליים לשינוי הרוחב"
        aria-valuemin={22}
        aria-valuemax={78}
        aria-valuenow={Math.round(split * 100)}
        className="group relative z-20 w-4 shrink-0 cursor-col-resize touch-none"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          const pointerId = event.pointerId
          const move = (native: PointerEvent) => {
            if (native.pointerId !== pointerId) return
            const row = splitRef.current
            if (!row) return
            const rect = row.getBoundingClientRect()
            const ratio = clamp((native.clientX - rect.left) / rect.width, 0.22, 0.78)
            setSplit(ratio)
          }
          const end = (native: PointerEvent) => {
            if (native.pointerId !== pointerId) return
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerup", end)
            window.removeEventListener("pointercancel", end)
          }
          window.addEventListener("pointermove", move)
          window.addEventListener("pointerup", end)
          window.addEventListener("pointercancel", end)
        }}
      >
        <span className="absolute inset-y-6 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-[#b7cddd] group-hover:bg-[#6f97b4]" />
      </div>

      <section dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[28px] bg-white/92 p-3 shadow-[0_10px_30px_rgba(90,130,160,0.08)] ring-1 ring-white sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#355067]">ציר היום</h2>
            <p className="truncate text-sm font-medium text-[#6d7e8e]">
              <span dir="ltr">{formatRange(rangeStart, rangeEnd)}</span>
              {" · "}
              {slotLabel(slot)}
              {" · "}
              {countLabel(tasks.length)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openRange}
              className="h-12 rounded-2xl bg-[#e7f3fb] px-3 text-sm font-bold text-[#355067] active:scale-95"
            >
              טווח שעות
            </button>
            <div className="flex h-12 items-center gap-1 rounded-2xl bg-[#e7f3fb] px-1">
              <button
                type="button"
                aria-label="רזולוציה גסה יותר"
                disabled={slotIndex <= 0}
                onClick={() => changeSlot(-1)}
                className="flex size-10 items-center justify-center rounded-xl text-[#355067] active:scale-95 disabled:opacity-35"
              >
                <Minus className="size-5" />
              </button>
              <span className="min-w-10 text-center text-sm font-bold text-[#355067]">{slot}</span>
              <button
                type="button"
                aria-label="רזולוציה עדינה יותר"
                disabled={slotIndex >= SLOT_STEPS.length - 1}
                onClick={() => changeSlot(1)}
                className="flex size-10 items-center justify-center rounded-xl text-[#355067] active:scale-95 disabled:opacity-35"
              >
                <Plus className="size-5" />
              </button>
            </div>
            <div dir="ltr" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="שעות מוקדמות יותר"
                onClick={() => scrollerRef.current?.scrollBy({ top: -slotPx * 4, behavior: "smooth" })}
                className="flex size-12 items-center justify-center rounded-2xl bg-[#ffc999] text-[#6b3a0c] active:scale-95"
              >
                <ChevronUp className="size-6" />
              </button>
              <button
                type="button"
                aria-label="שעות מאוחרות יותר"
                onClick={() => scrollerRef.current?.scrollBy({ top: slotPx * 4, behavior: "smooth" })}
                className="flex size-12 items-center justify-center rounded-2xl bg-[#ffc999] text-[#6b3a0c] active:scale-95"
              >
                <ChevronDown className="size-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative min-h-[220px] flex-1">
          <div
            ref={scrollerRef}
            data-testid="timeline"
            dir="ltr"
            className={cn(
              "luzi-track luzi-scroll absolute inset-0 overflow-x-hidden overflow-y-auto rounded-[22px] transition-colors duration-500",
              allDone ? "bg-[#d9f6e4]" : "bg-[#f4f9fc]"
            )}
          >
            <div ref={exportRef} className="relative w-full" style={{ height: trackHeight }}>
              {Array.from({ length: slotCount + 1 }, (_, index) => {
                const minute = rangeStart + index * slot
                const major = minute % 60 === 0
                return (
                  <div
                    key={minute}
                    className={cn(
                      "pointer-events-none absolute inset-x-3 h-px",
                      major ? "bg-[#b7cddd]" : "bg-[#e3eef5]"
                    )}
                    style={{ top: TRACK_PAD + index * slotPx }}
                  />
                )
              })}

              {marks.map((minute) => (
                <div
                  key={minute}
                  dir="ltr"
                  className="pointer-events-none absolute start-2 z-10 text-lg font-bold text-[#5d7386] -translate-y-1/2"
                  style={{ top: TRACK_PAD + ((minute - rangeStart) / slot) * slotPx }}
                >
                  {formatClock(minute)}
                </div>
              ))}

              {absoluteNow !== null && (
                <div
                  className="pointer-events-none absolute start-20 end-3 z-20 h-0.5 bg-[#ff8fb3]"
                  style={{ top: TRACK_PAD + ((absoluteNow - rangeStart) / slot) * slotPx }}
                >
                  <span className="absolute -top-3 end-1 rounded-full bg-[#ff8fb3] px-2 py-0.5 text-[11px] font-bold text-white">
                    עכשיו
                  </span>
                </div>
              )}

              {tasks.map((task) => {
                const type = typeMap.get(task.typeId)
                if (!type) return null
                if (task.end <= rangeStart || task.start >= rangeEnd) return null
                const moving = drag?.taskId === task.id && drag.kind !== "create"
                const start = moving ? drag.start : task.start
                const end = moving ? drag.end : task.end
                const mode = moving
                  ? drag.deleting
                    ? "deleting"
                    : drag.valid
                      ? "idle"
                      : "invalid"
                  : "idle"
                return (
                  <TaskBlock
                    key={task.id}
                    name={type.name}
                    emoji={type.emoji}
                    color={colorById(type.color)}
                    start={start}
                    end={end}
                    rangeStart={rangeStart}
                    slot={slot}
                    slotPx={slotPx}
                    pad={TRACK_PAD}
                    done={task.done === true}
                    mode={mode}
                    onToggleDone={() =>
                      setTasks((previous) =>
                        previous.map((item) =>
                          item.id === task.id ? { ...item, done: !item.done } : item
                        )
                      )
                    }
                    onRemove={() => {
                      const current = task
                      setTasks((previous) => previous.filter((item) => item.id !== current.id))
                      showToast("המשימה ירדה מהלוח", () => {
                        setTasks((previous) => {
                          if (previous.some((item) => item.id === current.id)) return previous
                          if (overlaps(previous, current.start, current.end)) return previous
                          return [...previous, current]
                        })
                      })
                    }}
                    active={Boolean(moving)}
                    onPointerDown={(event) => begin(event, "move", type.id, task)}
                    onResizePointerDown={(edge, event) =>
                      begin(event, edge === "start" ? "resize-start" : "resize-end", type.id, task)
                    }
                  />
                )
              })}

              {drag?.kind === "create" && drag.zone === "timeline" && dragType && (
                <TaskBlock
                  name={dragType.name}
                  emoji={dragType.emoji}
                  color={colorById(dragType.color)}
                  start={drag.start}
                  end={drag.end}
                  rangeStart={rangeStart}
                  slot={slot}
                  slotPx={slotPx}
                  pad={TRACK_PAD}
                  mode={drag.valid ? "preview" : "invalid"}
                  active
                />
              )}
            </div>
          </div>

          {allDone && (
            <div
              className="pointer-events-none absolute top-3 right-3 z-30 flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-md"
              role="status"
            >
              <span className="text-3xl leading-none" aria-hidden>
                🏅
              </span>
              <span className="text-base font-bold text-[#1f6b45]">כל הכבוד</span>
            </div>
          )}

          {burstKey > 0 && allDone && (
            <div key={burstKey} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {["12%", "28%", "46%", "63%", "78%", "18%", "55%", "88%"].map((left, index) => (
                <span
                  key={left}
                  className="luzi-star absolute text-3xl"
                  style={{
                    left,
                    bottom: `${18 + (index % 3) * 12}%`,
                    animationDelay: `${index * 0.08}s`,
                  }}
                  aria-hidden
                >
                  {index % 2 === 0 ? "⭐" : "✨"}
                </span>
              ))}
            </div>
          )}

          {tasks.length === 0 && drag?.kind !== "create" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
              <div className="max-w-sm rounded-[24px] bg-white/80 px-5 py-4 shadow-sm">
                <p className="text-lg font-bold text-[#355067]">גררו לכאן משימה מהבנק</p>
                <p className="mt-1 text-sm font-medium text-[#6d7e8e]">
                  היא תיצמד לרזולוציה שבחרתם. מושכים מהקצה העליון או התחתון כדי להאריך, ואל הפח כדי למחוק.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      </div>

      {dragType && drag && (
        <div
          className="pointer-events-none fixed z-[70]"
          style={{
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, calc(-100% - 18px))",
          }}
        >
          <div
            className={cn(
              "flex items-center gap-2 rounded-[22px] px-4 py-3 shadow-[0_16px_32px_rgba(60,80,100,0.18)]",
              drag.deleting && "ring-4 ring-[#ff8fb3]"
            )}
            style={{
              background: colorById(dragType.color).bg,
              color: colorById(dragType.color).ink,
            }}
          >
            <span className="text-3xl leading-none">{dragType.emoji}</span>
            <span>
              <span className="block text-base font-bold">{dragType.name}</span>
              {drag.zone === "timeline" && (
                <span dir="ltr" className="block text-sm font-semibold">
                  {formatClock(drag.start)}–{formatClock(drag.end)}
                </span>
              )}
              {drag.deleting && <span className="block text-sm font-bold">משחררים למחיקה</span>}
              {!drag.valid && drag.zone === "timeline" && (
                <span className="block text-sm font-bold">השעה תפוסה</span>
              )}
            </span>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#355067] px-5 py-3 text-base font-bold text-white shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              className="rounded-full bg-white px-3 py-1 text-sm font-bold text-[#355067]"
              onClick={() => {
                toast.undo?.()
                setToast(null)
              }}
            >
              החזרה
            </button>
          )}
        </div>
      )}

      <AddTaskDialog
        open={editor !== null}
        mode={editor && editor !== "new" ? "edit" : "create"}
        initial={editor && editor !== "new" ? editor : null}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
        onSubmit={(input) => {
          if (editor && editor !== "new") saveEdit(input)
          else createType(input)
        }}
      />

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">אילו שעות להציג?</DialogTitle>
            <DialogDescription className="text-base">
              ברירת המחדל היא מ־06:30 לאורך יממה. אם שעת הסיום מוקדמת או זהה להתחלה, הטווח ממשיך עד למחרת.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold text-[#355067]">
              מהשעה
              <input
                type="time"
                value={draftStart}
                onChange={(event) => setDraftStart(event.target.value)}
                className="mt-1 h-12 w-full rounded-2xl border border-[#d5e4ef] bg-white px-3 text-lg font-bold"
              />
            </label>
            <label className="text-sm font-bold text-[#355067]">
              עד השעה
              <input
                type="time"
                value={draftEnd}
                onChange={(event) => setDraftEnd(event.target.value)}
                className="mt-1 h-12 w-full rounded-2xl border border-[#d5e4ef] bg-white px-3 text-lg font-bold"
              />
            </label>
          </div>
          <DialogFooter className="mx-0 mb-0 flex-row gap-2 border-0 bg-transparent p-0">
            <Button type="button" variant="outline" className="h-12 flex-1 rounded-2xl text-base font-bold" onClick={() => setRangeOpen(false)}>
              ביטול
            </Button>
            <Button type="button" className="h-12 flex-1 rounded-2xl bg-[#355067] text-base font-bold" onClick={applyRange}>
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteType !== null} onOpenChange={(open) => !open && setDeleteType(null)}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              למחוק את {deleteType?.emoji} {deleteType?.name}?
            </DialogTitle>
            <DialogDescription className="text-base">
              הסוג ייעלם מבנק המשימות. אם הוא כבר נמצא על הלוח של היום, הוא יימחק גם משם.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 flex-row gap-2 border-0 bg-transparent p-0">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl text-base font-bold"
              onClick={() => setDeleteType(null)}
            >
              ביטול
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-2xl bg-[#ff8fb3] text-base font-bold text-[#5c2036] hover:bg-[#ff7aa6]"
              onClick={confirmDeleteType}
            >
              מחיקה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
