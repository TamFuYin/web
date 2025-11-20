import './globals.css'
import Time from './components/Time'
import Analytics from './components/Analytics';

export const metadata = {
  title: 'TamFuYin\'s Web',
  description: '我的个人网页',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <Analytics />
      </head>
      <body>
        <header style={{ padding: '1rem', backgroundColor: '#f0f0f0' }}>
          当前时间: <Time />
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
