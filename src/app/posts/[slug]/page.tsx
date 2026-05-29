import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { postService } from "@/services/post.service";
import { PostArticle } from "@/components/post-article";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await postService.getAll();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await postService.getBySlug(slug);
  if (!post) return { title: "글을 찾을 수 없습니다 · TT Blog" };
  return {
    title: `${post.title} · TT Blog`,
    description: post.excerpt,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await postService.getBySlug(slug);
  if (!post) notFound();

  return (
    <div className="w-full max-w-3xl px-6 py-12 sm:px-10">
      <PostArticle post={post} />
    </div>
  );
}
