'use client';

import { useEffect, useState } from 'react';

interface TimeData {
  timestamp: number;
  iso: string;
  utc: string;
  local: string;
}

export default function UploadPage() {
  const [timeData, setTimeData] = useState<TimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);   // ✅ 新增

  useEffect(() => {
    // 用 AbortController 给每次请求加 3 秒超时，避免无限挂起
    const controller = new AbortController();

    const fetchTime = async () => {
      try {
        const res = await fetch('/api/time', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const data: TimeData = await res.json();
        setTimeData(data);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('获取时间出错:', err);
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);   // 无论成功失败都退出 loading
      }
    };

    fetchTime();
    const timer = setInterval(fetchTime, 1000);

    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>当前系统时间（来自 /api/time）</h1>

      {/* ✅ 只有真正还没有任何数据时才显示 loading */}
      {loading && !timeData && !error && <p>正在请求服务器时间...</p>}

      {/* ✅ 出错时把状态码/原因直接显示出来，方便定位 */}
      {error && (
        <p style={{ color: 'red' }}>
          请求 /api/time 失败：{error}
        </p>
      )}

      {timeData && (
        <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.8 }}>
          <li>本地时间（local）：{timeData.local}</li>
          <li>ISO 格式（iso）：{timeData.iso}</li>
          <li>UTC 时间（utc）：{timeData.utc}</li>
          <li>时间戳（timestamp）：{timeData.timestamp}</li>
        </ul>
      )}
    </div>
  );
}