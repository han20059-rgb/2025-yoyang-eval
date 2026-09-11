import { Noto_Sans_KR } from "next/font/google";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { ProgressProvider } from "@/components/ProgressProvider";
import "./globals.css";

const noto = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "2025 노인요양시설 평가 매뉴얼",
  description: "2021·2025 시설급여 평가 비교와 지표 검색",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${noto.className} h-full`}>
      <body className="min-h-full">
        <ProgressProvider>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </ProgressProvider>
      </body>
    </html>
  );
}
