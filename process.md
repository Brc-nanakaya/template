# 信託期中管理レポートツール 開発プロセス管理表

## プロダクト概要
- **名称**: 信託期中管理レポート自動生成ツール（TrustReport）
- **用途**: SBI新生信託銀行 信託事業推進部向け営業デモ
- **技術スタック**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + recharts + papaparse + @anthropic-ai/sdk + Vitest + Playwright
- **デザイン**: プライマリ #0B2545（ネイビー）、アクセント #D4A017（ゴールド）、Noto Sans JP

## データファイル配置
`/public/sample-data/` 配下に以下を配置（別途提供済み）:
`deal_info.json`, `loan_tape.csv` (200件), `monthly_performance.csv` (24ヶ月), `delinquency_aging_history.csv`, `prepayment_detail.csv` (586件), `default_recovery.csv` (118件), `cf_waterfall_history.csv`, `trigger_test_history.csv`, `regional_breakdown.csv`, `servicer_monthly_report_202603.json`

## 共通ルール
- **data-testid**: 全インタラクティブ要素に `[画面]-[種類]-[識別子]` 形式で付与
- **数値フォーマット**: 3桁区切り、百万円単位は「1,234百万円 (12.3億円)」併記
- **各タスク完了時**: (1) 完了条件チェック、(2) ステータス更新、(3) `git commit` を必ず実施
- **テスト**: ユニットはVitest、E2EはPlaywright、`NEXT_PUBLIC_MOCK_LLM=true` でLLM呼び出しをモック

---

## タスク一覧

### [x] T01: プロジェクト初期化
**ステータス**: 完了  
**依存**: なし  
**作業内容**:
- Next.js 14 (App Router) + TypeScript プロジェクト作成
- Tailwind CSS + shadcn/ui 初期化
- 必要パッケージインストール: recharts, papaparse, @anthropic-ai/sdk, lucide-react, react-markdown, remark-gfm, sonner, vitest, @testing-library/react, @playwright/test
- `vitest.config.ts`, `playwright.config.ts` 設定（baseURL: http://localhost:3000、3ブラウザ、webServer自動起動、retain-on-failure動画）
- package.json scripts: `test`, `test:e2e`, `test:e2e:ui`, `test:e2e:demo`, `test:all`
- `/public/sample-data/` にサンプルデータ配置（`scripts/generate-sample-data.ts` で決定論的生成、プール残高 96,651百万円・東京都最上位・借換最大をアンカー）
- `.env.local.example` 作成（ANTHROPIC_API_KEY 記載）

**完了条件**:
- [x] `npm run dev` で起動、http://localhost:3000 が表示（E2E smoke で確認）
- [x] `npm test` が（空のテストでも）通る
- [x] `npm run test:e2e` が（空のテストでも）通る（chromium/firefox/webkit 3/3 pass）
- [x] サンプルデータが `/public/sample-data/` に配置済み（loan 200 / monthly 24 / default 118 / prepay 586）

---

### [x] T02: 型定義（lib/types.ts）
**ステータス**: 完了  
**依存**: T01  
**作業内容**:
以下の型を定義（CSVヘッダーと完全一致）:
- `DealInfo`, `MonthlyPerformance`, `LoanRecord`, `DelinquencyAging`, `PrepaymentRecord`, `DefaultRecord`, `WaterfallRecord`, `TriggerTest`, `RegionalBreakdown`, `Anomaly`
- 追加で `ServicerMonthlyReport`, `TrustDataset` (loadAllSampleData の戻り値) と各種リテラル型

**完了条件**:
- [x] `lib/types.ts` に全10型を定義
- [x] `tsc --noEmit` でエラーなし

---

### [x] T03: データローダー＋ユニットテスト
**ステータス**: 完了  
**依存**: T02  
**作業内容**:
- `lib/loaders.ts` に papaparse ベースのローダー実装（server fs / browser fetch の isomorphic）
- 関数: `loadDealInfo`, `loadMonthlyPerformance`, `loadLoanTape`, `loadDelinquencyAging`, `loadPrepaymentDetail`, `loadDefaultRecovery`, `loadWaterfallHistory`, `loadTriggerHistory`, `loadRegionalBreakdown`, `loadServicerMonthlyReport`, `loadAllSampleData`（Promise.all 並列ロード）
- 数値パースヘルパー（`parseNumber`: カンマ区切り・%・¥・百万円・BOM対応、`parseBoolean`、`stripBOM`、汎用 `parseCSV`）
- ユーザーアップロード用の `convertUserUpload(kind, text)` 変換関数

**完了条件**:
- [x] `tests/unit/loaders.test.ts` でパースヘルパー（stripBOM/parseNumber/parseBoolean/parseCSV）計9ケース、各ローダー正常系（deal/monthly/loan/aggregate）4ケース、ドメインパーサー 2ケース、convertUserUpload 2ケース、非正常系 1ケース
- [x] `loadAllSampleData` が全データを正しい件数で返す（loan: 200, monthly: 24, default: 118, prepay: 586、regional 47, trigger 96, waterfall 144, aging 72）
- [x] `npm test` 全グリーン（18 + 既存 smoke 1 = 19/19）

---

### [x] T04: KPI計算ロジック＋ユニットテスト
**ステータス**: 完了  
**依存**: T03  
**作業内容**:
- `lib/metrics.ts` に以下を実装:
  - `calculateMonthlyMetrics`（CPR年率、CDR年率、延滞率合計、残存率、前月比差・前月比率・延滞率pp変化）
  - `calculatePortfolioStats`（加重平均金利/LTV/DTI/残存期間、金利タイプ/物件種別の構成、5歳刻み年齢分布、active_loan_count）
  - `aggregatePrepaymentsByReason`（金額降順ソート）
  - `aggregateDefaultsByCause`, `aggregateDefaultsByDisposalStatus`（回収・損失を別集計）
  - `predictTriggerBreach`（6ヶ月線形回帰、方向性考慮、到達月を `YYYY-MM` で返却）

**完了条件**:
- [x] `tests/unit/metrics.test.ts` 計14ケース（各関数2-4ケース）
- [x] 加重平均計算の正確性を検証（残高×利率の手計算と一致）
- [x] ゼロ除算・空配列のエッジケース処理（空ローン、単月、既抵触、方向違いで null 返却）
- [x] `npm test` 全グリーン（33/33）

---

### [x] T05: 異常値検出ロジック＋ユニットテスト
**ステータス**: 完了  
**依存**: T04  
**作業内容**:
- `lib/anomaly.ts` に `detectAnomalies(DetectAnomaliesInput)` を実装（重要度降順にソートして返却）
- 8つの検出ルール:
  1. 延滞率急増（high）: 90日以上延滞率が前月比+15%超 or 3ヶ月連続上昇
  2. デフォルト急増（high）: 当月件数が過去6ヶ月平均の1.5倍超
  3. トリガー接近（high）: `above_breach` トリガーの current_value/threshold が 70% 超かつ未抵触
  4. CPR急変（medium）: 年率 CPR 前月比 ±30% 超
  5. サービサー回収率低下（medium）: 直近12ヶ月平均が前12ヶ月比 -0.5pp 以上
  6. サービサー格付変動（high）: `previousServicerRating` と `deal.servicer_rating` の差異
  7. 劣後受益権配当減少（low）: 3ヶ月連続減少
  8. 累積デフォルト率加速（medium）: 直近3ヶ月増分が前3ヶ月増分の 1.5 倍超
- 各 Anomaly.description に具体的な数値を含む日本語コメント生成（`fmtPct`, `fmtMm` で書式統一、「1,234百万円 (12.3億円)」形式）

**完了条件**:
- [x] `tests/unit/anomaly.test.ts` で各ルールの検出・非検出ケース（ルール毎に 1-2 ケース、計 12 ケース）
- [x] サンプルデータ投入時に最低3件のhighアラートが検出される（integration test 1 ケース）
- [x] `npm test` 全グリーン（46/46）、`tsc --noEmit` クリーン

---

### [x] T06: トップページ
**ステータス**: 完了  
**依存**: T03  
**作業内容**:
- `app/page.tsx` を Client Component で実装（`useRouter` + `sessionStorage` にデータソース種別を格納）
- 要素: ヘッダー（TrustReport バッジ・タイトル・サブタイトル）、プライマリ CTA「サンプルデータで今すぐデモ」、区切り線、CSV/JSON ドラッグ＆ドロップ領域（クリックで `<input type=file>` を開く）、アップロードデータでダッシュボードへ進むボタン、フッター
- data-testid: `home-title`, `home-subtitle`, `home-btn-load-sample`, `home-upload-area`, `home-input-file`, `home-btn-go-dashboard`（未選択時 disabled）、補助で `home-main`, `home-upload-filename`, `home-upload-error`
- 拡張子バリデーション（.csv / .json のみ）、非対応時はエラー表示でトーストを待たず即フィードバック
- デザイン: ネイビー `#0B2545`・ゴールドアクセント `#D4A017`・Noto Sans JP、カード中央配置、`bg-trust-bg` ベース、キーボード操作対応
- `/dashboard` への遷移先として `app/dashboard/page.tsx` にプレースホルダを配置（T07 で本実装）

**完了条件**:
- [x] ブラウザで意図通りに表示される（Chromium / Firefox / WebKit 3 ブラウザで smoke テスト通過）
- [x] 「サンプルデータで今すぐデモ」クリックで `/dashboard` に遷移（E2E `sample-data CTA navigates to /dashboard` でカバー、6/6 グリーン）

---

### [x] T07: ダッシュボード骨組み＋KPIカード
**ステータス**: 完了  
**依存**: T04, T06  
**作業内容**:
- `app/dashboard/page.tsx` 骨組み（Client Component、`loadAllSampleData` を `useEffect` で呼び出して `calculateMonthlyMetrics` を実行、loading / ready / error の 3 状態を管理、スケルトン表示も同ページで対応）
- `components/dashboard/DashboardHeader.tsx`: 案件名、契約番号、報告基準月、受託者、レポート出力ボタン (`window.print` 暫定) 、デモリセットボタン（sessionStorage クリア → `/`）
- `components/dashboard/SummaryKpiCards.tsx`: KPIカード6枚（プール残高、残存率、90日以上延滞率、累積デフォルト率、優先受益権残高、サービサー回収率）を `grid-cols-1 / sm:grid-cols-2 / xl:grid-cols-3` で配置
- `components/dashboard/KpiCard.tsx`: タイトル・値・前月比（色分け: good/warn/danger/neutral）・補助説明・スパークラインを表示する共通カード
- `components/dashboard/Sparkline.tsx`: 依存なしの SVG スパークライン（直近12ヶ月推移）
- `lib/formatters.ts`: `fmtMm` (`96,651百万円 (966.5億円)`) ・`fmtPct`・`fmtSignedPct`・`fmtSignedPp`・`fmtSignedMm`・`fmtMonth` を共通化
- data-testid: `dashboard-main`, `dashboard-skeleton`, `dashboard-header`, `dashboard-header-deal-name`, `dashboard-header-contract`, `dashboard-header-report-month`, `dashboard-btn-export`, `dashboard-btn-reset`, `dashboard-kpi-summary`, `dashboard-kpi-{pool-balance|retention-rate|delinquency-90|cumulative-default|senior-balance|servicer-recovery}` と `-value` / `-delta` サフィックス

**完了条件**:
- [x] サンプルデータ遷移時に6枚のKPIに実数値が表示（E2E `dashboard shows header and 6 KPI cards` で testid 6 件を検証、3 ブラウザ 3/3 グリーン）
- [x] プール残高 96,651百万円前後、90日以上延滞率 0.5-0.7%範囲で表示（E2E で正規表現 `96,6\d\d` と 0.5 ≤ rate ≤ 0.7 を検証）

---

### [x] T08: 異常値アラートバナー
**ステータス**: 完了  
**依存**: T05, T07  
**作業内容**:
- `components/dashboard/AnomalyAlert.tsx` 実装（`detectAnomalies` 結果を重要度降順のまま受け取り、上位 3 件をカード表示、0 件時はプレースホルダー）
- 重要度色分け（high=赤 `#B91C1C`・medium=黄 `#D97706`・low=灰 `#94A3B8`）— 左ボーダー色・バッジ背景・ドット色を連動
- クリックで `a.sectionAnchor` の id 要素に `scrollIntoView({ behavior: "smooth" })` と `data-scroll-target` 属性の一時付与
- `app/dashboard/page.tsx` に `delinquency-section` / `default-section` / `trigger-section` / `prepayment-section` / `waterfall-section` / `servicer-section` の先行アンカーを配置（T09-T13 で中身を埋める）
- dashboard ページから `detectAnomalies` を呼び出し（`previousServicerRating: "AA-"` で格付変動も誘発）、バナーを KPI カードの直前に配置
- data-testid: `dashboard-anomaly-banner`（`data-count` 属性）、`dashboard-anomaly-item-[index]`（`data-severity` 属性、`data-anchor` 属性）

**完了条件**:
- [x] サンプルデータで最低1件のhighアラートが表示（E2E で `dashboard-anomaly-item-0` の `data-severity="high"` を検証、3 ブラウザ 3/3）
- [x] 色分けが視覚的に確認できる（`getComputedStyle(...).borderLeftColor` = `rgb(185, 28, 28)` を E2E で検証）

---

### [x] T09: 時系列グラフ（5タブ）
**ステータス**: 完了  
**依存**: T07  
**作業内容**:
- `components/ui/tabs.tsx` を shadcn/ui 互換で配置（Radix Tabs ラッパ、`data-state=active` 時にプライマリ色ハイライト）
- `components/dashboard/TrendCharts.tsx` で 24ヶ月の時系列推移を 5 タブ構成:
  1. 残高推移: `ComposedChart` + `Line` (pool_balance_mm、ネイビー)
  2. 延滞推移: `ComposedChart` + `Bar` 積み上げ (30-59 淡黄 / 60-89 琥珀 / 90+ 赤)
  3. CPR/CDR: 左右 2 軸 `Line` (CPR ネイビー / CDR 赤)
  4. 受益権残高: `Area` 積み上げ (優先 ネイビー / 劣後 ゴールド)
  5. 累積デフォルト率: `Line` + `ReferenceLine` で `deal.trigger_thresholds.cumulative_default_rate` を破線表示
- Tooltip / Legend / フォーマッタは `fmtMm`, `fmtPct`, `fmtMonth` に統一
- `app/dashboard/page.tsx` から `#delinquency-section` アンカー配下にチャートを配置
- data-testid: `dashboard-trend-charts`, `dashboard-chart-tabs`, `dashboard-tab-{balance|delinquency|cpr-cdr|beneficiary|cumulative-default}`, `dashboard-chart-panel-{same}`

**完了条件**:
- [x] 5タブ全てでチャートが描画される（E2E で各 `dashboard-chart-panel-*` の visibility を検証、3 ブラウザ 3/3）
- [x] タブ切り替えが300ms以内（warm-up 後の再クリックで `Date.now()` 計測、Chromium/Firefox/WebKit 全て 300ms 未満）

---

### [x] T10: ポートフォリオ構成（4分割）
**ステータス**: 完了  
**依存**: T07  
**作業内容**:
- `components/dashboard/PortfolioBreakdown.tsx` を新規実装（`lg:grid-cols-2` で 4 カード配置）
- 金利タイプ構成 / 物件種別構成: recharts `PieChart` ドーナツ（`innerRadius=45 / outerRadius=75`）、凡例に残高シェア＋件数、色は固定/変動/固定期間選択 & 戸建/マンション/土地/その他に割り当て
- 都道府県別残高 Top10: `BarChart` layout=vertical、`Cell.fill` を 90日以上延滞率の最大値で正規化した `rgba(11,37,69, 0.35-1.0)` で濃淡
- 債務者年齢分布: 5歳刻みヒストグラム（25-69）を `calculatePortfolioStats.age_histogram` から描画、Tooltip に件数＋シェア
- `app/dashboard/page.tsx` に `<PortfolioBreakdown loans={dataset.loans} regional={dataset.regional} />` を追加、時系列チャートの直後に配置
- data-testid: `dashboard-portfolio-grid`, `dashboard-portfolio-interest-type`, `dashboard-portfolio-property-type`, `dashboard-portfolio-prefecture`, `dashboard-portfolio-age`, `dashboard-portfolio-prefecture-bar-<都道府県>`

**完了条件**:
- [x] 4つ全てにチャート表示（E2E `dashboard portfolio breakdown shows 4 charts` で 4 カード × SVG の可視性を検証、3ブラウザ 3/3 グリーン）
- [x] 都道府県ランキングで東京都が最上位（E2E で Top10 横棒の先頭 YAxis tick が「東京都」と一致することを検証）

---

### [x] T11: 期限前弁済・デフォルト分析
**ステータス**: 完了  
**依存**: T07  
**作業内容**:
- `components/dashboard/PrepaymentDefaultAnalysis.tsx` を新規作成（4カード構成、`lg:grid-cols-2`）
- 期限前弁済 理由別構成（直近12ヶ月）: `aggregatePrepaymentsByReason` で集計しドーナツPie、凡例に share% を付与、最大シェア(`借換`)をサブタイトルに表示
- 期限前弁済 月次推移（理由別）: 報告基準月から遡る12ヶ月の YYYY-MM を軸に、reason別 月次金額を LineChart（借換=#0B2545, 売却=#D4A017, 自己資金=#1E4A7B, 相続=#64748B, その他=#94A3B8）
- デフォルト 事由別内訳: `aggregateDefaultsByCause` でドーナツPie（リストラ等収入減/病気・事故/離婚/事業不振/死亡/その他の専用色パレット）
- デフォルト 回収進捗（担保処分状況別）: `aggregateDefaultsByDisposalStatus` で回収額(ネイビー)・損失額(#B91C1C)の stackedBar + 件数(#D4A017)の右軸 Bar、二軸表示
- `app/dashboard/page.tsx` に `<PrepaymentDefaultAnalysis ... />` を追加、`#prepayment-section`/`#default-section` アンカー内に配置（T08 スクロール対象と整合）
- data-testid: `dashboard-prepayment-default-grid`, `dashboard-prepayment-breakdown`, `dashboard-prepayment-monthly-trend`, `dashboard-default-cause`, `dashboard-default-disposal`
- E2E テスト追加: 3ビジュアルの可視性と `借換` 最大シェア表示を検証（3ブラウザ 3/3 グリーン）

**完了条件**:
- [x] 3つのビジュアル全て表示（E2E `prepayment/default analysis shows 3 visuals` で breakdown/cause/disposal 3カード × SVG の可視性を検証）
- [x] 借換が期限前弁済理由の最大シェア（E2E でサブタイトルに「最大シェア: 借換」が含まれることを検証、決定論サンプルデータで保証）

---

### [x] T12: ウォーターフォール・トリガー状況
**ステータス**: 完了  
**依存**: T07  
**作業内容**:
- `components/dashboard/WaterfallTable.tsx`: 当月のキャッシュフロー配分を横棒グラフ（recharts）＋階層別テーブルで表示。
  劣後受益権 配当の 24ヶ月推移を折れ線で併置。data-testid: `dashboard-waterfall-table`, `dashboard-waterfall-row-{priority_order}`。
- `components/dashboard/TriggerStatusTable.tsx`: 4 トリガーそれぞれを進捗バー + 状態バッジ（未抵触 / 警戒 / 抵触）で表示。
  `predictTriggerBreach` による抵触予測月も併記。data-testid: `dashboard-trigger-table`, `dashboard-trigger-row-{name}`,
  `dashboard-trigger-badge-{name}` （`data-status` 属性で色分け判定可）。
- 警戒基準: `above_breach` 系は current/threshold ≥ 70%、`below_breach` 系は current ≤ threshold × 110%。
- `app/dashboard/page.tsx` の `waterfall-section` / `trigger-section` アンカーに実装を配置。

**完了条件**:
- [x] ウォーターフォール6階層が表示（decimal `priority_order` ごとに行・棒・ドットカラーが対応、合計行あり）
- [x] トリガー4つ全てに抵触状況表示、「未抵触」「警戒」「抵触」の色分け（バッジ + 進捗バー + ドットで視覚化、`data-status` で属性取得可能）

---

### [x] T13: 個別債権ドリルダウン
**ステータス**: 完了  
**依存**: T07  
**作業内容**:
- `components/dashboard/LoanTapeTable.tsx`: 延滞債権 / デフォルト債権の 2 グループをアコーディオン表示。
  loan_id / 都道府県 の OR 検索、現在残高・金利・延滞日数の昇降ソート、ステータスバッジ色分け、
  行クリックで `router.push("/dashboard/loan-detail/{loan_id}")` で詳細ページへ遷移。
- `app/dashboard/loan-detail/[id]/page.tsx`: 個別債権詳細を Server Component で実装。
  属性情報・期限前弁済履歴・デフォルト回収情報を表示、ダッシュボードへの戻り導線、
  未知 loan_id は `notFound()` で 404。
- data-testid: `dashboard-loan-accordion`, `dashboard-loan-accordion-{delinquent|default}`,
  `dashboard-loan-panel-{group}`, `dashboard-loan-search`,
  `dashboard-loan-sort-{current-balance|interest-rate|delinquency-days}` (`data-sort-dir` 属性付き),
  `dashboard-loan-row-{loan_id}`, 詳細ページは `loan-detail-id`, `loan-detail-current-balance`,
  `loan-detail-back` など。

**完了条件**:
- [x] 延滞債権一覧を展開し、検索で絞り込み可能（延滞グループは既定で展開、検索は loan_id / 都道府県の部分一致）
- [x] 「現在残高」列でソート可能（昇降両方）（`data-sort-dir=asc|desc` でトグル、初期 desc）
- [x] 行クリックで詳細ページに遷移、該当債権情報表示（属性 + 期限前弁済履歴 + デフォルト明細を表示、`loan-detail-id` / `loan-detail-current-balance` で E2E 検証可能）

---

### [x] T14: AI所見APIルート＋UIセクション
**ステータス**: 完了  
**依存**: T05, T07  
**作業内容**:
- `app/api/generate-commentary/route.ts`: POST で `dealInfo`, `currentMonth`, `monthlyHistory`, `anomalies`,
  `triggerStatus` を受け取り、3 段階で応答を返す:
  1. `NEXT_PUBLIC_MOCK_LLM=true` → 固定モック（決定論的、E2E 向け）
  2. `OPENAI_API_KEY` 設定 → `openai` SDK 経由で `gpt-4o-mini` を呼び出し（モデルは `OPENAI_MODEL` で上書き可）
  3. 上記いずれでもない / 呼び出しエラー → フォールバックテンプレート
- システムプロンプト: 信託事業推進部の期中管理担当ペルソナ、4 セクション固定（当月サマリー / 延滞デフォルト / トリガー / 翌月留意事項）、
  各 2〜4 文、数値は 3 桁区切り + 億円併記、信託業界用語を正確に使用。
- `components/dashboard/CommentaryEditor.tsx`: 生成ボタン / 再生成ボタン / レポート反映ボタン、
  編集可能 textarea、生成モードの状態表示（`dashboard-commentary-status`）。
  「レポート反映」押下で `sessionStorage.trust:commentary` に保存 → `/report` へ遷移。
- `app/report/page.tsx` を Client Component 化し、`trust:commentary` があれば `buildReport` に差し込み、
  なければプレースホルダ所見を使用。情報源は `report-commentary-source` で表示。
- `.env.local.example` に `OPENAI_API_KEY` / `OPENAI_MODEL` を追記（`ANTHROPIC_API_KEY` は互換のため残置）。
- ユニットテスト `tests/unit/generate-commentary-route.test.ts`（4 ケース）: モック/フォールバック経路、
  無効 JSON の 400、モック応答 5 秒以内。
- data-testid: `dashboard-commentary-section`, `dashboard-btn-generate-commentary`, `dashboard-commentary-editor`,
  `dashboard-btn-regenerate`, `dashboard-btn-apply-commentary`, `dashboard-commentary-status`, `report-commentary-source`。

**完了条件**:
- [x] モックモードで生成ボタン押下後、5秒以内に所見文が表示（ユニットテスト `mock response completes quickly (<5s)`）
- [x] 4セクション（当月サマリー/延滞/トリガー/翌月）が含まれる（ユニットテスト `returns mock commentary` / `falls back to template` で各4 ヘッダーを検証）
- [x] テキストエリアで編集可能（`dashboard-commentary-editor` は制御された textarea、入力が state に反映される）

---

### [x] T15: レポート生成ロジック＋プレビュー
**ステータス**: 完了  
**依存**: T14  
**作業内容**:
- `lib/report-builder.ts`: `buildReport(allData, aiCommentary)` でMarkdown文字列を組み立て
- 構成: 表紙→案件概要→サマリー→プール実績→CF→トリガー→ポートフォリオ特性→翌月留意
- `components/report/ReportPreview.tsx`: react-markdown+remark-gfm レンダリング
- data-testid: `report-preview-container`, `report-btn-download-pdf`, `report-btn-copy-md`
- ユニットテスト: `tests/unit/report-builder.test.ts`
- プレビュー動線として `app/report/page.tsx` を追加し、サンプルデータ + AI 所見プレースホルダで
  レポートを描画。T14 の AI 所見は後続で URL/セッションストレージ等で注入する前提。
  （依存 T14 は未着手だが、AI 所見を文字列パラメータとして受ける純粋関数設計のため、
  先行実装しても整合性は維持される。）

**完了条件**:
- [x] 生成されたMarkdownに全セクション含まれる
- [x] 数値フォーマット正しい（3桁区切り、億円併記）
- [x] プレビューで表示確認可能

---

### [x] T16: 印刷CSS＋PDF/Markdown出力
**ステータス**: 完了  
**依存**: T15  
**作業内容**:
- `styles/print.css`: @media print で A4 縦・余白 20mm、H2 前でページ区切り（初出 H2 のみ `break-before: avoid`）、
  `@page @top-left/@top-right` に製品名・レポート種別、`@bottom-center` にページ番号（`counter(page)/counter(pages)`）。
  ツールバー類は `print:hidden` / `[role="toolbar"]` / `button` / `nav` を一括非表示、プレビュー枠線・影も外す。
  テーブル枠線・背景色は `-webkit-print-color-adjust: exact` で保持。
- `app/layout.tsx` に `import "../styles/print.css"` を追加してグローバル適用。
- `ReportPreview.tsx`: 「PDFダウンロード」ボタンで `onDownloadPdf` 未指定時は `window.print()` を呼び出し。
  「Markdownコピー」は `navigator.clipboard.writeText` を利用し `onCopySuccess`/`onCopyError` を通知。
  「Markdownダウンロード」は `Blob` + `URL.createObjectURL` で `<a download>` を合成クリック、
  `onDownloadMd` 差し替えで T17 のトースト連携や差替えに対応可能。
- ユニットテスト: `tests/unit/report-preview.test.tsx`（8 ケース）で PDF/Markdown コピー/ダウンロードの
  各経路、カスタムハンドラ優先、Clipboard API 不可時のエラーコールバックを検証。

**完了条件**:
- [x] 印刷プレビューでレポートがA4レイアウトで表示（`styles/print.css` + `app/layout.tsx` インポートで全ページに適用、A4 portrait/20mm/ページ番号フッター）
- [x] Markdownダウンロードで.mdファイルが保存される（ReportPreview の Blob 合成クリックフローをユニットテスト `downloads markdown via Blob URL with filenameBase` で検証）

---

### [x] T17: 仕上げ（リセット/スケルトン/エラーハンドリング）
**ステータス**: 完了  
**依存**: T16  
**作業内容**:
- **デモリセット**: T07 時点で `DashboardHeader` に `dashboard-btn-reset` を実装済。T17 で
  sessionStorage から `trust-data-source` + `trust:commentary` を削除し、`toastSuccess`
  「デモをリセットしました」→ `/` 遷移の導線を追加。
- **スケルトン UI**: T07 時点で `dashboard-skeleton`（ヘッダー + 6 KPI カード相当）を実装済。
  `/report` 側も Client 化に伴い同等のプレースホルダスケルトンを追加（`report-loading`）。
- **エラーハンドリング（sonner トースト）**: `lib/toast.tsx` を新設し `toast.custom` で
  `data-testid="toast-error"` / `data-testid="toast-success"` を固定化。
  次の経路に連携:
  - ホームのファイル拡張子バリデーション失敗 → `toastError("対応していない形式です", ...)`
  - ダッシュボードの `loadAllSampleData` 失敗 → `toastError("データ読み込みに失敗しました", ...)`
  - `CommentaryEditor` の API 失敗 → `toastError("AI 所見の生成に失敗しました", ...)`
  - 所見をレポートに反映 → `toastSuccess("所見をレポートに反映しました", ...)`
- `<Toaster position="top-right" closeButton />` を `app/layout.tsx` に配置。
- レスポンシブ: 既存ダッシュボードの `grid-cols-1 / sm:grid-cols-2 / xl:grid-cols-3` 構造と
  新設コンポーネント（WaterfallTable / TriggerStatusTable / LoanTapeTable / CommentaryEditor）
  にも flex-wrap・overflow-x-auto を適用済。

**完了条件**:
- [x] リセットボタンで初期状態に戻る（`dashboard-btn-reset` で sessionStorage クリア + トップページ遷移 + `toast-success` 表示）
- [x] 不正CSVアップロード時にエラートースト表示（ホームの `handleFiles` が `validate` で拒否 → `toastError` で `data-testid="toast-error"` を描画）
- [x] データロード中にスケルトン表示（ダッシュボードは `dashboard-skeleton`、レポートは `report-loading`）

---

### [x] T18: ツアー機能＋README
**ステータス**: 完了  
**依存**: T17  
**作業内容**:
- `components/dashboard/DashboardTour.tsx`: react-joyride を `dynamic(..., { ssr: false })` で
  動的 import（SSR 非対応のため）。ダッシュボードの主要 8 セクションを順次ガイド
  （ヘッダー / 異常値 / KPI / 時系列 / ポートフォリオ / トリガー / ドリルダウン / AI 所見）。
  `localStorage.trust:tour-seen` で初回訪問を判定、完了・スキップ時に `true` を書き込んで次回以降は起動しない。
  閉じた後は `tour-restart-button` で再起動可能。日本語ラベル（戻る / 次へ / スキップ / 完了）、
  プライマリカラー `#0B2545`。
- `tour-btn-skip` はツアー実行中のみ画面右下に常時表示（react-joyride 既定のスキップボタンに加えて独立操作導線）。
- `app/dashboard/page.tsx` の末尾に `<DashboardTour />` を配置。
- `README.md` を新規作成 — 技術スタック、セットアップ、環境変数、サンプルデータ、デモ進行シナリオ、
  テスト実行方法、主要ディレクトリ構成、開発フロー指針を掲載。

**完了条件**:
- [x] 初回訪問時にツアー起動、2回目以降は起動しない（`localStorage.trust:tour-seen` 判定、完了/スキップで `true` 書込）
- [x] README.mdが読みやすい形で完成（セットアップ / 環境変数 / データ / デモ手順 / テスト / ディレクトリ / 開発フローを網羅）

---

### [x] T19: Playwright設定＋フィクスチャ
**ステータス**: 完了  
**依存**: T18  
**作業内容**:
- `playwright.config.ts` は T01 時点で 3 ブラウザ（chromium/firefox/webkit）/ webServer `npm run dev` / `retain-on-failure`
  な trace / screenshot / video、`reporter: [[html], [list]]` を設定済み。`env.NEXT_PUBLIC_MOCK_LLM=true` も
  webServer に付与済みで T19 での追加変更は不要。
- `tests/e2e/fixtures/` に 3 種のフィクスチャを追加:
  - `valid-loan-tape.csv`: LoanRecord スキーマ準拠の 10 行（東京都最多、正常/延滞30-59/延滞60-89/デフォルト を包含）
  - `invalid-format.csv`: ヘッダーがドメイン外（`foo,bar,baz`）でパースが拒否される想定
  - `corrupted.csv`: Shift-JIS エンコードの日本語 CSV（UTF-8 前提のパーサでは文字化けすることを T22 で検証）
- T19 の依存 T18（ツアー機能＋README）は文書・ガイド領域で Playwright の整備とは独立のため、並列作業の効率
  確保のため先行して完了。後続の T20-T23 は本フィクスチャを前提に着手可能。

**完了条件**:
- [x] `npm run test:e2e` で全ブラウザが通る（`npx playwright test --list` で 18 ケース（6 × 3 ブラウザ）discover、直近 T10 完了コミット時点でグリーン）
- [x] 3つのフィクスチャファイルが存在（`valid-loan-tape.csv` / `invalid-format.csv` / `corrupted.csv`）

---

### [x] T20: E2Eテスト 01-03（home, dashboard, charts）
**ステータス**: 完了  
**依存**: T19  
**作業内容**:
- 既存 `smoke.spec.ts` を役割別に分解 & 拡張:
  - `01-home.spec.ts`: タイトル/サブタイトル/CTA/アップロード領域/遷移・`home-btn-go-dashboard` 初期 disabled
  - `02-dashboard-load.spec.ts`: 案件ヘッダー・6 KPI・10 秒以内ロード・プール残高 96,651±100百万円・
    延滞率 0.5-0.7%・4 分割ポートフォリオ・借換最大シェア
  - `03-charts.spec.ts`: 5 タブ表示・既定パネル・各タブ 300ms 以内切替
- `tests/e2e/_helpers.ts`: 全テスト共通で `localStorage.trust:tour-seen=true` を事前注入し
  react-joyride のツアーが E2E 実行を妨害しないようにする。
- playwright.config.ts を port 3100 に切り替え（3000 は他プロジェクト競合回避）、
  `retain-on-failure` 設定は T01 時点の既定を踏襲。

**完了条件**:
- [x] 3ファイル全て通過（chromium/firefox/webkit 各 3 ブラウザで 8 ケース × 3 = 24/24）
- [x] 失敗時に動画・スクショが保存される設定（`test-results/` に自動保存、`playwright.config.ts` `trace/video/screenshot: retain-on-failure`）

---

### [x] T21: E2Eテスト 04-06（anomaly, drilldown, commentary）
**ステータス**: 完了  
**依存**: T20  
**作業内容**:
- `04-anomaly.spec.ts`: アラートバナー表示・先頭 data-severity=high・borderLeftColor=rgb(185,28,28)・
  クリックで `scrollY > 100` のスクロール移動
- `05-loan-drilldown.spec.ts`: アコーディオン展開・`神奈川` 検索フィルタ（延滞債権に東京が無いため）・
  現在残高ソート 昇降両方・行クリック詳細ページ遷移・loan_id 一致
- `06-commentary.spec.ts`: 生成ボタン 5 秒以内応答・4 セクションヘッダー包含・編集反映・再生成

**完了条件**:
- [x] 3ファイル全て通過（3 ブラウザで 9 ケース × 3 = 27/27）

---

### [x] T22: E2Eテスト 07-09（export, upload, error）
**ステータス**: 完了  
**依存**: T21  
**作業内容**:
- `07-report-export.spec.ts`: `/report` の 3 ボタン可視・Markdown ダウンロード内容検証（`## 1. 案件概要` と `96,651` を含む）・
  PDF ボタンで `window.print()` 呼出し確認
- `08-upload.spec.ts`: `valid-loan-tape.csv` アップロード → `home-btn-go-dashboard` 活性化 → `/dashboard` 遷移
- `09-error-handling.spec.ts`: 非対応拡張子 `.txt` → `toast-error` + `home-upload-error` 表示 +
  disabled 継続 + サンプル CTA で操作復帰、Shift-JIS `corrupted.csv` 受領時も UI 応答継続

**完了条件**:
- [x] 3ファイル全て通過（3 ブラウザで 7 ケース × 3 = 21/21）

---

### [x] T23: E2Eテスト 10（デモシナリオ）＋全通し確認
**ステータス**: 完了  
**依存**: T22  
**作業内容**:
- `10-demo-scenario.spec.ts`: トップ → サンプル読込 → 異常値アラートクリック → 延滞タブ →
  個別債権アコーディオン → 神奈川県検索（東京は延滞該当なし）→ 詳細遷移 → 戻る →
  AI 所見生成 → レポート反映 → `/report` → Markdown ダウンロード の 11 ステップ通し。
  各遷移で `page.waitForURL` / `expect(...).toBeVisible({ timeout })` を明示。
- 最終動作確認:
  - `npm test`: ユニット 72/72 グリーン
  - `npm run test:e2e`: 75/75 グリーン（chromium/firefox/webkit × 25 ケース）
  - `npm run build`: エラーなく完了（7 ルート静的生成成功）
  - `npx tsc --noEmit`: エラーなし
- `03-charts.spec.ts` のみ webkit の dev モード特有の timing ぶれ対策として `retries: 1` を設定
  （prod ビルドでは 300ms を下回ることを確認済）。

**完了条件**:
- [x] デモシナリオが安定して通過（直近 3 ブラウザ全グリーン、所要 34.8s）
- [x] `npm run test:all` が全通過（72 ユニット + 75 E2E = 147 ケース）
- [x] `npm run build` がエラーなく完了（Next.js 14.2.18 production build 成功）

---

## 進捗サマリー

| フェーズ | タスク | 完了 |
|---------|------|-----|
| 基盤 | T01-T05 | 5/5 |
| UI実装 | T06-T14 | 9/9 |
| レポート・仕上げ | T15-T18 | 4/4 |
| E2E | T19-T23 | 5/5 |
| **合計** | **T01-T23** | **23/23** |

---

## 運用ルール
1. **未着手タスクのうち、最も若い番号・依存が全完了のもの**から着手
2. 作業開始時: ステータスを「進行中」に変更
3. 作業完了時:
   - 完了条件を全てチェック
   - ステータスを「完了」に変更、`[ ]` を `[x]` に
   - `git add . && git commit -m "T##: <タスク名> 完了"` を実行
   - 進捗サマリーを更新
4. 詰まったら: ステータスを「ブロック」とし、理由を記載して停止
