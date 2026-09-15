import {
  BarChart3,
  Bot,
  Car,
  CheckSquare,
  HeartPulse,
  Landmark,
  Scale,
  Sparkles,
  Stethoscope,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface CatalogApp {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  testid: string;
}

export interface Industry {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  apps: CatalogApp[];
}

export const INDUSTRIES: Industry[] = [
  {
    id: "automotive",
    name: "自動車",
    description: "販売・在庫・営業支援向けのアプリです。",
    icon: Car,
    apps: [
      {
        href: "/analysis",
        title: "データ分析",
        description:
          "売上 Excel を取り込み、合計行を除いて sales_data へ格納します。",
        icon: BarChart3,
        testid: "nav-analysis",
      },
      {
        href: "/chat",
        title: "営業チャットボット",
        description:
          "OpenAI を使った対話型チャット。API キー未設定時はモック応答で動作確認できます。",
        icon: Bot,
        testid: "nav-chat",
      },
    ],
  },
  {
    id: "finance",
    name: "金融",
    description: "コンプライアンスと業務自動化向けのアプリです。",
    icon: Landmark,
    apps: [
      {
        href: "/rag",
        title: "条例チャット",
        description:
          "取り込んだ区の条例に質問すると、根拠 PDF と該当箇所つきで回答します。",
        icon: Scale,
        testid: "nav-rag",
      },
      {
        href: "/rag/admin",
        title: "条例管理",
        description: "条例 PDF をアップロードし、ベクトル・キーワード・参照グラフへ取り込みます。",
        icon: Landmark,
        testid: "nav-rag-admin",
      },
      {
        href: "/ai-samples",
        title: "AI サンプル",
        description:
          "Google ADK を使った AI ワークフロー / エージェントの 2 つの実装パターン。",
        icon: Sparkles,
        testid: "nav-ai-samples",
      },
    ],
  },
  {
    id: "healthcare",
    name: "ヘルスケア",
    description: "健康・医療周辺の対話アプリです。",
    icon: Stethoscope,
    apps: [
      {
        href: "/health-voice",
        title: "健康アシスタント（音声）",
        description:
          "OpenAI Realtime による音声健康アシスタント。WebRTC で低遅延に会話できます。",
        icon: HeartPulse,
        testid: "nav-health-voice",
      },
    ],
  },
  {
    id: "common",
    name: "共通",
    description: "業界を問わず使える社内向けアプリです。",
    icon: CheckSquare,
    apps: [
      {
        href: "/todo",
        title: "ToDo 管理",
        description:
          "タスクの追加・編集・完了管理。フィルタや検索もでき、データはブラウザに保存されます。",
        icon: CheckSquare,
        testid: "nav-todo",
      },
      {
        href: "/profile",
        title: "プロフィール",
        description:
          "自己紹介プロフィールページ。職業・趣味・スキルなどを掲載しています。",
        icon: UserCircle,
        testid: "nav-profile",
      },
    ],
  },
];

export function listCatalogApps(): CatalogApp[] {
  return INDUSTRIES.flatMap((industry) => industry.apps);
}
