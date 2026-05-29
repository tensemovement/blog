import { z } from "zod";

/**
 * 게시글 입력값 검증 스키마.
 * API 라우트나 폼 제출 시 외부 입력을 신뢰하기 전에 이 스키마로 파싱한다.
 */
export const postInputSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요.").max(120),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."),
  excerpt: z.string().max(300).optional().default(""),
  content: z.string().min(1, "본문을 입력해주세요."),
  tags: z.array(z.string().min(1)).default([]),
});

export type PostInput = z.infer<typeof postInputSchema>;
