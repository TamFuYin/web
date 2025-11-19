'use client'
import dynamic from 'next/dynamic'

const MinecraftGame = dynamic(() => import('./client-page'), { ssr: false })

export default function Page() {
  return <MinecraftGame />
}
