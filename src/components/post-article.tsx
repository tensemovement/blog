import Image from "next/image";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Post } from "@/types/post";
import { renderMarkdown } from "@/lib/markdown";

/**
 * 단일 게시글 본문 렌더러 (서버 컴포넌트).
 *
 * 홈 화면(첫 글 노출)과 상세 페이지(/posts/[slug])가 동일한 모양으로 글을
 * 보여주므로, 렌더링 로직을 한 곳으로 모아 중복을 없앤다. 마크다운 → HTML 변환은
 * 서버에서 수행하므로 async 컴포넌트로 둔다.
 */
export async function PostArticle({ post }: { post: Post }) {
  const html = await renderMarkdown(post.content);

  return (
    <article>
      <header>
        <time
          dateTime={post.date.toISOString()}
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          {format(post.date, "yyyy. M. d.", { locale: ko })}
        </time>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Image
            src="/avatar.png"
            alt="텐시"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-border object-cover"
          />
          <span className="text-sm font-medium text-foreground">텐시</span>
        </div>
      </header>

      <hr className="my-10 border-border" />

      <div
        className="article-body prose prose-zinc max-w-none prose-headings:font-serif prose-headings:tracking-tight prose-pre:bg-muted prose-pre:text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {post.tags.length > 0 && (
        <ul className="mt-12 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li key={tag} className="text-sm text-brand">
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
