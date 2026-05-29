import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

/**
 * 마크다운 문자열을 안전한 HTML로 변환한다.
 *
 * 파이프라인: remark-parse → remark-gfm(표/체크박스 등) → remark-rehype →
 * rehype-highlight(코드 구문 강조) → rehype-stringify.
 *
 * 콘텐츠는 저장소 안의 신뢰된 로컬 파일(`content/posts/*.md`)이므로 결과 HTML은
 * 상세 페이지에서 dangerouslySetInnerHTML로 렌더한다.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}
