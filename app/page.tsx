import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getOptionalSession } from "@/auth"

export const dynamic = "force-dynamic"

const LOGO_HORIZONTAL_SRC = "/relay-logo-horizontal-cropped.png"

export default async function HomePage() {
  const session = await getOptionalSession()
  if (session?.user?.email) {
    redirect("/briefing")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#DFE8F1] p-6">
      <div className="w-full max-w-[640px] rounded-[28px] border border-[#61707D]/15 bg-white/85 p-8 shadow-[0_30px_80px_rgba(27,46,59,0.14)] backdrop-blur-sm">
        <div className="relative mx-auto h-[56px] w-[180px]">
          <Image
            src={LOGO_HORIZONTAL_SRC}
            alt="Relay"
            fill
            className="object-contain object-left"
            priority
            sizes="180px"
          />
        </div>
        <p className="mt-6 text-center text-lg text-[#3F5363]">
          AI chief-of-staff for overload moments. Sign in with Google to get started.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-relay-control bg-[#213443] px-6 py-3 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B]"
          >
            Sign in with Google
          </Link>
        </div>
        <footer className="mt-10 border-t border-[#61707D]/15 pt-6 text-center text-sm text-[#3F5363]">
          <a
            href="/privacy"
            className="underline hover:text-[#1B2E3B]"
          >
            Privacy Policy
          </a>
          {" · "}
          <a
            href="/terms"
            className="underline hover:text-[#1B2E3B]"
          >
            Terms of Service
          </a>
        </footer>
      </div>
    </main>
  )
}
