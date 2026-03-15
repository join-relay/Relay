import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { QueryProvider } from "@/components/providers/QueryProvider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Relay",
  description: "AI chief-of-staff for overload moments",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
