//app/page.tsx

'use client'

import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  const goToClipboard = () => {
    router.push('/clipboard') // 跳到 /clipboard 页面输入 ID
  }
  const goToMinecraft = () => {
    router.push('/minecraft')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">目录页</h1>
      <button
        onClick={goToClipboard}
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
      >
        进入云剪贴板
      </button>
      <button
        onClick={goToMinecraft}
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
      >
        play Minecraft😎
      </button>
    </div>
  )
}
