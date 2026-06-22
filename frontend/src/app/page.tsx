import Link from 'next/link';
import AuthWorkbench from '@/components/AuthWorkbench';

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e3a8a,_#020617_55%)] text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:px-10">
        <section className="max-w-3xl flex-1">
          <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200">
            Chapter 6 Ready
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-tight md:text-6xl">
            让多智能体、RAG、权限和计费真的开始干活
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200/80">
            我把第 6 章里最容易停留在 PPT 的东西，尽量往可运行代码上推了一步。现在你可以先登录、自动拿到个人工作空间，再进控制台看多智能体、知识库和套餐配额一起上班。
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-200/80">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Multi-Agent
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Code Interpreter
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              RAG Workspace
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              RBAC + Billing
            </span>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              直接去控制台
            </Link>
            <a
              href="https://github.com/you-want/ai-data-analyzer"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              看项目仓库
            </a>
          </div>
        </section>

        <section className="w-full max-w-xl">
          <AuthWorkbench />
        </section>
      </main>
    </div>
  );
}
