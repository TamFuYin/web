'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function HomePage() {
  const router = useRouter()
  const [id, setId] = useState('')

  const go = () => {
    if (!id.trim()) return alert('请输入剪贴板ID')
    router.push(`/clipboard/${id}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-6 rounded-2xl shadow-md w-80">
        <h1 className="text-2xl font-semibold mb-4 text-center">
          云剪贴板
        </h1>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="输入剪贴板ID"
          className="border rounded w-full p-2 mb-3"
        />
        <button
          onClick={go}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          进入
        </button>
        <p className="text-gray-500 text-sm text-center mt-3">
          例如：<code>abc</code> → 跳转到 /clipboard/abc
        </p>
      </div>
    </div>
  )
}
