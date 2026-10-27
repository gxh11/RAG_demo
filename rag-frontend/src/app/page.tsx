import Link from 'next/link';

const FEATURES = [
  {
    icon: '📄',
    title: 'PDF 智能解析',
    desc: '支持拖拽上传，自动提取文本、切块并向量化入库，最大 20MB。',
  },
  {
    icon: '💬',
    title: '流式问答',
    desc: '基于文档内容回答问题，答案逐字实时输出，打字机效果。',
  },
  {
    icon: '🔍',
    title: '忠实文档',
    desc: '答案严格基于检索到的文档内容，文档中没有的信息会明确说明。',
  },
  {
    icon: '🔒',
    title: '账号隔离',
    desc: '注册登录后使用，JWT 鉴权保护页面访问安全。',
  },
];

const STEPS = [
  { num: '01', title: '登录 / 注册', desc: '创建账号或登录已有账号' },
  { num: '02', title: '上传 PDF', desc: '选择文档并提交，自动解析向量化' },
  { num: '03', title: '开始提问', desc: '输入问题，AI 基于文档流式作答' },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 font-sans text-[#1f1f1f]">
      {/* Hero */}
      <section
        className="flex flex-col items-center text-center px-6 pt-24 pb-20"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, #e8f1ff 0%, #f7f9fc 60%, #ffffff 100%)',
        }}
      >
        <div className="text-5xl mb-6">📄</div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight max-w-2xl">
          PDF 智能问答
        </h1>
        <p className="mt-6 text-lg text-zinc-600 max-w-xl leading-8">
          上传你的 PDF 文档，向 AI 提问，即刻获得基于文档内容的准确回答。
          <br />
          支持流式输出，答案实时呈现。
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/accept"
            className="h-12 px-8 flex items-center justify-center rounded-full text-white text-base font-medium transition-colors"
            style={{ background: '#1677ff' }}
          >
            开始使用
          </Link>
          <Link
            href="/register"
            className="h-12 px-8 flex items-center justify-center rounded-full text-base font-medium border border-solid border-black/[.08] transition-colors hover:bg-black/[.04]"
          >
            免费注册
          </Link>
        </div>
        <p className="mt-4 text-sm text-zinc-400">已有账号？<Link href="/login" className="text-[#1677ff]">直接登录</Link></p>
      </section>

      {/* Features */}
      <section className="w-full max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-semibold text-center">核心功能</h2>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-solid border-black/[.06] p-6 bg-white transition-shadow hover:shadow-md"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 leading-6">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="w-full" style={{ background: '#f7f9fc' }}>
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-semibold text-center">三步开始</h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="flex flex-col items-center text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ background: '#1677ff' }}
                >
                  {s.num}
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 leading-6">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <Link
              href="/accept"
              className="h-12 px-8 inline-flex items-center justify-center rounded-full text-white text-base font-medium transition-colors"
              style={{ background: '#1677ff' }}
            >
              立即体验
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-sm text-zinc-400">
        PDF 智能问答 · RAG_demo
      </footer>
    </div>
  );
}
