'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function ClipboardPage() {
  const { id } = useParams() // 获取 /clipboard/xxx 中的 xxx
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const ref = doc(db, 'clipboards', id as string)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        setText(snap.data().text || '')
      }
      setLoading(false)
    }
    loadData()
  }, [id])

  const save = async () => {
    await setDoc(doc(db, 'clipboards', id as string), { text })
    alert('已保存')
  }

  if (loading) return <p>加载中...</p>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">云剪贴板：{id}</h1>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="w-full h-64 border rounded p-2"
        placeholder="输入内容..."
      />
      <button
        onClick={save}
        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
      >
        保存
      </button>
    </div>
  )
}
