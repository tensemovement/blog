"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PostMeta } from "@/types/post";

/**
 * 좌측 제목 네비게이션.
 *
 * 글 목록을 제목만 나열한다. 데이터는 서버(layout)에서 props로 받고, 현재 보고
 * 있는 글의 강조(active)만 클라이언트에서 `usePathname`으로 처리하므로
 * "use client"가 필요하다.
 *
 * 홈("/")에서는 첫 글이 본문으로 노출되므로, 첫 글을 활성 항목으로 표시한다.
 */
export function PostNav({ posts }: { posts: PostMeta[] }) {
  const pathname = usePathname();
  const activeSlug =
    pathname === "/" ? posts[0]?.slug : pathname.replace(/^\/posts\//, "");

  return (
    <nav aria-label="글 목록">
      <ul className="flex flex-col gap-1">
        {posts.map((post, index) => {
          const isActive = post.slug === activeSlug;
          // 홈에서 첫 글은 본문이 이미 보이므로 "/"로 링크해 중복 경로를 피한다.
          const href = index === 0 ? "/" : `/posts/${post.slug}`;

          return (
            <li key={post.slug}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm leading-snug transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {post.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
