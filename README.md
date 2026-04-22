# TrustReport — 信託期中管理レポート自動生成ツール

SBI 新生信託銀行 信託事業推進部向けの営業デモ用 Web アプリ。資産流動化案件（住宅ローン信託）
のサービサー月次報告データを取り込み、ダッシュボード表示・異常値検知・AI 所見生成・
PDF レポート出力までを 1 画面から体験できます。

- **技術スタック**: Next.js 14 (App Router) / TypeScript / Tailwind CSS / shadcn/ui / recharts / papaparse / OpenAI SDK
- **テスト**: Vitest（ユニット）・Playwright（E2E、chromium / firefox / webkit）
- **デザイン**: プライマリ `#0B2545` ネイビー、アクセント `#D4A017` ゴールド、Noto Sans JP

---

## セットアップ

### 前提
- Node.js 18.18+ (20.x 推奨)
- npm 10+

### 手順

```bash
# 1. 依存インストール
npm install

# 2. 環境変数の雛形をコピーして編集（OpenAI キーなどを入れる）
cp .env.local.example .env.local
$EDITOR .env.local

# 3. 開発サーバ起動
npm run dev
# → http://localhost:3000 を開く
```

### 環境変数（`.env.local`）

| キー | 用途 |
| --- | --- |
| `OPENAI_API_KEY` | AI 所見生成（`/api/generate-commentary`）で OpenAI を呼び出す場合に設定 |
| `OPENAI_MODEL` | 上書き可。既定は `gpt-4o-mini` |
| `NEXT_PUBLIC_MOCK_LLM` | `true` にすると LLM を呼ばず決定論的なモック応答を返す（E2E や API キー未設定時） |
| `ANTHROPIC_API_KEY` | 互換のため残置。現在は未使用 |

> 本アプリは `NEXT_PUBLIC_MOCK_LLM=true` のままでも完全にデモ可能です。OpenAI キーは
> 実 LLM を試したいときのみ設定してください。

---

## サンプルデータ

`public/sample-data/` に 10 種類のファイルを決定論的に生成配置しています
（`scripts/generate-sample-data.ts` で再生成可）。

| ファイル | 件数 / 期間 | 主なアンカー |
| --- | --- | --- |
| `deal_info.json` | 1 | プール初期 120,000 百万円 / トリガー 4 種 |
| `monthly_performance.csv` | 24 ヶ月 | 当月プール残高 ≈ 96,651 百万円 |
| `delinquency_aging_history.csv` | 72 行 | 30-59 / 60-89 / 90+ の 3 バケット × 24 ヶ月 |
| `loan_tape.csv` | 200 件 | 東京都が残高 1 位 |
| `prepayment_detail.csv` | 586 件 | 借換が最大シェア |
| `default_recovery.csv` | 118 件 | 6 事由 × 5 処分状況 |
| `cf_waterfall_history.csv` | 144 行 | 6 階層 × 24 ヶ月 |
| `trigger_test_history.csv` | 96 行 | 4 トリガー × 24 ヶ月 |
| `regional_breakdown.csv` | 47 行 | 47 都道府県 |
| `servicer_monthly_report_202603.json` | 1 | 当月スナップショット |

再生成は `npm run generate:sample-data`。乱数シードは固定のため、同じ出力が再現されます。

---

## デモ進行シナリオ（5 分）

1. **トップ**（`/`）
   - 「サンプルデータで今すぐデモ」をクリック → `/dashboard` へ遷移
   - または CSV / JSON をドラッグ＆ドロップしてアップロード（拡張子違反時はトースト表示）

2. **ダッシュボード**（`/dashboard`）
   - 初回訪問時は react-joyride のツアーが起動（8 ステップ）
   - **異常値アラート**: 上位 3 件、重要度色分け。クリックで該当セクションにスクロール
   - **KPI カード**: プール残高・残存率・90 日以上延滞率・累積デフォルト率・優先受益権残高・
     サービサー回収率の 6 枚、前月比付き
   - **時系列グラフ**: 残高推移 / 延滞推移 / CPR・CDR / 受益権残高 / 累積デフォルト率 の 5 タブ
   - **ポートフォリオ構成**: 金利タイプ / 物件種別 / 都道府県 Top10 / 年齢分布
   - **期限前弁済・デフォルト分析**: 理由別 / 事由別 / 担保処分状況
   - **ウォーターフォール**: 当月 CF 配分 + 劣後配当 24 ヶ月推移
   - **トリガー状況**: 4 トリガーの進捗バー・予測月
   - **個別債権ドリルダウン**: 延滞 / デフォルト をアコーディオン展開、検索・ソート・行クリック
     で詳細ページへ遷移

3. **AI 所見**
   - 「AI 所見を生成」クリック → 5 秒以内に 4 セクション（当月サマリー / 延滞デフォルト /
     トリガー / 翌月留意事項）の所見が表示される
   - textarea で自由編集可
   - 「レポートに反映」で `sessionStorage` 経由で `/report` に所見を引き継ぎ

4. **レポートプレビュー**（`/report`）
   - 表紙 → 案件概要 → サマリー → プール実績 → CF → トリガー → ポートフォリオ → 翌月留意 の
     8 セクションを Markdown で描画
   - 「PDFダウンロード」ボタン → `window.print()` 起動、印刷 CSS が A4・20mm 余白・H2 前
     ページ区切り・ヘッダーフッターを適用
   - 「Markdownをコピー」/「Markdownダウンロード」で `.md` ファイルを取得可能

5. **デモリセット**
   - ダッシュボード右上の「デモをリセット」で sessionStorage をクリアしてトップへ戻る
   - 成功トーストが表示される

---

## テスト実行

```bash
# ユニット（Vitest）
npm test                 # 1 回実行
npm run test:watch       # watch モード

# E2E（Playwright、chromium / firefox / webkit）
npm run test:e2e         # 全ブラウザ
npm run test:e2e:ui      # UI モード
npm run test:e2e:demo    # デモシナリオのみ (tests/e2e/10-demo-scenario.spec.ts)

# 全通し
npm run test:all
```

E2E は `playwright.config.ts` で webServer を自動起動し、`NEXT_PUBLIC_MOCK_LLM=true` を
セットするため LLM 呼び出しは常にモック化されます。失敗時は `test-results/` に動画・
スクリーンショット・トレースが保持されます。

テストフィクスチャは `tests/e2e/fixtures/` に配置（T19）:
- `valid-loan-tape.csv` — 10 行の正常データ
- `invalid-format.csv` — スキーマ違反
- `corrupted.csv` — Shift-JIS 文字化け想定

---

## 主要ディレクトリ

```
app/
  page.tsx                    トップページ（サンプル読込 / アップロード）
  dashboard/
    page.tsx                  ダッシュボード本体
    loan-detail/[id]/page.tsx 個別債権詳細
  report/page.tsx             レポートプレビュー
  api/generate-commentary/    AI 所見生成 API ルート
components/
  dashboard/                  KPI・グラフ・アラート・ドリルダウン等
  report/ReportPreview.tsx    Markdown プレビュー + PDF/MD 操作
lib/
  types.ts                    ドメイン型
  loaders.ts                  CSV/JSON isomorphic ローダー
  metrics.ts                  KPI・ポートフォリオ集計
  anomaly.ts                  異常値検出（8 ルール）
  report-builder.ts           Markdown レポート生成
  formatters.ts               数値整形（3 桁区切り + 億円併記）
  toast.tsx                   トースト通知ラッパー（sonner）
scripts/
  generate-sample-data.ts     決定論的サンプル生成
styles/print.css              印刷用 CSS
tests/
  unit/                       Vitest ユニットテスト
  e2e/                        Playwright E2E + fixtures
public/sample-data/           デモ用 CSV/JSON
```

---

## 開発フロー

- **タスク管理**: `process.md` の通し番号（T01〜T23）で管理。着手時に「進行中」、完了時に
  「完了」へ更新し、個別コミット（`T##: <タスク名> 完了`）する
- **data-testid**: 全インタラクティブ要素に `[画面]-[種類]-[識別子]` 形式で必ず付与。
  E2E の破綻を避けるため省略しない
- **数値フォーマット**: 百万円単位は必ず `1,234百万円 (12.3億円)` を併記（`lib/formatters.fmtMm`）
- **信託用語**: 延滞 / デフォルト / トリガー / ウォーターフォール / 優先劣後受益権 を正確に使用
