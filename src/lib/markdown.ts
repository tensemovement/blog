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
/**
 * 섹션 헤딩 "키워드: 설명"을 타이틀 + 부제 2단 구조로 변환한다.
 *
 * `<h2>발단: 초안은 되는데 발송이 안 된다</h2>` →
 * `<h2 class="section-heading"><span class="heading-title">발단</span>` +
 * `<span class="heading-subtitle">초안은 되는데 발송이 안 된다</span></h2>`
 *
 * 콜론은 화면에 노출되지 않고 구분자로만 쓰인다(시각 스타일은 globals.css). 콜론이
 * 없는 헤딩(예: `마무리`)이나 인라인 마크업(`<code>` 등)이 섞인 헤딩은 그대로 둔다.
 */
function splitHeadingSubtitle(html: string): string {
  return html.replace(
    /<(h2|h3)>([^<:]+): ([^<]+)<\/\1>/g,
    '<$1 class="section-heading"><span class="heading-title">$2</span><span class="heading-subtitle">$3</span></$1>',
  );
}

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);

  return splitHeadingSubtitle(String(file));
}
