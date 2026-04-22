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

### [ ] T08: 異常値アラートバナー
**ステータス**: 未着手  
**依存**: T05, T07  
**作業内容**:
- `components/dashboard/AnomalyAlert.tsx` 実装
- detectAnomaliesの上位3件をカード表示
- 重要度で色分け（high=赤、medium=黄、low=灰）
- クリックで該当セクションにスクロール
- data-testid: `dashboard-anomaly-banner`, `dashboard-anomaly-item-[index]`（data-severity属性）

**完了条件**:
- [ ] サンプルデータで最低1件のhighアラートが表示
- [ ] 色分けが視覚的に確認できる

---

### [ ] T09: 時系列グラフ（5タブ）
**ステータス**: 未着手  
**依存**: T07  
**作業内容**:
- shadcn/ui Tabs で5タブ構成
  - 残高推移（折れ線、24ヶ月）
  - 延滞推移（積み上げ棒：30-59/60-89/90+）
  - CPR/CDR（2軸折れ線）
  - 受益権残高（優先・劣後、積み上げエリア）
  - 累積デフォルト率（折れ線＋トリガー閾値破線）
- recharts 使用
- data-testid: `dashboard-chart-tabs`, `dashboard-tab-[name]`

**完了条件**:
- [ ] 5タブ全てでチャートが描画される
- [ ] タブ切り替えが300ms以内

---

### [ ] T10: ポートフォリオ構成（4分割）
**ステータス**: 未着手  
**依存**: T07  
**作業内容**:
- 4分割レイアウトで以下を表示:
  - 金利タイプ構成（ドーナツ）
  - 物件種別構成（ドーナツ）
  - 都道府県別残高Top10（横棒、延滞率で色濃淡）
  - 債務者年齢分布（ヒストグラム、5歳刻み）
- data-testid: `dashboard-portfolio-[name]`

**完了条件**:
- [ ] 4つ全てにチャート表示
- [ ] 都道府県ランキングで東京都が最上位

---

### [ ] T11: 期限前弁済・デフォルト分析
**ステータス**: 未着手  
**依存**: T07  
**作業内容**:
- 期限前弁済の理由別構成（過去12ヶ月、ドーナツ＋月次推移）
- デフォルト事由別内訳（ドーナツ）
- デフォルト回収進捗（担保処分状況別の件数・金額）
- data-testid: `dashboard-prepayment-breakdown`, `dashboard-default-cause`, `dashboard-default-disposal`

**完了条件**:
- [ ] 3つのビジュアル全て表示
- [ ] 借換が期限前弁済理由の最大シェア

---

### [ ] T12: ウォーターフォール・トリガー状況
**ステータス**: 未着手  
**依存**: T07  
**作業内容**:
- `WaterfallTable.tsx`: 当月CF配分の棒グラフ＋24ヶ月の劣後配当推移
- `TriggerStatusTable.tsx`: 4トリガーのProgressバー＋Badge、predictTriggerBreach の予測月表示
- data-testid: `dashboard-waterfall-table`, `dashboard-trigger-table`, `dashboard-trigger-row-[name]`

**完了条件**:
- [ ] ウォーターフォール6階層が表示
- [ ] トリガー4つ全てに抵触状況表示、「未抵触」「警戒」「抵触」の色分け

---

### [ ] T13: 個別債権ドリルダウン
**ステータス**: 未着手  
**依存**: T07  
**作業内容**:
- アコーディオン: 延滞債権一覧・デフォルト債権一覧
- `LoanTapeTable.tsx`: 検索・ソート・フィルタ可能なテーブル
- `app/dashboard/loan-detail/[id]/page.tsx`: 個別詳細ページ
- data-testid: `dashboard-loan-accordion`, `dashboard-loan-search`, `dashboard-loan-sort-[col]`, `dashboard-loan-row-[id]`

**完了条件**:
- [ ] 延滞債権一覧を展開し、検索で絞り込み可能
- [ ] 「現在残高」列でソート可能（昇降両方）
- [ ] 行クリックで詳細ページに遷移、該当債権情報表示

---

### [ ] T14: AI所見APIルート＋UIセクション
**ステータス**: 未着手  
**依存**: T05, T07  
**作業内容**:
- `app/api/generate-commentary/route.ts`: POSTで monthlyHistory, currentMonth, anomalies, portfolioStats, triggerStatus, dealInfo を受け取り、claude-sonnet-4-5 を呼び出し
- システムプロンプト: 信託銀行の期中管理担当者ペルソナ、4セクション（当月サマリー/延滞デフォルト/トリガー/翌月留意事項）、各2-4文
- `NEXT_PUBLIC_MOCK_LLM=true` 時は固定モックレスポンスを返す分岐
- エラー時のフォールバックテンプレート
- UIセクション: 生成ボタン、CommentaryEditor（編集可能textarea）、再生成ボタン、レポート反映ボタン
- data-testid: `dashboard-btn-generate-commentary`, `dashboard-commentary-editor`, `dashboard-btn-regenerate`, `dashboard-btn-apply-commentary`

**完了条件**:
- [ ] モックモードで生成ボタン押下後、5秒以内に所見文が表示
- [ ] 4セクション（当月サマリー/延滞/トリガー/翌月）が含まれる
- [ ] テキストエリアで編集可能

---

### [ ] T15: レポート生成ロジック＋プレビュー
**ステータス**: 未着手  
**依存**: T14  
**作業内容**:
- `lib/report-builder.ts`: `buildReport(allData, aiCommentary)` でMarkdown文字列を組み立て
- 構成: 表紙→案件概要→サマリー→プール実績→CF→トリガー→ポートフォリオ特性→翌月留意
- `components/report/ReportPreview.tsx`: react-markdown+remark-gfm レンダリング
- data-testid: `report-preview-container`, `report-btn-download-pdf`, `report-btn-copy-md`
- ユニットテスト: `tests/unit/report-builder.test.ts`

**完了条件**:
- [ ] 生成されたMarkdownに全セクション含まれる
- [ ] 数値フォーマット正しい（3桁区切り、億円併記）
- [ ] プレビューで表示確認可能

---

### [ ] T16: 印刷CSS＋PDF/Markdown出力
**ステータス**: 未着手  
**依存**: T15  
**作業内容**:
- `styles/print.css`: @media print、A4、余白20mm、H2前ページ区切り、ヘッダー/フッター
- 「PDFダウンロード」ボタンで `window.print()` トリガー
- 「Markdownコピー」「Markdownダウンロード」機能

**完了条件**:
- [ ] 印刷プレビューでレポートがA4レイアウトで表示
- [ ] Markdownダウンロードで.mdファイルが保存される

---

### [ ] T17: 仕上げ（リセット/スケルトン/エラーハンドリング）
**ステータス**: 未着手  
**依存**: T16  
**作業内容**:
- 「デモをリセット」ボタン機能
- ローディング時のSkeleton UI
- エラーハンドリング（sonnerトースト）: ファイル形式エラー、API失敗、データ不整合
- data-testid: `dashboard-btn-reset`, `dashboard-skeleton`, `toast-error`, `toast-success`
- レスポンシブ調整（タブレット・デスクトップ）

**完了条件**:
- [ ] リセットボタンで初期状態に戻る
- [ ] 不正CSVアップロード時にエラートースト表示
- [ ] データロード中にスケルトン表示

---

### [ ] T18: ツアー機能＋README
**ステータス**: 未着手  
**依存**: T17  
**作業内容**:
- react-joyride でダッシュボードツアー（初回訪問時、localStorage判定）
- スキップボタン: `tour-btn-skip`
- README.md: セットアップ手順、.env.local設定、サンプルデータ説明、デモ進行シナリオ、テスト実行方法

**完了条件**:
- [ ] 初回訪問時にツアー起動、2回目以降は起動しない
- [ ] README.mdが読みやすい形で完成

---

### [ ] T19: Playwright設定＋フィクスチャ
**ステータス**: 未着手  
**依存**: T18  
**作業内容**:
- `playwright.config.ts` 最終化（3ブラウザ、webServer、retain-on-failure動画・スクショ、HTMLレポート）
- env に `NEXT_PUBLIC_MOCK_LLM=true`
- `tests/e2e/fixtures/` に valid-loan-tape.csv（10行版）、invalid-format.csv、corrupted.csv（Shift-JIS）作成

**完了条件**:
- [ ] `npm run test:e2e` で空テストが全ブラウザで通る
- [ ] 3つのフィクスチャファイルが存在

---

### [ ] T20: E2Eテスト 01-03（home, dashboard, charts）
**ステータス**: 未着手  
**依存**: T19  
**作業内容**:
- `01-home.spec.ts`: タイトル表示、ボタン機能、遷移
- `02-dashboard-load.spec.ts`: 案件名・契約番号表示、KPI6枚表示、数値範囲チェック（プール残高 96,651±100百万円、延滞率 0.5-0.7%）、10秒以内ロード
- `03-charts.spec.ts`: 5タブクリック可能、各チャート描画、300ms以内切替

**完了条件**:
- [ ] 3ファイル全て通過
- [ ] 失敗時に動画・スクショが保存される設定

---

### [ ] T21: E2Eテスト 04-06（anomaly, drilldown, commentary）
**ステータス**: 未着手  
**依存**: T20  
**作業内容**:
- `04-anomaly.spec.ts`: アラート表示、high重要度検証、クリックスクロール、色分けCSS
- `05-loan-drilldown.spec.ts`: アコーディオン展開、検索絞り込み、ソート、詳細ページ遷移
- `06-commentary.spec.ts`: 生成ボタン、モックレスポンス5秒以内、4セクション含有確認、編集・再生成

**完了条件**:
- [ ] 3ファイル全て通過

---

### [ ] T22: E2Eテスト 07-09（export, upload, error）
**ステータス**: 未着手  
**依存**: T21  
**作業内容**:
- `07-report-export.spec.ts`: Markdownダウンロード内容検証、PDF出力時のwindow.print呼び出し
- `08-upload.spec.ts`: カスタムファイルアップロード、活性化、ダッシュボード遷移
- `09-error-handling.spec.ts`: 不正CSV/破損CSV/API失敗時のトースト、操作継続可能性

**完了条件**:
- [ ] 3ファイル全て通過

---

### [ ] T23: E2Eテスト 10（デモシナリオ）＋全通し確認
**ステータス**: 未着手  
**依存**: T22  
**作業内容**:
- `10-demo-scenario.spec.ts`: トップ→サンプル読込→アラートクリック→延滞タブ→債権一覧展開→東京都検索→詳細遷移→戻る→AI所見生成→Markdownダウンロードの全ユーザージャーニーを通す
- 各ステップで `page.waitFor系` を明示的に使用
- 最終動作確認: `npm run build`, `npm test`, `npm run test:e2e`, `npm run test:e2e:demo` 全てグリーン

**完了条件**:
- [ ] デモシナリオが安定して通過（3回連続実行で100%成功）
- [ ] `npm run test:all` が全通過
- [ ] `npm run build` がエラーなく完了

---

## 進捗サマリー

| フェーズ | タスク | 完了 |
|---------|------|-----|
| 基盤 | T01-T05 | 5/5 |
| UI実装 | T06-T14 | 2/9 |
| レポート・仕上げ | T15-T18 | 0/4 |
| E2E | T19-T23 | 0/5 |
| **合計** | **T01-T23** | **7/23** |

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
