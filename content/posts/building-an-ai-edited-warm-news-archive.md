---
title: "편집자가 AI 루틴인 뉴스 사이트: DB 없이 매일 갱신되는 따뜻한 뉴스 아카이브"
excerpt: "소소.소는 따뜻한 국내 소식만 모아 다시 쓰는 아카이브입니다. 매일 아침 기사를 고르고 따뜻함을 판단하고 다시 쓰는 '편집' 일은 AI 루틴이 맡고, 코드는 화이트리스트·스키마·용량 같은 협상 불가능한 제약만 강제합니다. DB 없이 S3 누적 스토어, 서버 머지, 3중 Zod 스키마로 이 역할 분담을 어떻게 떠받쳤는지 정리했습니다."
date: 2026-06-05
tags: [nextjs, architecture, zod, llm-agent]
---

**소소.소**(소소한 소식)는 단순한 사이트입니다. 따뜻한 국내 뉴스만 모아, 원문을 그대로 옮기지 않고 차분히 다시 쓴 다음, 반드시 출처를 링크로 밝힙니다. 정치·갈등·사건사고는 들어오지 않습니다. "여기 오면 늘 마음이 따뜻해진다"가 이 사이트가 파는 유일한 신뢰입니다.

화면은 평범한 뉴스 피드입니다. 흥미로운 건 그 뒤입니다. 이 사이트에는 **데이터베이스도, 사람 편집자도, CMS도 없습니다.** 매일 아침 기사를 고르고, 따뜻한지 판단하고, 다시 쓰는 "편집" 일은 **AI 루틴**이 맡습니다. 코드는 편집을 하지 않습니다. 코드가 하는 일은 그 AI가 넘지 말아야 할 선을 강제하는 것뿐입니다.

이 글은 "판단은 AI에게, 제약은 코드에게"라는 역할 분담을 실제로 어떻게 구조로 옮겼는지에 대한 기록입니다.

## 발단: 편집이라는 일을 누가 하나

따뜻한 뉴스 아카이브를 만들려면 매일 누군가 이 일을 해야 합니다.

1. 최근 48시간 안에 보도된 한국 언론사 기사를 훑는다.
2. 그중 **따뜻한** 것만 고른다. (이건 규칙으로 못 적습니다. 판단입니다.)
3. **국내에서 일어난** 일만 남긴다. (한국 언론사도 해외 소식을 보도하니까요.)
4. 같은 사건의 중복을 제거하고 우선순위를 매긴다.
5. 원문을 가져와 "전문적이되 따뜻한" 톤으로 **다시 쓴다.** (복붙은 금지.)

2~5번은 전부 판단이 들어가는 일입니다. 규칙 엔진으로는 못 합니다. 그렇다고 사람을 매일 붙이면 사이트가 아니라 일자리가 됩니다.

그래서 결정한 구조가 이렇습니다. **편집 판단은 매일 도는 Claude 루틴이 하고, 코드는 그 결과물이 만족해야 할 제약을 강제한다.** 루틴은 저장소 안의 명세 파일(`.claude/routines/refresh-sososo.md`) 하나를 매일 읽고 그대로 수행합니다. 명세에는 "이 소식을 읽고 나면 마음이 따뜻해지는가?"를 스스로 묻는 따뜻함 게이트, 국내 한정 필터, 재작성 규칙이 적혀 있습니다.

판단은 부드럽고(AI), 제약은 단단해야(코드) 합니다. 나머지는 전부 이 경계를 어디에 긋느냐의 문제였습니다.

## 설계 1: DB를 두지 않는다(S3 누적 스토어 + 시드 폴백)

뉴스가 매일 12건씩 쌓이는데 DB가 없다는 게 이상하게 들릴 수 있습니다. 하지만 이 데이터에는 관계도, 쿼리도, 트랜잭션도 없습니다. 그냥 "지금까지 모인 따뜻한 뉴스 목록" 하나입니다. 그렇다면 진실의 원본(single source of truth)은 **S3에 올라간 JSON 파일 하나**면 충분합니다.

읽는 쪽 서비스는 이렇게 생겼습니다. S3가 설정돼 있으면 거기서 읽고, 없거나 아직 한 번도 업로드된 적이 없으면 번들된 시드 데이터로 폴백합니다.

```typescript
export const loadNews = cache(async (): Promise<StoredNews> => {
  const cfg = getS3Config();
  if (!cfg) {
    return loadSeed(); // 로컬 dev: env 없음 → 시드로 렌더
  }
  try {
    return await readFromS3(cfg);
  } catch (err: unknown) {
    if (isMissingKeyError(err)) {
      return loadSeed(); // 첫 배포: 아직 객체 없음 → 시드로 렌더
    }
    throw err; // 진짜 장애는 삼키지 않는다
  }
});
```

이 작은 함수에 세 가지 판단이 들어 있습니다.

- **`cache()`**: React의 요청 단위 캐시입니다. 한 페이지 렌더에서 홈·태그·히어로가 각각 피드를 읽어도 S3는 한 번만 칩니다.
- **시드 폴백**: env가 없는 로컬 개발과, 루틴이 아직 한 번도 안 돈 첫 배포에서도 사이트가 빈 화면이 아니라 콘텐츠를 보여줍니다. "설정이 덜 됐을 때도 그럴듯하게 돈다"는 건 운영 부담을 크게 줄입니다.
- **`isMissingKeyError`만 폴백**: "객체가 없음"(첫 배포)과 "S3가 진짜 죽음"(장애)은 다릅니다. 전자만 시드로 우회하고, 후자는 `throw`로 드러냅니다. 장애를 폴백으로 덮으면 "왜 옛날 뉴스만 나오지?"를 영영 디버깅하게 됩니다.

DB를 안 쓴 대가는 "조회/필터를 메모리에서 한다"는 것뿐인데, 피드 상한이 300건이라 비용이 아닙니다.

## 설계 2: 머지는 클라이언트가 아니라 서버가 한다

가장 중요한 비대칭이 여기 있습니다. **매일 도는 루틴은 "오늘의 배치"만 만듭니다.** 기존 누적본을 읽지도, 합치지도 않습니다. 그 일은 전부 Vercel에 배포된 `POST /api/upload`가 합니다.

```
루틴(AI)         : 오늘 고른 따뜻한 뉴스 최대 12건을 JSON으로 만들어 POST
서버(/api/upload): 기존 누적본 GET
                 → canonical URL로 dedup 머지
                 → 300건으로 트림
                 → S3에 PUT
                 → 관련 경로 revalidate
```

왜 루틴에게 머지를 안 시켰을까요. 루틴이 누적본을 읽어 합쳐 통째로 덮어쓰게 하면, **루틴 한 번의 실수가 전체 아카이브를 날립니다.** 루틴은 매일 새로 도는 비결정적(non-deterministic) 에이전트입니다. 거기에 "전체를 덮어쓸 권한"을 주면 안 됩니다.

대신 루틴에게는 "오늘 만든 것만 보낼" 권한만 줍니다. 누적·dedup·트림 같은 **되돌릴 수 없는 연산은 결정적인 서버 코드 한 곳에 모읍니다.** 머지 로직은 순수 함수라 단위 테스트로 못을 박을 수 있고(`tests/unit/merge.test.ts`), AWS 자격증명은 Vercel 시크릿에만 있고 루틴은 토큰 하나로 인증된 HTTP POST만 보냅니다. 권한이 가장 약한 쪽에 가장 비결정적인 행위자를 둔 셈입니다.

머지 자체는 canonical URL을 키로 하는 Map 한 장입니다.

```typescript
export function mergeAccumulated(
  prev: StoredNews | null,
  incoming: IncomingNews,
  now: string,
): StoredNews {
  const byKey = new Map<string, NewsItem>();
  for (const item of prev?.items ?? []) {
    byKey.set(canonicalizeUrl(item.url), item);
  }
  for (const raw of incoming.items) {
    const key = canonicalizeUrl(raw.url);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        title: raw.title, dek: raw.dek, body: raw.body, // 표시 필드는 최신본으로 갱신
        tags: raw.tags, publishedAt: raw.publishedAt,
        source: raw.source, sourceDomain: raw.sourceDomain,
        imageUrl: raw.imageUrl ?? existing.imageUrl,
        lastSeenAt: now,                    // 추적 필드는 누적
        seenCount: existing.seenCount + 1,
      });
    } else {
      byKey.set(key, promoteIncoming(raw, now));
    }
  }
  return {
    generatedAt: incoming.generatedAt,
    timezone: incoming.timezone,
    items: Array.from(byKey.values())
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
      .slice(0, FEED_CAP), // 300건 초과분은 오래된 것부터 버림
  };
}
```

같은 기사가 며칠 연속 잡히면 `firstSeenAt`(최초 발견 시각)은 **보존**하고 `seenCount`만 올립니다. 그래서 "여러 매체가 며칠째 다루는 화제"가 피드 위로 떠오르지 않고 처음 발견된 자리에 머뭅니다. 정렬은 `firstSeenAt` 내림차순이라 "새로 들어온 것이 위"라는 직관이 유지됩니다.

### 같은 기사인지 어떻게 아나: URL 정규화

dedup의 키는 URL인데, 같은 기사라도 URL은 매번 조금씩 다릅니다. `utm_source=...` 같은 추적 파라미터가 붙거나, 끝에 슬래시가 있거나, 쿼리 순서가 바뀝니다. 그래서 **비교용 정규화 형태**를 따로 만듭니다. 표시·클릭용 원본 URL은 그대로 두고요.

```typescript
export function canonicalizeUrl(input: string): string {
  const u = new URL(input);
  u.host = u.host.toLowerCase();
  for (const key of Array.from(u.searchParams.keys())) {
    if (STRIP_PARAM_PATTERNS.some((re) => re.test(key))) {
      u.searchParams.delete(key); // utm_*, fbclid, gclid, ref ... 제거
    }
  }
  u.searchParams.sort();           // 쿼리 순서 정규화
  u.hash = "";                     // 프래그먼트 제거
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, ""); // 끝 슬래시 제거(루트 제외)
  }
  return u.toString();
}
```

핵심은 "정규화는 **비교에만** 쓰고, 저장되는 건 원본"이라는 분리입니다. 추적 파라미터를 지운 URL을 저장해 버리면 클릭 시 출처 매체의 유입 분석이 깨질 수 있으니까요.

## 설계 3: 같은 데이터, 세 개의 스키마

이 시스템에서 뉴스 한 건은 생애주기에 따라 모양이 미묘하게 다릅니다. Zod 스키마가 셋인 이유입니다.

| 스키마 | 누가 만드나 | 추적 필드(`firstSeenAt` 등) |
|---|---|---|
| `IncomingNews` | 루틴이 POST | **optional**(서버가 채울 거니까) |
| `StoredNews` | 서버가 머지 후 저장 | **required**(누적본은 항상 완전해야) |
| `LoadedNews` | 앱이 S3에서 읽을 때 | **optional → transform으로 채움** |

베이스 필드는 공유하고 추적 필드만 갈아끼웁니다.

```typescript
const trackingFieldsOptional = {
  firstSeenAt: z.string().datetime().optional(),
  lastSeenAt: z.string().datetime().optional(),
  seenCount: z.number().int().min(1).optional(),
};
const trackingFieldsRequired = {
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  seenCount: z.number().int().min(1),
};

// 들어오는 배치: 추적 필드 없어도 통과
export const IncomingNewsItemSchema = z.object({ ...baseFields, ...trackingFieldsOptional });
// 저장본: 추적 필드 필수
export const NewsItemSchema = z.object({ ...baseFields, ...trackingFieldsRequired });
```

가장 영리한 건 세 번째, `Loaded`입니다. 추적 필드라는 개념이 생기기 *전*에 저장된 옛 데이터가 S3에 있을 수 있습니다. 그걸 읽을 때 깨지면 안 되므로, optional로 받되 **`.transform()`으로 빈 값을 메워** 소비자에게는 언제나 완전한 형태를 돌려줍니다.

```typescript
const LoadedNewsItemSchema = z
  .object({ ...baseFields, ...trackingFieldsOptional })
  .transform((item) => {
    const firstSeenAt = item.firstSeenAt ?? item.publishedAt; // 없으면 발행시각으로
    const lastSeenAt = item.lastSeenAt ?? firstSeenAt;
    const seenCount = item.seenCount ?? 1;
    return { ...item, firstSeenAt, lastSeenAt, seenCount };
  });
```

스키마가 "검증"만 하는 게 아니라 **마이그레이션 계층**을 겸합니다. 레거시 데이터를 별도 백필 스크립트 없이 읽는 순간 정규화하는 것이죠. 덕분에 "데이터 모델을 바꿨더니 옛 객체가 안 읽힌다"는 흔한 사고가 구조적으로 막힙니다.

이 스키마들은 또 한 가지를 강제합니다. **AI가 만든 출력을 신뢰하지 않는다**는 원칙입니다. 루틴은 똑똑하지만 환각을 봅니다. 그래서 코드가 못을 박습니다.

```typescript
title: z.string().min(1).max(120),       // 제목 길이
dek:   z.string().min(1).max(180),       // 카드 요약
body:  z.string().min(200).max(1500),    // 본문 — 너무 짧지도 길지도 않게
tags:  z.array(z.enum(WARM_TAGS)).min(1).max(4), // 통제된 태그만
sourceDomain: z.string().refine((d) => ALLOWED_DOMAINS.has(d), {
  message: "sourceDomain must be a whitelisted Korean news outlet",
}),
url: httpsUrl,                            // https 강제
```

루틴이 화이트리스트 밖 매체를 끌어오거나, 본문을 30자만 쓰거나, 멋대로 새 태그를 지어내면 **업로드 자체가 400으로 거부됩니다.** 판단은 AI가 하되, 그 판단이 만족해야 할 경계는 코드가 정합니다.

## 디테일: 통제된 태그 어휘가 세 가지를 동시에 푼다

태그를 자유 입력이 아니라 16개 고정 어휘(`나눔`, `선행`, `이웃`, `환경`...)로 못박은 결정 하나가 세 문제를 한꺼번에 해결합니다.

```typescript
export const WARM_TAGS = [
  "나눔", "선행", "이웃", "공동체", "자원봉사", "환경", "동물", "회복",
  "극복", "청년", "교육", "의료", "가족", "반려", "지역", "문화",
] as const;
```

1. **AI 출력 안정화**: 위 Zod `z.enum(WARM_TAGS)`이 루틴의 태그를 이 집합으로 가둡니다. "선한 뉴스" "착한소식" 같은 제멋대로 변주가 안 생깁니다.
2. **정적 생성**: 태그 집합이 유한하고 고정이라 `/tags/[tag]` 페이지를 빌드 타임에 전부 생성할 수 있습니다.
3. **빠짐없는 색 매핑**: 태그마다 파스텔 색을 주는데, `Record<WarmTag, TagStyle>` 타입이라 어휘를 하나 추가하면 색을 안 정한 경우 **컴파일이 실패**합니다.

여기에 TailwindCSS v4의 함정이 하나 얽힙니다. v4는 동적으로 조립한 클래스명(`bg-${color}-100`)을 purge해 버려서 런타임에 색이 사라집니다. 그래서 클래스명 대신 **정적 스타일 객체**를 인라인으로 박습니다.

```typescript
export const TAG_STYLES: Record<WarmTag, TagStyle> = {
  나눔: { bg: "#FCE7D8", fg: "#9A4A1E" },
  선행: { bg: "#FBE3C7", fg: "#94511A" },
  // ...16개 전부
};
```

"통제된 어휘"라는 작은 제약 하나가 타입 안전·정적 생성·스타일링까지 줄줄이 단정하게 만듭니다.

## 함정: 업로드 라우트는 적대적 입력을 가정한다

`/api/upload`는 인터넷에 열린 쓰기 엔드포인트입니다. 여기서 막은 것들:

**토큰 비교는 상수 시간으로.** `===`로 비교하면 일치하는 글자 수에 따라 응답 시간이 미세하게 달라져 타이밍 공격에 토큰이 새어 나갈 수 있습니다.

```typescript
function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf); // node:crypto
}
```

**용량 한도 두 겹.** `Content-Length` 헤더로 한 번, 실제로 읽은 본문 길이로 또 한 번 막습니다. 헤더는 거짓말할 수 있으니까요. 머지 *후* 누적본이 4MiB를 넘으면 `507`로 거부해 S3에 비대한 객체가 쌓이는 것도 막습니다.

**머지 후 재검증.** 들어온 배치를 `IncomingNewsSchema`로 검증하고, 머지한 결과를 다시 `StoredNewsSchema`로 검증합니다. 내 코드가 만든 결과라도 한 번 더 못을 박는 겁니다.

**revalidate는 재시도 + 백오프.** 저장은 됐는데 ISR revalidate가 실패하면 사이트에 옛 내용이 남습니다. 그래서 최대 3회 지수 백오프로 재시도하고, 실패해도 업로드 자체는 성공으로 보고하되 응답에 실패 경로를 담아 보냅니다.

```typescript
const pathsToRevalidate = [
  "/", "/today.json",
  ...Array.from(touchedTags).map((t) => `/tags/${encodeURIComponent(t)}`),
  ...Array.from(detailPaths), // /news/{id} — 뒤늦게 채운 칸
];
```

이번 배치가 건드린 태그 페이지만 골라 revalidate한다는 점도 작은 디테일입니다. 16개를 전부 무효화하지 않고 실제로 바뀐 경로만 칩니다.

### 뒤늦게 잡은 버그: 상세 페이지가 빠져 있었다

위 목록의 마지막 줄(`detailPaths`)에는 한동안 **빈 칸**이 있었습니다. 홈(`/`), JSON 프록시(`/today.json`), 태그 페이지는 갱신했는데, 정작 기사 본문이 보이는 **상세 페이지(`/news/[id]`)를 빼먹었습니다.** 상세 페이지도 `revalidate = false`로 빌드 타임에 정적 생성되는데 revalidate 목록에 없었으니, 업로드로 본문을 다시 써도 상세 페이지는 **옛 글을 계속 보여줬습니다.**

증상이 고약했습니다. `/today.json`은 동적이라 즉시 새 내용이 나오는데 상세 페이지만 옛날이었거든요. 여기에 CDN 엣지 캐시까지 끼면 "어디는 바뀌고 어디는 안 바뀌는" 혼란이 한 겹 더 쌓입니다. 결국 배치에 포함된 항목의 상세 경로를 revalidate 목록에 더해 막았습니다.

```typescript
for (const item of storedResult.data.items) {
  for (const tag of item.tags) touchedTags.add(tag);
  detailPaths.add(`/news/${item.id}`); // 빠뜨렸던 그 한 줄
}
```

교훈은 단순합니다. **`revalidate = false` + 온디맨드 갱신을 쓰면, 갱신 트리거가 닿지 않는 정적 경로는 영원히 옛날입니다.** 데이터가 바뀐 것과 화면이 바뀐 것은 다른 사건입니다.

## 작은 카피 하나의 무게

기술 외에 한 가지. 출처 표기 문구는 코드에 이렇게 고정돼 있습니다.

> "이 소식은 \<매체\> 보도를 소소.소가 요약 정리했습니다."

git history를 보면 이 한 줄은 계속 깎여 왔습니다. 처음엔 "따뜻한 시선으로 다시 정리"처럼 자기수식이 붙어 있었는데, 이후 커밋들에서 "고정 주기" 주장, AI 티 나는 표현과 함께 **담백하게 사실만 밝히도록** 덜어냈습니다(`feat: drop fixed-cadence claims`, `de-AI copy cleanups`). 가장 최근엔 "다시 정리한 것입니다"를 "**요약 정리했습니다**"로 바꿨습니다. 한 일을 더 정확하게(요약), 더 군더더기 없이 말하려는 손질입니다. 출처를 다시 쓰는 사이트일수록 "우리가 다시 썼다"는 사실을 군더더기 없이 밝히는 게 신뢰의 핵심이라는 판단입니다. 따뜻함은 카피로 주장하는 게 아니라 고른 뉴스로 증명하는 것이니까요.

## 명세도 코드처럼: 작성 규칙을 단일 출처로

"판단은 AI"라고 했지만, 그 판단을 이끄는 **작성 규칙** 자체도 관리 대상입니다. 그리고 이건 평범한 소프트웨어 문제로 수렴했습니다. 중복과 드리프트요.

따뜻한 뉴스를 쓰는 규칙(톤·사실 보존·문단·길이)은 세 군데서 쓰입니다. 수동 발행 스킬, 매일 도는 루틴, 그리고 발행본을 다시 다듬는 리뷰어. 처음엔 세 파일에 규칙을 각각 적어 뒀는데, 손대다 보니 **같은 규칙이 파일마다 어긋났습니다.** 한쪽은 "문단은 이어 써도 무방", 다른 쪽은 "2~4문단으로 분리"로 갈리는 식입니다.

그래서 규칙을 `.claude/shared/sososo-writing-rules.md` **한 파일로 모으고, 세 소비자가 전부 이걸 참조**하게 했습니다. 코드에서 상수를 한곳에 두는 것과 똑같습니다. 규칙을 바꿀 땐 이 파일만 고치면 세 경로에 동시에 적용됩니다.

규칙 자체도 git 위에서 진화합니다.

- **대표 이미지 폴백**: og:image가 없으면 본문에서 처음 나오는 콘텐츠 이미지를 쓰도록 더했습니다. 로고·트래킹 픽셀 같은 건 건너뜁니다. 이미지 없는 카드가 줄었어요.
- **최소 문단**: 본문을 "최소 3~4문단으로 충분히" 나누게 해, 한 덩어리로 붙어 버리는 걸 막았습니다.
- **어투**: "경어체로 통일"에서 출발했다가, 너무 딱딱해서 `~요`·`~죠`·`~답니다` 같은 어미를 **섞어 편안하게** 읽히도록 바꿨습니다. 다만 곧 단서를 달았죠. 평서형 반말(`이른다`, `받았다`)은 금지해 경어는 유지하고, `~답니다`·`~랍니다`는 느끼해지지 않게 **본문 1~2개·요약엔 금지**로 절제합니다.

규칙을 문서로만 바꾸는 데서 끝내지 않았습니다. 바꿀 때마다 **이미 발행된 글도 새 규칙으로 다시 써서** 올립니다. 명세와 콘텐츠가 따로 노는 걸 막는, 작지만 중요한 습관입니다.

## 마무리

소소.소를 만들며 가장 오래 머문 질문은 "이 일은 AI가 해야 하나, 코드가 해야 하나"였습니다. 답은 대체로 이렇게 갈렸습니다.

- **판단·생성은 AI에게.** 따뜻함의 판별, 국내/해외 구분, 재작성. 전부 규칙으로 못 적는 일입니다.
- **제약·되돌릴 수 없는 연산은 코드에게.** 화이트리스트, 스키마, 용량 한도, 머지, dedup, 트림. 전부 한 번 틀리면 데이터가 상하는 일입니다.

그 경계를 구조로 옮긴 게 이 프로젝트의 전부입니다. 비결정적인 행위자(매일 새로 도는 LLM 루틴)에게는 권한을 가장 적게 주고, 되돌릴 수 없는 행위는 결정적이고 테스트 가능한 한 곳에 모았습니다. DB가 없어도, 사람 편집자가 없어도 사이트가 매일 조용히 갱신되는 건 그 분담 덕분입니다.

AI를 파이프라인에 넣는 일이 점점 흔해집니다. 그때 코드가 할 일은 AI를 대신하는 게 아니라, **AI가 넘으면 안 되는 선을 단단하게 지키는 것**이라는 생각이 듭니다.
