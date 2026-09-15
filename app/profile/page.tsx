import Link from "next/link";
import {
  ArrowLeft,
  Dumbbell,
  BrainCircuit,
  MapPin,
  Mail,
  Briefcase,
  GraduationCap,
  Sparkles,
  Target,
  Quote,
  type LucideIcon,
} from "lucide-react";

export const metadata = {
  title: "プロフィール | 研修用テンプレート",
  description: "自己紹介プロフィールページ",
};

interface InfoItem {
  icon: LucideIcon;
  label: string;
  value: string;
}

const BASIC_INFO: InfoItem[] = [
  { icon: Briefcase, label: "職業", value: "AI 研修講師" },
  { icon: Dumbbell, label: "趣味", value: "筋トレ" },
  { icon: MapPin, label: "拠点", value: "（後ほど記入）" },
  { icon: Mail, label: "連絡先", value: "（後ほど記入）" },
  { icon: GraduationCap, label: "経歴", value: "（後ほど記入）" },
  { icon: Target, label: "目標", value: "（後ほど記入）" },
];

interface SkillGroup {
  title: string;
  icon: LucideIcon;
  items: string[];
}

const SKILL_GROUPS: SkillGroup[] = [
  {
    title: "専門分野",
    icon: BrainCircuit,
    items: [
      "AI・機械学習の研修",
      "生成 AI 活用",
      "（後ほど記入）",
    ],
  },
  {
    title: "得意なこと",
    icon: Sparkles,
    items: [
      "分かりやすい説明",
      "筋トレによる自己管理",
      "（後ほど記入）",
    ],
  },
];

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a1a3f] via-[#0d2b6b] to-[#08163a] text-white">
      {/* ヘッダーバー */}
      <div className="mx-auto w-full max-w-4xl px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-blue-200/80 transition hover:text-white"
          data-testid="back-home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          トップに戻る
        </Link>
      </div>

      {/* ヒーロー */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-8 pt-10 sm:pt-14">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
          <div className="relative">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-400 to-indigo-600 text-4xl font-bold shadow-[0_16px_40px_rgba(37,99,235,0.5)] ring-1 ring-white/20">
              AI
            </div>
            <span className="absolute -bottom-2 -right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 ring-4 ring-[#0d2b6b]">
              <Dumbbell className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium tracking-[0.25em] text-blue-300">
              PROFILE
            </p>
            <h1
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              data-testid="profile-name"
            >
              （お名前を後ほど記入）
            </h1>
            <p className="mt-2 text-sm text-blue-100/80 sm:text-base">
              AI 研修講師 ／ 筋トレ愛好家
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-white/15">
                #AI研修
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-white/15">
                #筋トレ
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-100 ring-1 ring-white/15">
                #生成AI
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 自己紹介文 */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-4">
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-start gap-3">
            <Quote className="h-6 w-6 shrink-0 text-blue-300" aria-hidden />
            <p className="text-sm leading-relaxed text-blue-50/90">
              AI の研修を仕事にしています。学ぶことと鍛えることが好きで、
              日々の筋トレで培った継続力を仕事にも活かしています。
              （ここに自己紹介文を後ほど記入してください。）
            </p>
          </div>
        </div>
      </section>

      {/* 基本情報 */}
      <section className="mx-auto w-full max-w-4xl px-4 py-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-white">
          基本情報
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BASIC_INFO.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-xs font-medium tracking-wide text-blue-300/80">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* スキル・得意なこと */}
      <section className="mx-auto w-full max-w-4xl px-4 pb-16">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-white">
          スキル ＆ 強み
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SKILL_GROUPS.map(({ title, icon: Icon, items }) => (
            <div
              key={title}
              className="rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.03] p-6 ring-1 ring-white/10"
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/25 text-blue-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-base font-bold text-white">{title}</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-blue-50/90"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
