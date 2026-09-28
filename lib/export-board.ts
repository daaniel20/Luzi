import { formatClock, formatRange, slotLabel } from "@/lib/time"

export type ExportTask = {
  name: string
  emoji: string
  bg: string
  ink: string
  start: number
  end: number
  done: boolean
}

const SLOT_H = 36
const WIDTH = 900

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

export async function renderSchedulePng(input: {
  dateLabel: string
  rangeStart: number
  rangeEnd: number
  slot: number
  tasks: ExportTask[]
}): Promise<Blob> {
  const { rangeStart, rangeEnd, slot, tasks } = input
  const slots = Math.max(1, Math.round((rangeEnd - rangeStart) / slot))
  const header = 108
  const height = header + slots * SLOT_H + 28
  const scale = WIDTH * height > 4_000_000 ? 1 : 2
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(WIDTH * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas")
  ctx.scale(scale, scale)
  ctx.fillStyle = "#f4f9fc"
  ctx.fillRect(0, 0, WIDTH, height)

  await document.fonts.load("700 36px Rubik")
  ctx.fillStyle = "#355067"
  ctx.font = "700 36px Rubik"
  ctx.direction = "rtl"
  ctx.textAlign = "right"
  ctx.textBaseline = "top"
  ctx.fillText("LUZI", WIDTH - 28, 22)

  ctx.fillStyle = "#5d7386"
  ctx.font = "600 18px Rubik"
  ctx.fillText(
    `${input.dateLabel}   ·   ${formatRange(rangeStart, rangeEnd)}   ·   ${slotLabel(slot)}`,
    WIDTH - 28,
    66
  )

  const boardTop = header
  for (let index = 0; index <= slots; index += 1) {
    const minute = rangeStart + index * slot
    const y = boardTop + index * SLOT_H
    ctx.strokeStyle = minute % 60 === 0 ? "#b7cddd" : "#e3eef5"
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.lineTo(WIDTH - 24, y)
    ctx.stroke()
    if (minute % 60 === 0 || minute === rangeStart || minute === rangeEnd) {
      ctx.fillStyle = "#5d7386"
      ctx.font = "700 16px Rubik"
      ctx.direction = "ltr"
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(formatClock(minute), 28, y)
    }
  }

  for (const task of tasks) {
    const top = boardTop + ((task.start - rangeStart) / slot) * SLOT_H + 4
    const barHeight = Math.max(((task.end - task.start) / slot) * SLOT_H - 8, 28)
    roundRect(ctx, 108, top, WIDTH - 140, barHeight, 16)
    ctx.fillStyle = task.bg
    ctx.fill()

    if (task.done) {
      ctx.beginPath()
      ctx.arc(136, top + barHeight / 2, 14, 0, Math.PI * 2)
      ctx.fillStyle = "#1f6b45"
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.font = "700 18px Rubik"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("✓", 136, top + barHeight / 2 + 1)
    }

    ctx.font = "32px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(task.emoji, WIDTH / 2 - 70, top + barHeight / 2)

    ctx.fillStyle = task.ink
    ctx.font = "700 22px Rubik"
    ctx.direction = "rtl"
    ctx.fillText(task.name, WIDTH / 2 + 24, top + barHeight / 2 - (barHeight > 56 ? 10 : 0))
    if (barHeight > 56) {
      ctx.font = "600 16px Rubik"
      ctx.globalAlpha = 0.8
      ctx.direction = "ltr"
      ctx.fillText(formatRange(task.start, task.end), WIDTH / 2 + 24, top + barHeight / 2 + 16)
      ctx.globalAlpha = 1
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("png")
  return blob
}
