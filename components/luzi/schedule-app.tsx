"use client"

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
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
import { DEFAULT_TASK_TYPES } from "@/lib/defaults"
import {
  minuteAt,
  previewDrag,
  zoneAt,
  type DragKind,
  type DragPreview,
} from "@/lib/drag"
import { loadSchedule, saveSchedule } from "@/lib/storage"
import type { ScheduledTask, TaskColorId, TaskType } from "@/lib/types"
import {
  DAY_END,
  DAY_START,
  DEFAULT_DURATION,
  SLOT,
  SLOT_COUNT,
  clamp,
  formatClock,
  greetingFor,
  overlaps,
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

function readSlot() {
  if (typeof window === "undefined") return 68
  return window.matchMedia("(max-width: 760px)").matches ? 54 : 68
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
  const [slotPx, setSlotPx] = useState(readSlot)
  const [drag, setDrag] = useState<DragPreview | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteType, setDeleteType] = useState<TaskType | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const tasksRef = useRef(tasks)
  const slotRef = useRef(slotPx)
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

  const readMinute = useCallback((clientX: number) => {
    const element = scrollerRef.current
    if (!element) return DAY_START
    return minuteAt(
      clientX,
      element.getBoundingClientRect(),
      element.scrollLeft,
      slotRef.current,
      SLOT_COUNT
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
        minute: readMinute(session.x),
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

    const rect = scroller.getBoundingClientRect()
    const nearTimeline = session.y > rect.top - 48 && session.y < rect.bottom + 48
    if (!nearTimeline) return
    if (session.x < rect.left + 72) scroller.scrollLeft -= 16
    else if (session.x > rect.right - 72) scroller.scrollLeft += 16
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
        originStart: task?.start ?? DAY_START,
        originEnd: task?.end ?? DAY_START + DEFAULT_DURATION,
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
          if (session.kind === "move") {
            session.grabOffset = readMinute(native.clientX) - session.originStart
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
      setHydrated(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    tasksRef.current = tasks
    slotRef.current = slotPx
  }, [tasks, slotPx])

  useEffect(() => {
    const onResize = () => {
      const next = readSlot()
      slotRef.current = next
      setSlotPx(next)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveSchedule({ types, tasks })
  }, [hydrated, tasks, types])

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 30000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (didInitialScroll.current || !scrollerRef.current) return
    didInitialScroll.current = true
    const date = new Date()
    const nowMin = date.getHours() * 60 + date.getMinutes()
    const anchor = clamp(nowMin - 30, DAY_START, DAY_END - 60)
    scrollerRef.current.scrollLeft = ((anchor - DAY_START) / SLOT) * slotRef.current
  }, [slotPx])

  useEffect(() => stopLoop, [stopLoop])

  const typeMap = useMemo(() => new Map(types.map((type) => [type.id, type])), [types])

  const dateLabel = now
    ? new Intl.DateTimeFormat("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(now)
    : ""

  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null
  const showNow = nowMin !== null && nowMin >= DAY_START && nowMin <= DAY_END
  const trackWidth = SLOT_COUNT * slotPx
  const deleting = drag?.deleting === true

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
    setAddOpen(false)
    showToast("המשימה נוספה לבנק")
    requestAnimationFrame(() => {
      const scroller = bankScrollRef.current
      if (scroller) scroller.scrollLeft = scroller.scrollWidth
    })
  }

  function confirmDeleteType() {
    if (!deleteType) return
    const id = deleteType.id
    setTypes((previous) => previous.filter((type) => type.id !== id))
    setTasks((previous) => previous.filter((task) => task.typeId !== id))
    setDeleteType(null)
    showToast("הסוג נמחק מהבנק")
  }

  const dragType = drag ? typeMap.get(drag.typeId) : undefined

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
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
      </header>

      <section
        ref={bankRef}
        data-testid="task-bank"
        className={cn(
          "relative shrink-0 rounded-[28px] bg-white/92 px-3 py-2.5 shadow-[0_10px_30px_rgba(90,130,160,0.08)] ring-1 ring-white transition",
          deleting && drag?.zone === "bank" && "bg-[#fff6f8] ring-4 ring-[#ff8fb3]"
        )}
      >
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#355067]">
            {deleting ? "שחררו כאן כדי להוריד מהלוח" : "בנק המשימות"}
          </h2>
          <p className="hidden text-sm font-medium text-[#6d7e8e] sm:block">
            גוררים אל השעות, ומושכים מהקצה כדי לשנות משך
          </p>
        </div>
        <div dir="ltr" className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="גלילה לתחילת הבנק"
            onClick={() => bankScrollRef.current?.scrollBy({ left: -240, behavior: "smooth" })}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f3fb] text-[#3c6480] active:scale-95"
          >
            <ChevronLeft className="size-6" />
          </button>
          <div
            ref={bankScrollRef}
            className="luzi-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto py-1"
            role="list"
            aria-label="קוביות המשימות"
          >
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-[80px] w-[84px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[20px] bg-primary text-sm font-bold text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring active:scale-95"
            >
              <Plus className="size-6" />
              חדשה
            </button>
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
                    "relative flex h-[80px] w-[92px] shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-1 rounded-[20px] px-2 select-none active:cursor-grabbing",
                    lifted && "scale-95 opacity-45"
                  )}
                  style={{ background: color.bg, color: color.ink }}
                >
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
                  <span className="line-clamp-2 w-full text-center text-[13px] leading-4 font-bold">
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
          <button
            type="button"
            aria-label="גלילה להמשך הבנק"
            onClick={() => bankScrollRef.current?.scrollBy({ left: 240, behavior: "smooth" })}
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f3fb] text-[#3c6480] active:scale-95"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      </section>

      <section className="flex min-h-[300px] flex-1 flex-col rounded-[28px] bg-white/92 p-3 shadow-[0_10px_30px_rgba(90,130,160,0.08)] ring-1 ring-white sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#355067]">ציר היום</h2>
            <p className="truncate text-sm font-medium text-[#6d7e8e]">
              <span dir="ltr">07:00–20:00</span>
              {" · "}
              כל משבצת רבע שעה
              {" · "}
              {countLabel(tasks.length)}
            </p>
          </div>
          <div dir="ltr" className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="שעות מוקדמות יותר"
              onClick={() =>
                scrollerRef.current?.scrollBy({
                  left: -slotPx * 4,
                  behavior: "smooth",
                })
              }
              className="flex size-12 items-center justify-center rounded-2xl bg-[#ffc999] text-[#6b3a0c] active:scale-95"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="שעות מאוחרות יותר"
              onClick={() =>
                scrollerRef.current?.scrollBy({
                  left: slotPx * 4,
                  behavior: "smooth",
                })
              }
              className="flex size-12 items-center justify-center rounded-2xl bg-[#ffc999] text-[#6b3a0c] active:scale-95"
            >
              <ChevronRight className="size-6" />
            </button>
          </div>
        </div>

        <div className="relative min-h-[220px] flex-1">
          <div
            ref={scrollerRef}
            data-testid="timeline"
            dir="ltr"
            className="luzi-track luzi-scroll absolute inset-0 overflow-x-auto overflow-y-hidden rounded-[22px] bg-[#f4f9fc]"
          >
            <div className="flex h-full min-h-[210px] items-center" style={{ width: trackWidth }}>
            <div className="relative h-[190px] w-full">
              {Array.from({ length: 14 }, (_, index) => {
                const hour = 7 + index
                const left = index * 4 * slotPx
                const isEnd = hour === 20
                return (
                  <div
                    key={hour}
                    className="absolute top-2 text-sm font-bold text-[#5d7386]"
                    style={{
                      left,
                      transform: isEnd ? "translateX(-100%)" : undefined,
                    }}
                  >
                    {formatClock(hour * 60)}
                  </div>
                )
              })}

              <div className="absolute inset-x-0 top-11 h-[136px] rounded-[20px] bg-white/75" />

              {Array.from({ length: SLOT_COUNT + 1 }, (_, index) => (
                <div
                  key={index}
                  className={cn(
                    "pointer-events-none absolute top-12 bottom-4 w-px",
                    index % 4 === 0 ? "bg-[#b7cddd]" : "bg-[#e3eef5]"
                  )}
                  style={{ left: index * slotPx }}
                />
              ))}

              {showNow && nowMin !== null && (
                <div
                  className="pointer-events-none absolute top-10 bottom-3 z-20 w-0.5 bg-[#ff8fb3]"
                  style={{ left: ((nowMin - DAY_START) / SLOT) * slotPx }}
                >
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[#ff8fb3] px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-white">
                    עכשיו
                  </span>
                </div>
              )}

              {tasks.map((task) => {
                const type = typeMap.get(task.typeId)
                if (!type) return null
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
                    slotPx={slotPx}
                    mode={mode}
                    active={Boolean(moving)}
                    onPointerDown={(event) => begin(event, "move", type.id, task)}
                    onResizePointerDown={(edge, event) =>
                      begin(
                        event,
                        edge === "start" ? "resize-start" : "resize-end",
                        type.id,
                        task
                      )
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
                  slotPx={slotPx}
                  mode={drag.valid ? "preview" : "invalid"}
                  active
                />
              )}
            </div>
            </div>
          </div>

          {tasks.length === 0 && drag?.kind !== "create" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
              <div className="max-w-sm rounded-[24px] bg-white/80 px-5 py-4 shadow-sm">
                <p className="text-lg font-bold text-[#355067]">גררו לכאן משימה מהבנק</p>
                <p className="mt-1 text-sm font-medium text-[#6d7e8e]">
                  היא תיצמד לרבע השעה הקרוב. מושכים מהקצה כדי להאריך, ואל הפח כדי למחוק.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

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

      <AddTaskDialog open={addOpen} onOpenChange={setAddOpen} onCreate={createType} />

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
