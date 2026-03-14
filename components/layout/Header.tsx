"use client"

import { DemoModeIndicator } from "./DemoModeIndicator"

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end bg-[#DFE8F1]/80 backdrop-blur-sm border-b border-[#61707D]/15 px-6">
      <DemoModeIndicator />
    </header>
  )
}
