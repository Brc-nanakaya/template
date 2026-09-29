import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { Toaster } from "sonner";
import { AppHeader } from "@/components/auth/AppHeader";
import { getCurrentUser } from "@/lib/auth/server";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});


export const metadata: Metadata = {
  title: "brc-sales-hub",
  description: "Next.js + TypeScript + Tailwind CSS の研修用テンプレート",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ログイン中のみ共通ヘッダーを出す（/login では null になるので非表示）
  const user = await getCurrentUser();

  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="font-sans">
        {user && <AppHeader user={user} />}
        {children}
        <Toaster position="top-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
