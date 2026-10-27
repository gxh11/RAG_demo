'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '请求失败');

      // 保存登录凭证，跳转到 PDF 上传页
      localStorage.setItem('rag_token', data.data.token);
      localStorage.setItem('rag_username', data.data.username);
      router.push('/accept');
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', padding: '32px 24px', fontFamily: 'sans-serif', color: '#1f1f1f' }}>
      <h1 style={{ fontSize: 22, textAlign: 'center' }}>📄 PDF 智能问答</h1>
      <p style={{ textAlign: 'center', color: '#8c8c8c', fontSize: 14, marginTop: 4 }}>
        登录后即可上传 PDF 并提问
      </p>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>用户名：</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
          style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>密码：</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="请输入密码"
          style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
      </div>

      {error && <div style={{ marginTop: 12, color: 'red', fontSize: 13 }}>{error}</div>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        style={{ width: '100%', marginTop: 24, padding: '12px 16px', color: '#fff', background: loading ? '#bfbfbf' : '#1677ff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15 }}
      >
        {loading ? '请稍候...' : '登录'}
      </button>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#8c8c8c' }}>
        还没有账号？
        <button
          type="button"
          onClick={() => router.push('/register')}
          style={{ color: '#1677ff', marginLeft: 6, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 13 }}
        >
          去注册
        </button>
      </div>
    </div>
  );
}
