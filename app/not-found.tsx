import Link from 'next/link'

export default function NotFound() {
  return (
    <html>
      <body className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-gray-800">
        <h2 className="text-4xl font-bold mb-4">404 - 页面未找到</h2>
        <p className="mb-8">木有找到此页面</p>
        <Link href="/">
          <button className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 transition duration-150">
            返回主页
          </button>
        </Link>
      </body>
    </html>
  )
}