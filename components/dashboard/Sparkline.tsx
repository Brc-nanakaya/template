/**
 * 依存なしの SVG ベース スパークライン。recharts の初期化コストを避け、
 * 数ポイントのトレンドを KPI カードに軽量に埋め込むために使用する。
 * `values` が全て 0 の場合はゼロラインを描画する。
 */
export interface SparklineProps {
  values: number[];
  stroke?: string;
  fill?: string;
  width?: number;
  height?: number;
  /** 残存率のように値域が 0-1 で既知のときに指定（なければ min/max 自動算出）。 */
  domain?: [number, number];
}

export function Sparkline({
  values,
  stroke = "#0B2545",
  fill = "rgba(11,37,69,0.08)",
  width = 120,
  height = 34,
  domain,
}: SparklineProps) {
  if (values.length === 0) return null;
  const n = values.length;
  const min = domain ? domain[0] : Math.min(...values);
  const max = domain ? domain[1] : Math.max(...values);
  const range = max - min || 1;
  const stepX = n > 1 ? width / (n - 1) : 0;
  const toY = (v: number) => height - ((v - min) / range) * (height - 4) - 2;

  const points = values.map((v, i) => [i * stepX, toY(v)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(n > 1 ? width : 0).toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="block"
    >
      <path d={area} fill={fill} stroke="none" />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
