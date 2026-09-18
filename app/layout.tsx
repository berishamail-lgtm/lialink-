import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'
import { EduProvider } from './components/EduContext'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'LIAlink',
  description: 'Plattformen som kopplar ihop YH-studenter med företag som tar emot LIA.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv" className={`${syne.variable} ${dmSans.variable}`}>
            <body><EduProvider>{children}</EduProvider></body>
    </html>
  )
}