import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4, Nanum_Myeongjo } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { postService } from "@/services/post.service";
import { PostNav } from "@/components/post-nav";
import "./globals.css";
import "highlight.js/styles/github.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

// 나눔명조. 제목 등 큰 글자 전용 디스플레이 폰트.
const nanumMyeongjo = Nanum_Myeongjo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TT Blog",
  description: "텐시의 글쓰기 공간 — 섹션 없이, 글에만 집중하는 미니멀 블로그.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const posts = await postService.getAll();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} ${nanumMyeongjo.variable} h-full antialiased`}
    >
      {/* 데스크톱: 뷰포트 높이 고정 + 내부 패널만 스크롤. 모바일: 일반 흐름 스크롤 */}
      <body className="flex min-h-screen flex-col bg-background text-foreground md:h-screen md:min-h-0 md:overflow-hidden">
        {/* 전체 폭 헤더: 좌측 로고, 우측 "티티블로그" 제목. 상단 고정 */}
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <Link href="/" aria-label="TT Blog 홈" className="flex items-center">
              <Image
                src="https://cdn.tensemovement.com/tt/logo/tt_logo_text.png"
                alt="tense movement"
                width={301}
                height={217}
                priority
                className="h-12 w-auto"
              />
            </Link>
            <span className="font-display text-2xl font-bold tracking-tight">
              티티블로그
            </span>
          </div>
        </header>

        {/* 2단 구성: 좌측 제목 네비게이션(독립 스크롤) + 우측 콘텐츠(독립 스크롤) */}
        <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
          <aside className="shrink-0 border-b border-border px-4 py-6 md:w-80 md:overflow-y-auto md:border-b-0 md:border-r">
            <PostNav posts={posts} />
          </aside>
          <main className="min-w-0 flex-1 md:overflow-y-auto">
            {children}

            <footer className="border-t border-border">
              <div className="w-full px-6 py-8 text-center text-sm text-muted-foreground">
                © {"2026"} TT Blog · 텐시
              </div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
