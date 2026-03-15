"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Mail, Video, History, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { SidebarBranding } from "./SidebarBranding"

const navItems = [
  { href: "/briefing", label: "Briefing", icon: LayoutDashboard },
  { href: "/actions", label: "Actions", icon: Mail },
  { href: "/meeting", label: "Meeting", icon: Video },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-[#61707D]/20 bg-white/95 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-center px-4 pt-6 pb-5">
          <SidebarBranding />
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-relay-control px-3 py-2 text-sm font-medium transition-smooth",
                  isActive
                    ? "bg-[#213443] text-white"
                    : "text-[#3F5363] hover:bg-[#e8edf3] hover:text-[#1B2E3B]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
