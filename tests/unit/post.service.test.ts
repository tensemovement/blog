import { describe, it, expect } from "vitest";
import { postService } from "@/services/post.service";

describe("postService", () => {
  it("returns all posts from content/posts, newest first", async () => {
    const posts = await postService.getAll();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);

    for (let i = 1; i < posts.length; i++) {
      expect(posts[i - 1].date.getTime()).toBeGreaterThanOrEqual(
        posts[i].date.getTime(),
      );
    }
  });

  it("finds a post by slug and includes its raw content", async () => {
    const all = await postService.getAll();
    const first = all[0];
    const found = await postService.getBySlug(first.slug);
    expect(found?.slug).toBe(first.slug);
    expect(typeof found?.content).toBe("string");
    expect(found?.content.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown slug", async () => {
    expect(await postService.getBySlug("does-not-exist")).toBeNull();
  });

  it("filters posts by tag", async () => {
    const tagged = await postService.getByTag("nextjs");
    expect(tagged.every((post) => post.tags.includes("nextjs"))).toBe(true);
  });
});
