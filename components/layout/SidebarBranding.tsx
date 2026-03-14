"use client"

import Link from "next/link"
import Image from "next/image"

const LOGO_HORIZONTAL_SRC = "/relay-logo-horizontal-cropped.png"

export function SidebarBranding() {
  return (
    <Link
      href="/"
      className="mx-auto flex w-full items-center justify-center rounded-relay-control focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2E3B]/20 focus-visible:ring-offset-2"
    >
      <div className="relative h-[62px] w-[204px] max-w-full">
        <Image
          src={LOGO_HORIZONTAL_SRC}
          alt="Relay"
          fill
          className="object-contain object-center"
          priority
          sizes="204px"
        />
      </div>
    </Link>
  )
}
