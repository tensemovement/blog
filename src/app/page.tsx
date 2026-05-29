import { postService } from "@/services/post.service";
import { PostArticle } from "@/components/post-article";

/**
 * 홈 화면. 진입 시 가장 최신 글(목록의 첫 글)의 본문을 그대로 노출한다.
 * 글 목록 네비게이션은 layout.tsx의 좌측 사이드바가 담당한다.
 */
export default async function Home() {
  const posts = await postService.getAll();
  const first = posts[0];

  if (!first) {
    return (
      <div className="w-full max-w-3xl px-6 py-16">
        <p className="text-muted-foreground">
          아직 글이 없습니다. <code>content/posts/</code>에 마크다운 파일을 추가해보세요.
        </p>
      </div>
    );
  }

  const post = await postService.getBySlug(first.slug);
  if (!post) return null;

  return (
    <div className="w-full max-w-3xl px-6 py-12 sm:px-10">
      <PostArticle post={post} />
    </div>
  );
}
