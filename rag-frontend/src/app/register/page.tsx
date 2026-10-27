'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';

// 密码强度：0 弱 / 1 中 / 2 强
function getPasswordStrength(pw: string): { level: 0 | 1 | 2; label: string } {
  if (pw.length < 6) return { level: 0, label: '弱' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (score >= 3) return { level: 2, label: '强' };
  if (score >= 1) return { level: 1, label: '中' };
  return { level: 0, label: '弱' };
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

  const handleSubmit = async () => {
    const name = username.trim();
    if (name.length < 2) {
      setError('用户名至少 2 个字符');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 个字符');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '注册失败');

      // 注册成功即自动登录，跳转到 PDF 上传页
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
      <p style={{ textAlign: 'center', color: '#8c8c8c', fontSize: 14, marginTop: 4 }}>注册新账号</p>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>用户名：</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="至少 2 个字符"
          style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>密码：</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
          style={{ width: '100%', padding: '10px 12px', boxSizing: 'border-box', border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
        {password && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  width: strength.level === 0 ? '33%' : strength.level === 1 ? '66%' : '100%',
                  height: '100%',
                  background: strength.level === 0 ? '#ff4d4f' : strength.level === 1 ? '#faad14' : '#52c41a',
                }}
              />
            </div>
            <span style={{ color: strength.level === 0 ? '#ff4d4f' : strength.level === 1 ? '#faad14' : '#52c41a' }}>
              密码强度：{strength.label}
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>确认密码：</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="请再次输入密码"
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
        {loading ? '注册中...' : '注册并登录'}
      </button>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: '#8c8c8c' }}>
        已有账号？
        <button
          type="button"
          onClick={() => router.push('/login')}
          style={{ color: '#1677ff', marginLeft: 6, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 13 }}
        >
          去登录
        </button>
      </div>
    </div>
  );
}
