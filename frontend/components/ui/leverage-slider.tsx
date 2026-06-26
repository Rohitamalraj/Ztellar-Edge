"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"

interface LeverageSliderProps {
  value: number
  onChange: (value: number) => void
  max: number
  tierCap: number
}

const leverageMarks = [1, 2, 5, 10]

export function LeverageSlider({ value, onChange, max, tierCap }: LeverageSliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)

  const clampedMax = Math.min(max, 10)
  const clampedValue = Math.min(value, clampedMax)
  const percentage = (clampedValue / clampedMax) * 100
  const displayMarks = Array.from(new Set([...leverageMarks, clampedMax])).sort((a, b) => a - b)

  const isWithinTierCap = clampedValue <= tierCap
  const gradientColor = isWithinTierCap ? "from-green-500 to-green-600" : "from-red-500 to-red-600"

  const updateValue = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return
      const rect = sliderRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const newPercentage = (x / rect.width) * 100
      const newValue = (newPercentage / 100) * clampedMax
      onChange(Math.max(1, Math.min(newValue, clampedMax)))
    },
    [clampedMax, onChange],
  )

  const snapToNearestMark = useCallback(() => {
    const available = displayMarks.filter((m) => m <= clampedMax)
    const nearest = available.reduce((prev, curr) =>
      Math.abs(curr - clampedValue) < Math.abs(prev - clampedValue) ? curr : prev,
    )
    onChange(nearest)
  }, [clampedMax, clampedValue, displayMarks, onChange])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    updateValue(e.clientX)
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => updateValue(e.clientX)
    const handleMouseUp = () => { setIsDragging(false); snapToNearestMark() }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, snapToNearestMark, updateValue])

  return (
    <div className="space-y-2">
      <div
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        className="relative h-2 bg-muted rounded-full cursor-pointer"
      >
        <div
          className={`absolute left-0 top-0 h-full bg-gradient-to-r ${gradientColor} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 ${
            isWithinTierCap ? "border-green-500" : "border-red-500"
          } rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-all`}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>

      <div className="relative flex justify-between px-1">
        {displayMarks.map((mark) => {
          const isDisabled = mark > clampedMax
          const isActive = Math.abs(clampedValue - mark) < 0.5
          return (
            <button
              key={`mark-${mark}`}
              onClick={() => { if (mark <= clampedMax) onChange(mark) }}
              disabled={isDisabled}
              className={`text-xs font-mono transition-all ${
                isActive
                  ? "text-primary font-semibold scale-110"
                  : isDisabled
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mark}x
            </button>
          )
        })}
      </div>

      {!isWithinTierCap && (
        <p className="text-xs text-red-500">Leverage exceeds your tier limit of {tierCap}x</p>
      )}
    </div>
  )
}
