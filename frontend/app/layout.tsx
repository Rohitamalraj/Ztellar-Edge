import React from "react"
import type { Metadata } from "next"
import { Figtree, Geist_Mono } from "next/font/google"
import { Providers } from "./providers"
import "./globals.css"

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Ztellar Edge — ZK-Verified Synthetic Stock Trading on Stellar",
  description:
    "Prove your tier with zero-knowledge proofs. Trade synthetic stocks with privacy-preserving leverage enforcement on Stellar.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} ${geistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
