'use client';

import { useEffect, useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/api';

interface AcceptFileState {
  file: File;
  name: string;
  size: string;
  progress: number;
  status: 'idle' | 'submitting' | 'success' | 'error';
  errorMessage?: string;
}

export default function CustomerPdfAcceptPage() {
  const router = useRouter();

  // ============ 登录守卫 ============
  const [username, setUsername] = useState('');
  useEffect(() => {
    const token = localStorage.getItem('rag_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setUsername(localStorage.getItem('rag_username') || '');
  }, [router]);

  // ============ 已有的状态 ============
  const [fileState, setFileState] = useState<AcceptFileState | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [remark, setRemark] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============ 新增的聊天状态 ============
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  // 是否已成功上传 PDF（未上传时不允许提问）
  const isUploaded = fileState?.status === 'success';

  // 格式化文件尺寸
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // 校验文件
  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      alert('仅支持接收 PDF 格式文件！');
      return;
    }
    const MAX_SIZE = 20 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      alert('文件大小不能超过 20MB！');
      return;
    }
    setFileState({
      file: selectedFile,
      name: selectedFile.name,
      size: formatFileSize(selectedFile.size),
      progress: 0,
      status: 'idle',
    });
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!fileState) return;

    setFileState((prev) =>
      prev ? { ...prev, status: 'submitting', progress: 0, errorMessage: undefined } : null
    );

    const formData = new FormData();
    formData.append('pdf', fileState.file);
    formData.append('customerName', customerName);
    formData.append('remark', remark);

    const progressInterval = setInterval(() => {
      setFileState((prev) => {
        if (!prev || prev.status !== 'submitting') return prev;
        if (prev.progress >= 90) return prev;
        return { ...prev, progress: Math.min(prev.progress + 15, 90) };
      });
    }, 200);

    try {
      const response = await fetch(`${API_BASE}/api/accept`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) throw new Error('提交失败，请稍后重试');

      setFileState((prev) =>
        prev ? { ...prev, progress: 100, status: 'success' } : null
      );
    } catch (err: unknown) {
      clearInterval(progressInterval);
      setFileState((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              errorMessage: err instanceof Error ? err.message : '网络异常',
            }
          : null
      );
    }
  };

  const handleReset = () => {
    setFileState(null);
    setCustomerName('');
    setRemark('');
    setQuestion('');
    setAnswer('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============ 新增的提问函数（流式接收 AI 回答） ============
  const handleAsk = async () => {
    if (!isUploaded) {
      alert('请先上传 PDF 文件，再进行提问');
      return;
    }
    if (!question.trim()) {
      alert('请先输入问题');
      return;
    }

    setIsAsking(true);
    setAnswer('');

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || '请求失败');
      }

      // 流式读取响应体，逐段追加到回答中
      const reader = res.body!.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
      setAnswer((prev) => prev + decoder.decode());
    } catch (err) {
      setAnswer('❌ ' + (err instanceof Error ? err.message : '网络异常'));
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px', fontFamily: 'sans-serif', color: '#1f1f1f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>PDF 上传测试页面</h1>
        {username && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#595959' }}>👤 {username}</span>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('rag_token');
                localStorage.removeItem('rag_username');
                router.replace('/login');
              }}
              style={{ padding: '6px 14px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              退出登录
            </button>
          </div>
        )}
      </div>

      {/* 客户名称 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>客户名称：</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="请输入客户名称"
          style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
      </div>

      {/* 备注 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>备注：</label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="请输入备注"
          rows={3}
          style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
      </div>

      {/* 文件选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>选择 PDF 文件：</label>
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            display: 'block',
            border: `2px dashed ${isDragging ? '#1677ff' : '#d9d9d9'}`,
            background: isDragging ? '#f0f7ff' : '#fafafa',
            borderRadius: 8,
            padding: '28px 16px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 14, color: '#595959' }}>点击选择，或将 PDF 文件拖拽到此处</div>
          <div style={{ fontSize: 12, color: '#a6a6a6', marginTop: 6 }}>仅支持 .pdf 格式，最大 20MB</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* 文件状态 */}
      {fileState && (
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, fontSize: 13 }}>
          <div>文件名称：{fileState.name}</div>
          <div>文件大小：{fileState.size}</div>
          <div>当前状态：{fileState.status}</div>
          {fileState.status === 'error' && <div style={{ color: 'red' }}>{fileState.errorMessage}</div>}
          {fileState.status === 'success' && <div style={{ color: 'green' }}>上传成功</div>}
        </div>
      )}

      {/* 按钮 */}
      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!fileState || fileState.status === 'submitting' || fileState.status === 'success'}
          style={{ flex: 1, padding: '10px 16px', color: '#fff', background: '#1677ff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {fileState?.status === 'submitting' ? '提交中...' : '提交'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          style={{ padding: '10px 20px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, cursor: 'pointer' }}
        >
          重置
        </button>
      </div>

      {/* 聊天区 */}
      <div style={{ marginTop: 32, padding: 20, border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
        <h3 style={{ marginTop: 0 }}>💬 向 PDF 提问</h3>
        {!isUploaded && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 13, color: '#874d00' }}>
            请先上传 PDF 文件，上传成功后即可提问
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !isAsking) handleAsk(); }}
            disabled={!isUploaded || isAsking}
            placeholder="例如：这份简历的学历是什么？"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, background: isUploaded ? '#fff' : '#f5f5f5' }}
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={!isUploaded || isAsking}
            style={{ padding: '8px 24px', background: !isUploaded || isAsking ? '#bfbfbf' : '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: !isUploaded || isAsking ? 'not-allowed' : 'pointer' }}
          >
            {isAsking ? '生成中...' : '提问'}
          </button>
        </div>

        {(answer || isAsking) && (
          <div style={{ marginTop: 16, padding: 16, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>AI 回答：</div>
            {answer}
            {isAsking && <span style={{ display: 'inline-block', width: 8, height: 16, background: '#1677ff', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s infinite' }} />}
          </div>
        )}
        <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
      </div>
    </div>
  );
}