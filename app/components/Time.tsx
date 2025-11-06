'use client'

import { useEffect, useState } from 'react'

export default function Time() {
  const [time, setTime] = useState('')

  useEffect(() => {
    async function update() {
      try {
        const res = await fetch('/api/time')
        if (!res.ok) throw new Error('请求失败')
        const data = await res.json()
        setTime(data.time)
      } catch (e) {
        console.error(e)
        setTime('获取时间失败')
      }
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return <span>{time}</span>
}
