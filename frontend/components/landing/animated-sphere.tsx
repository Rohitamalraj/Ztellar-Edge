"use client"

import { useEffect, useRef } from "react"

export function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.38

      // Outer ring
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(0,0,0,0.08)"
      ctx.lineWidth = 1
      ctx.stroke()

      // Rotating orbit rings
      for (let i = 0; i < 3; i++) {
        const angle = t * 0.3 + (i * Math.PI * 2) / 3
        const rx = r * (0.6 + i * 0.15)
        const ry = r * (0.3 + i * 0.08)

        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(angle)
        ctx.beginPath()
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,0,0,${0.06 - i * 0.015})`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
      }

      // Floating dots
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.2
        const dx = Math.cos(angle) * r * 0.85
        const dy = Math.sin(angle) * r * 0.5
        const size = 2 + Math.sin(t + i) * 1
        ctx.beginPath()
        ctx.arc(cx + dx, cy + dy, size, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(0,0,0,0.15)"
        ctx.fill()
      }

      // Center pulse
      const pulseR = r * 0.1 + Math.sin(t * 1.5) * r * 0.02
      ctx.beginPath()
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(0,0,0,0.08)"
      ctx.fill()

      t += 0.01
      animationId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
