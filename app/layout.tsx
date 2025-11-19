import './globals.css'
import Time from './components/Time'
import { Noto_Sans_SC} from 'next/font/google'

const notoSansSC = Noto_Sans_SC({ weight: '400', subsets: ['latin'] })

export const metadata = {
  title: 'TamFuYin\'s Personal Web',
  description: '我的个人网页',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={notoSansSC.className}>
        <header style={{ padding: '1rem', backgroundColor: '#f0f0f0' }}>
          当前时间: <Time />
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
