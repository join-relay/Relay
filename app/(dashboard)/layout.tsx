import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-60">
        <Header />
        <main className="min-h-[calc(100vh-3.5rem)] p-6 bg-[#DFE8F1]">{children}</main>
      </div>
    </div>
  )
}
