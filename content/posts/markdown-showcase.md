---
title: "마크다운으로 쓸 수 있는 것들"
excerpt: "표, 코드 블록, 인용 — 글을 쓰는 데 필요한 것들은 대부분 마크다운 안에 있습니다."
date: 2026-02-01
tags: [markdown, writing]
---

글을 쓰는 데 필요한 표현은 마크다운만으로 거의 해결됩니다.
이 글은 렌더링이 잘 되는지 확인하는 용도이기도 합니다.

## 코드 블록

구문 강조가 적용됩니다.

```typescript
async function getPost(slug: string): Promise<Post | null> {
  const posts = await postService.getAll();
  return posts.find((p) => p.slug === slug) ?? null;
}
```

## 표 (GFM)

| 기능        | 지원 여부 |
| ----------- | --------- |
| 표          | ✅        |
| 체크박스    | ✅        |
| 구문 강조   | ✅        |

## 목록과 인용

1. 첫 번째
2. 두 번째
   - 중첩된 항목
   - 또 하나

> 단순함은 기능의 부재가 아니라, 군더더기의 부재다.

링크도 [평범하게](https://nextjs.org) 동작합니다.
