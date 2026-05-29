/**
 * 블로그 게시글 도메인 타입.
 *
 * 글은 `content/posts/*.md` 파일에서 온다. frontmatter가 메타데이터(PostMeta)를,
 * 본문이 마크다운(content)을 제공한다. 목록 화면은 본문이 필요 없으므로 메타만
 * 다루고, 상세 화면만 본문까지 가진 Post를 사용한다.
 *
 * 추후 DB(Prisma)나 CMS로 교체하더라도 이 형태로 매핑하면 화면 코드는 영향받지 않는다.
 */
export interface PostMeta {
  /** 파일명에서 파생된 URL 슬러그 (예: `hello-world.md` → `hello-world`) */
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  /** frontmatter `date`에서 파싱한 발행일 */
  date: Date;
}

export interface Post extends PostMeta {
  /** 원본 마크다운 본문 (렌더링은 src/lib/markdown.ts에서 수행) */
  content: string;
}
