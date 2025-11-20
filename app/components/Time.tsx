// app/compenents/Time.tsx

'use client'

import  { useEffect, useState } from 'react'

export default function Time() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleString('zh-CN'))
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return <span>{time}</span>
}
