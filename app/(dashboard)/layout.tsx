import { redirect } from "next/navigation"
import { getOptionalSession } from "@/auth"
import { getRelayCustomizationSettings } from "@/lib/persistence/user-preferences"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { LiveInboxNotifier } from "@/components/layout/LiveInboxNotifier"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getOptionalSession()

  if (!session?.user?.email) {
    redirect("/login")
  }

  const customization = await getRelayCustomizationSettings(session.user.email)

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-60">
        <Header />
        <LiveInboxNotifier
          userEmail={session.user.email}
          preferences={{
            enableBrowserNotifications: customization.enableBrowserNotifications,
            enableNotificationSound: customization.enableNotificationSound,
          }}
        />
        <main className="min-h-[calc(100vh-3.5rem)] p-6 bg-[#DFE8F1]">{children}</main>
      </div>
    </div>
  )
}
