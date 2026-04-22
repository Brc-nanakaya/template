"use client";

/**
 * ダッシュボード初回ツアー (T18)。
 *
 * react-joyride でダッシュボードの各セクションを順番にガイド。
 * localStorage `trust:tour-seen=true` が無い初回訪問時のみ起動、
 * 完了/スキップ時に `true` を書き込んで次回以降は起動しない。
 *
 * data-testid:
 *   - `tour-btn-skip` … スキップボタン（ヘッダー右上の常時表示）
 *   - `tour-restart-button` … 一度閉じた後に再起動するリンク
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CallBackProps, Step } from "react-joyride";

const STORAGE_KEY = "trust:tour-seen";

// react-joyride は SSR 非対応 (findDOMNode) のため動的 import で ssr:false
const Joyride = dynamic(() => import("react-joyride").then((m) => m.default), {
  ssr: false,
});

export function DashboardTour() {
  const [run, setRun] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setRun(true);
  }, []);

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-testid="dashboard-header"]',
        title: "案件ヘッダー",
        content: "当月の案件名・契約番号・報告基準月が表示されます。右側の「PDFダウンロード」「デモをリセット」ボタンから主要操作にアクセスできます。",
        placement: "bottom" as const,
        disableBeacon: true,
      },
      {
        target: '[data-testid="dashboard-anomaly-banner"]',
        title: "異常値アラート",
        content: "8 ルールで検知した異常値を重要度降順で表示。クリックで該当セクションにスクロールします。",
        placement: "bottom" as const,
      },
      {
        target: '[data-testid="dashboard-kpi-summary"]',
        title: "主要 KPI",
        content: "プール残高・延滞率・累積デフォルト率など 6 指標を前月比つきで一覧表示します。",
        placement: "bottom" as const,
      },
      {
        target: '[data-testid="dashboard-chart-tabs"]',
        title: "時系列グラフ",
        content: "残高推移・延滞推移・CPR/CDR・受益権残高・累積デフォルト率の 5 タブで、24 ヶ月の推移を確認できます。",
        placement: "top" as const,
      },
      {
        target: '[data-testid="dashboard-portfolio-grid"]',
        title: "ポートフォリオ構成",
        content: "金利タイプ・物件種別・都道府県・債務者年齢の 4 切り口で静的特性を確認できます。",
        placement: "top" as const,
      },
      {
        target: '[data-testid="dashboard-trigger-table"]',
        title: "トリガー状況",
        content: "4 トリガーの進捗バーと抵触予測月。閾値の 70% を超えた時点で「警戒」バッジに切り替わります。",
        placement: "top" as const,
      },
      {
        target: '[data-testid="dashboard-loan-accordion"]',
        title: "個別債権ドリルダウン",
        content: "延滞／デフォルト債権の一覧を検索・ソート。行クリックで詳細ページに遷移します。",
        placement: "top" as const,
      },
      {
        target: '[data-testid="dashboard-commentary-section"]',
        title: "AI 所見",
        content: "ボタン 1 つで当月所見を生成、編集して「レポートに反映」でプレビュー画面へ連携します。",
        placement: "top" as const,
      },
    ],
    [],
  );

  const handleCallback = (data: CallBackProps) => {
    const finished = ["finished", "skipped"] as const;
    if ((finished as readonly string[]).includes(data.status)) {
      setRun(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
    }
  };

  const handleRestart = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setRun(true);
  };

  const handleSkip = () => {
    setRun(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  if (!mounted) return null;

  return (
    <>
      {run && (
        <>
          <Joyride
            steps={steps}
            run={run}
            continuous
            showSkipButton
            showProgress
            scrollOffset={80}
            locale={{
              back: "戻る",
              close: "閉じる",
              last: "完了",
              next: "次へ",
              open: "開く",
              skip: "スキップ",
            }}
            styles={{
              options: {
                primaryColor: "#0B2545",
                zIndex: 10_000,
              },
            }}
            callback={handleCallback}
          />
          <button
            type="button"
            data-testid="tour-btn-skip"
            onClick={handleSkip}
            className="fixed bottom-4 right-4 z-[10001] rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-slate-200 hover:bg-slate-50"
          >
            ツアーをスキップ
          </button>
        </>
      )}
      {!run && (
        <button
          type="button"
          data-testid="tour-restart-button"
          onClick={handleRestart}
          className="fixed bottom-4 right-4 z-[9000] rounded-md bg-white px-3 py-1.5 text-xs text-slate-600 opacity-70 shadow-md ring-1 ring-slate-200 transition hover:opacity-100 print:hidden"
          aria-label="ツアーを再表示"
        >
          ツアーを再表示
        </button>
      )}
    </>
  );
}
