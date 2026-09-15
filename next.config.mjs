/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker イメージを小さくするため、実行に必要なファイルだけを .next/standalone に出力する。
  // AWS（ECS / App Runner）と Azure（Container Apps / App Service）はどちらも
  // このコンテナをそのまま動かす
  output: "standalone",
  experimental: {
    // @google/adk は Node.js 専用依存を含むため webpack バンドル対象から除外する
    serverComponentsExternalPackages: ["@google/adk"],
  },
};

export default nextConfig;
