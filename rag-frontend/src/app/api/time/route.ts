// src/app/api/time/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date();

  return NextResponse.json({
    timestamp: now.getTime(),
    iso: now.toISOString(),
    utc: now.toUTCString(),
    local: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  });
}