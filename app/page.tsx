import Link from "next/link";
import {
  BarChart3,
  Bot,
  CheckSquare,
  HeartPulse,
  Scale,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  testid: string;
}

const FEATURES: Feature[] = [
  {
    href: "/todo",
    title: "ToDo 管理",
    description:
      "タスクの追加・編集・完了管理。フィルタや検索もでき、データはブラウザに保存されます。",
    icon: CheckSquare,
    testid: "nav-todo",
  },
  {
    href: "/analysis",
    title: "データ分析",
    description:
      "売上 Excel を取り込み、合計行を除いて sales_data へ格納します。",
    icon: BarChart3,
    testid: "nav-analysis",
  },
  {
    href: "/health-voice",
    title: "健康アシスタント（音声）",
    description:
      "OpenAI Realtime による音声健康アシスタント。WebRTC で低遅延に会話できます。",
    icon: HeartPulse,
    testid: "nav-health-voice",
  },
  {
    href: "/chat",
    title: "チャットボット",
    description:
      "OpenAI を使った対話型チャット。API キー未設定時はモック応答で動作確認できます。",
    icon: Bot,
    testid: "nav-chat",
  },
  {
    href: "/rag",
    title: "法令 RAG",
    description:
      "架空の規程を条単位で検索し、参照・準用を辿って根拠付きで回答します。AWS 本番前提の制度確認用です。",
    icon: Scale,
    testid: "nav-rag",
  },
  {
    href: "/ai-samples",
    title: "AI サンプル",
    description:
      "Google ADK を使った AI ワークフロー / エージェントの 2 つの実装パターン。",
    icon: Sparkles,
    testid: "nav-ai-samples",
  },
  {
    href: "/profile",
    title: "プロフィール",
    description:
      "自己紹介プロフィールページ。職業・趣味・スキルなどを掲載しています。",
    icon: UserCircle,
    testid: "nav-profile",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#ececec]">
      <section className="bg-gradient-to-b from-[#bc0017] via-[#d30a1a] to-[#a80014] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:py-20">
          <p className="text-sm font-medium tracking-[0.2em] text-[#f7dda8]">
            Next.js + TypeScript + Tailwind CSS
          </p>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            data-testid="app-title"
          >
            機能一覧
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            利用したい機能を選んでください。
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <div
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="feature-grid"
        >
          {FEATURES.map(({ href, title, description, icon: Icon, testid }) => (
            <Link
              key={href}
              href={href}
              data-testid={testid}
              className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bc0017]"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#bc0017]/10 text-[#bc0017]">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-bold tracking-tight text-[#050505]">
                {title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-[#bc0017]">
                開く
                <span className="ml-1 transition group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
