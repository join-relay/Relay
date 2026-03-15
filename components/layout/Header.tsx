import { getOptionalSession, signOutIfConfigured } from "@/auth"
import { DemoModeIndicator } from "./DemoModeIndicator"

export async function Header() {
  const session = await getOptionalSession()

  async function logout() {
    "use server"

    await signOutIfConfigured({ redirectTo: "/login" })
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-3 border-b border-[#61707D]/15 bg-[#DFE8F1]/80 px-6 backdrop-blur-sm">
      <DemoModeIndicator />
      <div className="flex items-center gap-3 rounded-full border border-[#61707D]/15 bg-white/85 px-2 py-1 shadow-relay-soft">
        <div className="px-2 text-right">
          <p className="text-xs font-medium text-[#1B2E3B]">
            {session?.user?.name ?? session?.user?.email ?? "Relay"}
          </p>
          <p className="text-[11px] text-[#61707D]">
            {session?.user?.email ?? "Authenticated session"}
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-relay-control border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3]"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  )
}
