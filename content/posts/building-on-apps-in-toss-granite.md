---
title: "토스 미니앱을 앱인토스(Granite) 위에서 만들기"
excerpt: "3초 클래식 클립을 듣고 작곡가를 맞히는 미니앱을 앱인토스 플랫폼 위에 올렸습니다. 랭킹·광고·공유를 직접 만드는 대신 플랫폼이 주는 네이티브 기능에 얹는 과정에서, '플랫폼 위에서 개발한다는 것'이 무엇인지 반복해서 마주쳤습니다. 그 패턴을 정리한 기록입니다."
date: 2026-05-30
tags: [apps-in-toss, granite, react-native, mini-app]
---

3초짜리 클래식 음원을 듣고 작품을 맞히는 4지선다 퀴즈를 만들었습니다. 100문제를 난이도
오름차순으로 푸는 단순한 게임입니다. 다만 이 앱은 독립 앱스토어 앱이 아니라 **토스 앱 안에서
도는 미니앱**입니다. 토스의 미니앱 플랫폼인 **앱인토스(Apps in Toss)** 위에 올렸습니다.

앱을 만들면서 기능 하나하나보다 더 오래 머문 질문은 따로 있었습니다. "이건 내가 직접 만들어야
하나, 아니면 플랫폼이 주는 걸 받아 쓰면 되나?" 랭킹도, 광고도, 공유도 매번 이 갈림길이
나왔습니다. 이 글은 그 결정들을 앱인토스 플랫폼 관점에서 정리한 기록입니다.

## 토대: Granite와 미니앱이라는 실행 환경

앱인토스 미니앱은 **Granite**(예전 이름은 Bedrock)라는 프레임워크 위에서 돕니다. 속은
React Native입니다. 그래서 화면은 RN 컴포넌트로 그리지만, 카메라·저장소·결제 같은 네이티브
기능과 **토스가 자체적으로 제공하는 기능**(게임 센터, 광고, 공유 등)은 `@apps-in-toss/framework`
패키지가 브릿지로 열어 줍니다.

라우팅은 파일 시스템 기반입니다. `pages/` 아래 파일이 곧 화면이고, 각 파일이 자기 라우트를
선언합니다.

```tsx
import { createRoute } from '@granite-js/react-native';

export const Route = createRoute('/ranking', {
  component: RankingPage,
  screenOptions: { headerShown: false },
  validateParams: (params) => {
    // 네비게이션으로 넘어온 파라미터를 여기서 검증·정규화한다
  },
});
```

여기까지는 평범한 RN 개발과 크게 다르지 않습니다. 차이는 **토스가 주는 네이티브 기능을 붙이기
시작하면서** 드러났습니다. 그 기능들은 하나같이 비동기이고, "지원하지 않는 환경"이 존재하며,
실패가 일상적입니다. 토스 앱 버전이 낮으면 함수가 `undefined`를 돌려주고, 사용자가 광고를
중간에 닫고, 공유 시트를 취소합니다. 이 불확실성을 페이지 곳곳에 풀어 놓으면 화면 코드가
금세 너덜너덜해집니다.

## 네이티브를 페이지에서 직접 부르지 않는다

그래서 규칙을 하나 세웠습니다. **`@apps-in-toss/framework`의 네이티브 호출은 페이지에서 직접
부르지 않는다.** 기능별로 전용 모듈을 두고, 그 안에만 가둡니다. 게임 센터는 `leaderboard.ts`,
공유는 `share.ts`, 전면 광고는 `useInterstitialAd.ts`. 이 모듈들이 지키는 공통 규칙이 셋
있습니다.

**첫째, 결과를 판별 유니온으로 정규화합니다.** 네이티브가 돌려주는 `undefined`(버전 미달)나
상태 코드, 던지는 예외를 화면이 그대로 받게 두지 않습니다. UI가 `switch` 하나로 처리할 수 있는
`{ kind: ... }` 형태로 바꿔 내보냅니다.

```ts
export type SubmitOutcome =
  | { kind: 'success' }
  | { kind: 'profileMissing' }    // 게임 프로필 미생성
  | { kind: 'leaderboardMissing' } // 미니앱 정보 미승인
  | { kind: 'unsupported' }        // 토스앱 버전 미달
  | { kind: 'error'; error: unknown };

export async function submitScore(score: number): Promise<SubmitOutcome> {
  try {
    const result = await submitGameCenterLeaderBoardScore({ score: toScore(score) });
    if (!result) return { kind: 'unsupported' };       // undefined → 버전 미달
    switch (result.statusCode) {
      case 'SUCCESS': return { kind: 'success' };
      case 'PROFILE_NOT_FOUND': return { kind: 'profileMissing' };
      case 'LEADERBOARD_NOT_FOUND': return { kind: 'leaderboardMissing' };
      default: return { kind: 'error', error: result.statusCode };
    }
  } catch (error) {
    return { kind: 'error', error };
  }
}
```

페이지는 이제 `statusCode` 문자열을 몰라도 됩니다. `kind`만 보고 안내 문구를 고르면 됩니다.
네이티브의 세부사항이 화면으로 새지 않습니다.

**둘째, 이 모듈들은 React에 의존하지 않습니다**(훅은 예외). 순수 함수로 두면 테스트가 단순해
집니다. `@apps-in-toss/framework` 하나만 모킹하면 모든 분기를 검증할 수 있습니다.

```ts
jest.mock('@apps-in-toss/framework', () => ({
  submitGameCenterLeaderBoardScore: jest.fn(),
  // ...
}));

test('undefined(버전 미달) → unsupported', async () => {
  mockSubmit.mockResolvedValue(undefined);
  expect(await submitScore(87)).toEqual({ kind: 'unsupported' });
});
```

**셋째, 흐름을 절대 막지 않습니다.** 미지원·실패·취소는 전부 graceful degrade로 처리하고,
사용자 진행은 항상 이어집니다. 이 원칙은 광고에서 가장 빛을 발했습니다.

## 랭킹: 직접 만든 걸 걷어내고 게임 센터에 얹다

처음에는 랭킹을 **직접** 만들었습니다. 닉네임 입력 폼, 리더보드 리스트, 도전 기록 탭, 내 순위
히어로 카드, 로컬 저장소까지. 화면도 컴포넌트별로 잘 쪼개 두었습니다. 그런데 앱인토스에는
**게임 센터**라는 기능이 있습니다. 점수 제출과 전역 리더보드를 토스가 직접 호스팅합니다.

결정을 내려야 했습니다. 내가 만든 로컬 랭킹을 유지할 것인가, 플랫폼 것으로 갈아탈 것인가.
게임 센터로 가기로 했습니다. 전역 순위는 토스가 호스팅하는 게 사용자에게도(다른 도전자와
실제로 겨룰 수 있으니), 운영에도 낫다고 봤습니다. 이 결정의 결과는 한 커밋에서 **1,500여 줄을
지우고 600줄을 더하는** 형태로 나타났습니다. 직접 만든 리더보드·닉네임 폼·기록 탭·로컬
저장소가 통째로 사라지고, 그 자리를 게임 센터를 감싼 얇은 모듈 하나가 대신했습니다.

플랫폼에 얹으면서 떠안은 전제도 있습니다.

- **버전 게이팅.** 게임 센터는 일정 버전 이상의 토스 앱에서만 동작합니다. `isMinVersionSupported`로
  먼저 확인하고, 미달이면 호출 없이 안내합니다.
- **승인 전제.** 미니앱이 **게임 카테고리로 승인**돼 있어야 리더보드가 활성화됩니다. 그 전에는
  `LEADERBOARD_NOT_FOUND`가 돌아옵니다. 이걸 에러가 아니라 "아직 준비 중"이라는 별도 상태로
  안내해야 했습니다.
- **프로필 의존.** 사용자가 게임 프로필을 만들지 않았으면 점수가 등록되지 않습니다. 이때는
  리더보드를 열어 프로필을 먼저 만들도록 유도합니다.

플랫폼 기능을 받아 쓴다는 건 코드를 덜 짠다는 뜻이지만, 동시에 **플랫폼의 상태 모델을 그대로
떠안는다**는 뜻이기도 합니다. 위 세 가지가 전부 판별 유니온의 `kind`로 들어간 이유입니다.

## 광고: 흐름을 막지 않는 것이 제1원칙

광고는 두 종류를 붙였습니다. 게임이 끝나고 결과 화면으로 넘어가는 사이에 한 번 뜨는 **전면
광고**, 그리고 홈·결과 화면 하단에 자리 잡는 **배너**입니다.

전면 광고에서 가장 중요한 건 수익이 아니라 **"광고가 게임 흐름을 절대 막지 않는다"**였습니다.
앱인토스 전면 광고는 `load → show → 다음 load`라는 패턴을 권장합니다. 화면에 들어올 때 미리
불러 두고, 필요한 순간 보여주고, 닫히면 다음 것을 또 불러 둡니다. 이걸 훅으로 감싸면서 한 가지를
보장하게 만들었습니다. **광고가 뜨든, 못 뜨든, 지원하지 않는 환경이든 `onDone`은 정확히 한 번
호출된다.**

```ts
const showThen = (onDone: () => void) => {
  let settled = false;
  const settle = () => { if (!settled) { settled = true; onDone(); } };

  // 준비된 광고가 없거나 미지원이면 곧장 진행
  if (!readyRef.current || !isSupported()) { settle(); return; }

  showFullScreenAd({
    options: { adGroupId },
    onEvent: (e) => {
      // 정상 닫힘이든 표시 실패든 흐름을 이어간다
      if (e.type === 'dismissed' || e.type === 'failedToShow') {
        settle();
        preload(); // 다음 광고 미리 로드
      }
    },
    onError: () => settle(),
  });
};
```

호출부는 `interstitial.showThen(goResult)` 한 줄입니다. 광고 성공 여부를 신경 쓰지 않습니다.
결과 화면 이동은 어떤 경우에도 일어납니다. 배너도 같은 철학입니다. 노필(no-fill)이나 미지원이면
콘텐츠 높이 0으로 렌더되어 **빈 자리조차 남지 않습니다.** 그리고 배너는 홈·결과처럼 체류가
긴 화면에만 두고, 3초 클립을 듣는 퀴즈 풀이 화면에는 넣지 않았습니다. 청취 몰입을 깨면서
얻는 노출은 없다고 봤기 때문입니다.

### 빌드 환경이 정책을 가른다

광고에는 미묘한 운영 함정이 하나 있습니다. **검수에 올리는 번들에는 운영 광고 ID가 들어가야
하고, 개발 중 클릭 테스트는 테스트 ID로만 발생해야 합니다.** 운영 ID로 개발하며 광고를 누르면
부정 클릭으로 제재받을 수 있고, 테스트 ID로 출시하면 정책 위반입니다.

다행히 RN 번들러는 빌드 시점에 `__DEV__`라는 상수를 박아 넣습니다. 개발 서버로 띄우면 `true`,
배포 빌드면 `false`입니다. 이 한 줄로 두 정책을 동시에 만족시킬 수 있었습니다.

```ts
const TEST_AD_IDS = { interstitial: '...test...', banner: '...test...' };
const PROD_AD_IDS = { interstitial: '<운영 ID>', banner: '<운영 ID>' };

// 개발 서버 → 테스트 ID, 배포 빌드 → 운영 ID. 별도 플래그가 필요 없다.
const adIds = __DEV__ ? TEST_AD_IDS : PROD_AD_IDS;
```

여기에 안전장치를 하나 더 뒀습니다. 운영 빌드인데 운영 ID가 아직 플레이스홀더 상태이면 빌드
로그에 경고를 남깁니다. 크래시는 내지 않습니다 — 광고 로드 실패는 어차피 graceful degrade라
앱은 멀쩡히 돌아가지만, 수익이 0이 되는 실수를 조용히 넘기지 않도록 한 것입니다.

## 공유: 딥링크와 "출시 전엔 안 열리는" 함정

마지막은 공유입니다. 앱인토스는 두 가지를 줍니다. OS 기본 공유 시트를 띄우는 `share`, 그리고
**미니앱으로 곧장 복귀하는 딥링크**를 만들어 주는 `getTossShareLink`입니다. 둘을 묶으면
"점수 자랑 메시지 + 누르면 앱으로 돌아오는 링크"가 완성됩니다.

```ts
async function shareWithDeeplink(buildMessage) {
  let link = 'intoss://classic-ones-quiz'; // 미니앱 복귀 딥링크
  try {
    link = await getTossShareLink(link, OG_IMAGE_URL); // OG 미리보기 이미지까지
  } catch {
    // 링크 변환 실패해도 raw 스킴으로 폴백 — 공유 자체는 막지 않는다
  }
  await share({ message: buildMessage(link) });
}
```

여기서도 폴백을 넣었습니다. 링크 변환이 실패해도 raw 스킴으로 공유는 진행됩니다. 네이티브
경계 모듈의 "흐름을 막지 않는다" 원칙이 그대로 적용됩니다.

그런데 진짜 함정은 따로 있었습니다. **`intoss://` 딥링크는 미니앱이 정식 출시된 뒤에야
작동합니다.** 출시 전 개발 중에는 이 스킴으로 앱이 열리지 않습니다. 대신 번들을 업로드할 때마다
발급되는 `intoss-private://...?_deploymentId=...` 형태의 **테스트 스킴**으로만 검증할 수 있습니다.
이걸 모르면 "공유 시트는 뜨는데 링크를 눌러도 앱이 안 열린다"에서 한참을 헤매게 됩니다.
폴백을 넣어 둔 덕에 출시 전에도 공유 시트 자체는 정상 동작했지만, 링크 복귀 테스트만큼은
테스트 스킴으로 따로 확인해야 했습니다.

## 마무리: 플랫폼 위에서 개발한다는 것

랭킹, 광고, 공유. 세 기능을 붙이며 같은 모양의 결정을 반복했습니다.

- **직접 만들 것인가, 플랫폼에 얹을 것인가.** 랭킹은 직접 만든 1,500줄을 걷어내고 게임 센터에
  얹었습니다. 코드는 줄었고, 대신 플랫폼의 상태 모델(버전·승인·프로필)을 떠안았습니다.
- **플랫폼의 불확실성을 어디서 흡수할 것인가.** 페이지가 아니라 기능별 경계 모듈에서
  흡수했습니다. 네이티브의 `undefined`·상태 코드·예외를 전부 판별 유니온으로 정규화하니,
  화면은 깨끗해지고 테스트는 모킹 하나로 끝났습니다.
- **빌드 환경이 무엇을 가르는가.** `__DEV__` 한 줄이 테스트 광고와 운영 광고를 갈랐고,
  배포 정책 위반을 빌드 단계에서 막았습니다.

마지막으로, 이 패턴들을 코드만 남기지 않고 프로젝트의 가이드 문서에 적어 두었습니다. "네이티브
호출은 페이지에서 직접 부르지 않는다", "게임 센터는 게임 카테고리 승인이 전제다",
"`intoss://`는 출시 후에만 열린다" 같은 것들입니다. 플랫폼 위에서 개발할 때 정작 발목을 잡는 건
화려한 기능이 아니라 이런 **경계의 규칙들**이었기 때문입니다. 다음에 이 코드를 여는 사람이
같은 곳에서 헤매지 않도록, 함정의 위치를 지도에 표시해 두는 일까지가 개발이라고 생각합니다.
