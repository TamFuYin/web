// app/api/time/route.ts
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ time: new Date().toLocaleString('zh-CN') })
}
