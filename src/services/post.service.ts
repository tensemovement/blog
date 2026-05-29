import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Post, PostMeta } from "@/types/post";

/**
 * 게시글 서비스 (Service 패턴).
 *
 * 데이터 접근 로직을 컴포넌트 밖으로 분리한다. 데이터 소스는 `content/posts/`의
 * 마크다운 파일이며, 파일을 추가하면 글이 추가된다. 화면은 이 인터페이스만
 * 의존하므로, 추후 CMS나 DB(Prisma)로 교체해도 변경 범위가 이 파일에 한정된다.
 */
const POSTS_DIR = path.join(process.cwd(), "content", "posts");

/** frontmatter의 임의 입력을 PostMeta 형태로 정규화한다. */
function toMeta(slug: string, data: Record<string, unknown>): PostMeta {
  const tags = Array.isArray(data.tags)
    ? data.tags.map((t: unknown) => String(t))
    : [];

  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    excerpt: typeof data.excerpt === "string" ? data.excerpt : "",
    tags,
    date: data.date ? new Date(data.date as string) : new Date(0),
  };
}

/** content/posts 의 모든 마크다운 파일명(슬러그)을 반환한다. */
async function listSlugs(): Promise<string[]> {
  if (!existsSync(POSTS_DIR)) return [];
  const entries = await readdir(POSTS_DIR);
  return entries
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""));
}

async function readPost(slug: string): Promise<Post | null> {
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  if (!existsSync(filePath)) return null;
  const raw = await readFile(filePath, "utf8");
  const { data, content } = matter(raw);
  return { ...toMeta(slug, data), content };
}

export const postService = {
  /** 최신순으로 정렬된 모든 게시글의 메타데이터를 반환한다. */
  async getAll(): Promise<PostMeta[]> {
    const slugs = await listSlugs();
    const posts = await Promise.all(slugs.map((slug) => readPost(slug)));
    return posts
      .filter((post): post is Post => post !== null)
      .map(({ slug, title, excerpt, tags, date }) => ({
        slug,
        title,
        excerpt,
        tags,
        date,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  },

  /** 슬러그로 단일 게시글(본문 포함)을 조회한다. 없으면 null. */
  async getBySlug(slug: string): Promise<Post | null> {
    return readPost(slug);
  },

  /** 특정 태그를 가진 게시글 메타데이터만 반환한다. */
  async getByTag(tag: string): Promise<PostMeta[]> {
    const all = await this.getAll();
    return all.filter((post) => post.tags.includes(tag));
  },
};
