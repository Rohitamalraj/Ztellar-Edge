"use client"

import React from "react"

interface TradingLayoutProps {
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel: React.ReactNode
  bottomPanel: React.ReactNode
}

export function TradingLayout({ leftPanel, centerPanel, rightPanel, bottomPanel }: TradingLayoutProps) {
  return (
    <div className="w-full max-w-[1920px] mx-auto">
      {/* Desktop: 3-column + bottom (>1024px) */}
      <div className="hidden lg:block p-6">
        <div className="grid grid-cols-[300px_1fr_360px] gap-6 mb-6">
          <div className="h-[calc(100vh-240px)] overflow-hidden">{leftPanel}</div>
          <div className="h-[calc(100vh-240px)] overflow-hidden">{centerPanel}</div>
          <div className="h-[calc(100vh-240px)] overflow-y-auto">{rightPanel}</div>
        </div>
        <div className="h-[260px] overflow-hidden">{bottomPanel}</div>
      </div>

      {/* Tablet: 2-column (768-1024px) */}
      <div className="hidden md:block lg:hidden p-6">
        <div className="grid grid-cols-[300px_1fr] gap-6 mb-6">
          <div className="h-[calc(100vh-240px)] overflow-hidden">{leftPanel}</div>
          <div className="h-[calc(100vh-240px)] overflow-hidden">{centerPanel}</div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="h-[400px] overflow-y-auto">{rightPanel}</div>
          <div className="h-[260px] overflow-hidden">{bottomPanel}</div>
        </div>
      </div>

      {/* Mobile: vertical stack */}
      <div className="md:hidden flex flex-col gap-4 p-4">
        <div className="h-[360px] overflow-hidden">{centerPanel}</div>
        <div className="overflow-y-auto">{rightPanel}</div>
        <div className="h-[360px] overflow-hidden">{leftPanel}</div>
        <div className="h-[300px] overflow-hidden">{bottomPanel}</div>
      </div>
    </div>
  )
}
