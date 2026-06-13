---
title: "흰 화면의 범인 찾기: 버그가 내 코드에 없을 때"
excerpt: "안드로이드를 출시하고 iOS로 넘어왔더니, 시뮬레이터가 흰 화면만 내놓는다. 크래시도 에러 메시지도 없다. 다섯 명의 용의자를 하나씩 소거하고 나서야 알았다 — 범인은 앱이 아니라 툴체인이었다. 토스 미니앱 포팅 시리즈의 iOS 편."
date: 2026-06-13
tags: [ios, react-native, expo, debugging]
---

[지난 글](/posts/shipping-an-expo-app-to-google-play)에서 안드로이드를 플레이 콘솔의 선언 체인까지 통과시켰다. 같은 코드베이스의 다음 목적지는 iOS였다. 화면 본문은 이미 공유 코어에 있고, iOS용 어댑터도 채워뒀다. 시뮬레이터에 한 번 띄워보는 일만 남았다 — 고 생각했다.

시뮬레이터는 흰 화면을 내놓았다. 크래시도, 빨간 에러 박스도, 로그 한 줄도 없이. 이 글은 그 흰 화면의 범인을 찾는 과정이고, 결말부터 말하면 **범인은 내 코드가 아니었다.** 그걸 증명하는 데 든 시간이 이 글의 내용이다.

## 첫 번째 벽: "No script URL"

디버그 빌드를 시뮬레이터에 올리자 빨간 화면이 떴다.

```
No script URL provided. Make sure the packager is running
or you have embedded a JS bundle in your application bundle.
unsanitizedScriptURLString = (null)
```

앱이 JS 번들의 위치를 못 찾았다는 뜻이다. 보통은 Metro 번들러가 안 떠 있거나 포트 문제다. 그런데 이건 달랐다. localhost로 강제해도 **Metro에 요청이 0건** — 앱이 접속을 시도조차 안 했다. 네트워크는 무죄였다. 빈 프로젝트를 새로 만들어도 같은 증상이 재현됐다. 즉 이건 우리 설정 문제가 아니라, 이 머신의 툴체인(특정 Xcode + 특정 iOS 시뮬레이터 + 특정 React Native 버전) 조합 버그였다.

당장의 우회책은 명확해 보였다. **Release 빌드.** Release는 JS 번들을 앱 안에 박아 넣으니 Metro가 필요 없고, 그러면 이 버그를 통째로 비켜갈 수 있다. 이 가정이 나중에 발목을 잡는다.

## 곁가지 하나: Sentry가 빌드를 깨다

Release 빌드를 돌리자 이번엔 `error: sentry-cli` 가 잔뜩 찍히며 멈췄다. 줄을 자세히 보니 대부분 정상 trace 출력인데 전부 `error:` 접두사가 붙어 있었다. 빌드 스크립트를 읽어보니 이유가 나왔다.

Sentry의 RN 번들 스크립트는 번들링과 **소스맵 자동 업로드**를 함께 한다. 업로드 명령이 실패하면 출력의 *모든 줄*에 `error:` 접두사를 붙이고 빌드 단계를 실패시킨다. 실패 원인은 단순했다 — 로컬엔 인증 토큰이 없어서 업로드가 거부됐고, 디버그 빌드는 소스맵을 안 올리지만 Release는 올린다. 그래서 Release에서만 터진 것이다.

로컬 Release 빌드는 소스맵을 올릴 이유가 없다. 자동 업로드만 끄면 된다.

```bash
# ios/.xcode.env.local (gitignore되는 로컬 전용)
export SENTRY_DISABLE_AUTO_UPLOAD=true
```

이 플래그가 켜지면 스크립트는 업로드 분기를 통째로 건너뛰고 평범한 번들링만 한다. 빌드가 통과했다. 그리고 진짜 문제가 모습을 드러냈다.

## 진짜 문제: 아무것도 안 그려진다

Release 앱이 떴는데 화면이 순백이었다. 2초에도, 8초에도 흰색. 앱의 스플래시는 크림색(`#F1DDB7`) 배경을 쓰는데 화면은 그 색조차 아니었다. React 트리가 아예 안 그려지고 있었다.

먼저 사실관계를 확정했다. 시뮬레이터 통합 로그를 잡아보니:

- JS 번들은 앱 안에 정상으로 박혀 있고(3.5MB), 임베드 파일에서 로드된다.
- React Native 네이티브가 초기화된다.
- **크래시가 없다.** 종료 시그널은 전부 내가 보낸 종료 명령(SIGTERM)이고, SIGABRT도 네이티브 예외도 없다.

크래시가 없다는 건 중요한 단서다. uncaught JS fatal이 있었다면 RN이 그걸 잡아 크래시시키고 로그를 남긴다. 그게 없다는 건 **번들이 예외 없이 실행되는데도 UI가 안 나온다**는 뜻이다.

여기서 디버깅 원칙 하나를 세웠다. **추측으로 고치지 않는다. 용의자를 하나씩 직접 증거로 소거한다.** 흰 화면은 원인이 수십 가지일 수 있고, 감으로 한 군데씩 찔러보면 새 버그만 만든다.

## 용의자 1: 라우트가 등록 안 됐다?

이 앱은 모노레포다. 그런데 Expo 앱 디렉토리에 `babel.config.js`가 없었다. expo-router는 `babel-preset-expo`가 주입하는 `require.context`로 파일 기반 라우트를 등록하는데, 그 설정이 빠지면 babel이 모노레포 루트의 *다른* 프리셋을 끌어다 쓰고 → 라우트가 0개로 등록되고 → 라우터가 빈 화면을 그린다. 그럴듯했다.

확인 방법은 추측이 아니라 **빌드 산출물을 직접 보는 것**이다. Hermes 바이트코드 번들에서 문자열 테이블을 뽑아 라우트 파일명을 찾았다.

```bash
strings main.jsbundle | grep -oE "\./(home|quiz|ranking|index)\.tsx"
# → ./home.tsx  ./index.tsx  ./quiz.tsx  ./ranking.tsx
```

라우트는 **이미 등록돼 있었다.** Expo의 Metro 트랜스포머가 `babel.config.js` 없이도 프리셋을 자체 적용하고 있었던 것이다. 가설 기각. (이 과정에서 `babel.config.js`를 추가해봤지만 번들은 바이트 단위로 동일했다 — 범인이 아니라는 또 하나의 증거였다.)

## 용의자 2: dev client가 가로챈다?

`expo run:ios`가 앱을 열 때 `expo-development-client://...?url=http://...:8081` 같은 딥링크로 Metro 연결을 시도하는 게 로그에 보였다. dev client가 Release에까지 포함돼 임베드 번들 대신 Metro를 기다리며 흰 화면을 띄우는 거라면? 첫 화면의 "No script URL"과도 맞아떨어진다.

확인:

```bash
ls ios/Pods/ | grep -iE "DevLauncher|DevMenu"
# → (없음)
```

dev launcher 네이티브 모듈은 Release 빌드에 **컴파일되지 않았다.** AppDelegate의 번들 URL 로직도 정석대로였다.

```swift
override func bundleURL() -> URL? {
#if DEBUG
  return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
  return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
}
```

Release는 임베드 번들을 정확히 가리킨다. 가설 기각.

## 용의자 3: Hermes 바이트코드 버전 불일치

이게 가장 그럴듯한 용의자였다. 이 모노레포는 호스트 프레임워크 사정상 **두 개의 React Native 버전이 공존한다** — 루트는 한 버전, 이 앱은 한 단계 높은 버전. 번들을 컴파일한 `hermesc`와 앱에 링크된 Hermes 런타임이 서로 다른 RN에서 왔다면, 바이트코드 버전이 안 맞아 Hermes가 실행을 거부한다. 그러면 JS가 한 줄도 안 돌고 → 흰 화면. 증상과 완벽히 맞는다.

Hermes 바이트코드 파일은 헤더에 버전을 담는다. 번들의 첫 바이트를 봤다.

```
c61f bc03 c103 191f 6200 0000 ...
                    ^^ 오프셋 8: 버전 = 0x62 = 98
```

그리고 양쪽 RN의 `hermesc`로 trivial JS를 각각 컴파일해 버전을 비교했다.

```bash
# 루트 RN의 hermesc  → 버전 98
# 앱  RN의 hermesc   → 버전 98
# 임베드 번들        → 버전 98
```

**전부 98.** 런타임(앱에 링크된 Hermes)도 98을 기대한다. 불일치가 없다. Hermes는 이 번들을 실행할 수 있다. 가장 유력했던 용의자가 무죄로 풀렸다.

## 용의자 4: New Architecture를 꺼본다

여기서 계측을 추가했다. 앱 루트 레이아웃에 **무조건 렌더되는** 풀스크린 View를 박았다.

```tsx
function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: 'magenta' }}>
      <Text>DIAG: ROOT RENDERED</Text>
      {/* ...실제 앱 트리... */}
    </View>
  );
}
```

magenta가 뜨면 루트는 렌더된다는 뜻이고, 그래도 흰색이면 React 루트뷰 자체가 화면에 안 붙는다는 뜻이다. 재빌드 후 — **여전히 순백.** 무조건 렌더되는 magenta조차 안 나왔다. 이건 앱 트리의 어느 화면 문제가 아니라, **RN 루트뷰가 디바이스 화면에 attach되지 않는다**는 강력한 신호다.

이 RN 버전은 New Architecture(Fabric)를 쓴다. 새 렌더 아키텍처 + 새 시뮬레이터 조합이 의심됐다. 그럼 꺼보면 된다. 그런데:

```
[!] Reanimated requires the New Architecture to be enabled.
    If you have RCT_NEW_ARCH_ENABLED=0 set, you should remove it.
```

`pod install`이 거부했다. 이 RN 버전부터 **New Architecture는 강제**다. 끌 수가 없다. 우회 실험 자체가 불가능했다 — 동시에, 이 조합이 강제된다는 사실이 "툴체인 차원의 문제"라는 심증을 굳혔다.

## 용의자 5: precompiled modules

마지막 구체적 용의자. 이 빌드는 `EXPO_USE_PRECOMPILED_MODULES`로 React 코어와 일부 네이티브 모듈을 **미리 컴파일된 xcframework**로 링크한다(빌드 속도용). 이 프레임워크의 플레이버나 설정이 어긋나면 네이티브 브리지가 비정상 동작할 수 있다. `react-native-screens`(네비게이터 화면을 호스팅하는 모듈)가 여기 끼어 있는 게 특히 걸렸다.

확인 방법은 변수를 제거하는 것. precompiled를 끄고 **전부 소스에서** 빌드했다.

```bash
# Podfile.properties.json: EXPO_USE_PRECOMPILED_MODULES = "false"
# 후 pod install + Release 재빌드
```

소스에서 통째로 빌드한 앱도 — **흰 화면.** magenta는 여전히 안 떴다. 가설 기각.

## 평결: 범인은 코드가 아니다

소거된 용의자 목록:

| 용의자 | 평결 | 증거 |
|---|---|---|
| 라우트 미등록 | 무죄 | 번들에 라우트 파일명 존재 |
| dev client 가로채기 | 무죄 | launcher pod이 Release에 미포함 |
| Hermes 바이트코드 불일치 | 무죄 | 양쪽 hermesc·런타임 모두 v98 |
| New Architecture | 심증 | 강제라 끌 수 없음 |
| precompiled modules | 무죄 | 소스 빌드도 흰 화면 |

앱·빌드설정 레벨의 원인이 전부, 그것도 **추측이 아니라 직접 증거로** 배제됐다. 무조건 렌더되는 magenta 루트뷰조차 안 그려진다. 크래시도 JS 에러도 없다. 그리고 결정적으로, **같은 코드가 안드로이드 에뮬레이터에서는 멀쩡히 렌더된다.** 화면도 라우트도 번들도 다 정상이다.

남는 결론은 하나다. **특정 Xcode + 특정 iOS 시뮬레이터 + 강제된 New Architecture의 조합이 RN 루트뷰를 화면에 못 붙인다.** 디버그에서 본 "No script URL"과 같은 툴체인 버그가, Release 렌더링까지 깬다. 처음에 세운 "Release면 우회된다"는 가정은 틀렸다.

중요한 건 이게 **출시를 막지 않는다**는 점이다. 이건 이 머신의 *시뮬레이터* 렌더 경로 문제다. 시뮬레이터의 새 아키텍처 렌더 버그는 보통 실기기엔 없고, 스토어 빌드는 실기기를 대상으로 한다. 길은 둘이다 — 클라우드 빌드(검증된 환경에서 빌드해 실기기 설치)로 시뮬레이터를 통째로 회피하거나, 실기기에 직접 올리거나. 로컬 시뮬레이터 한 대가 막혔을 뿐, 앱은 갈 곳으로 갈 수 있다.

## 마무리: 앱을 디버깅하는가, 툴체인을 디버깅하는가

이 구간에서 배운 것 셋.

1. **고치기 전에 소거하라.** 흰 화면처럼 원인 후보가 넓을 때, 감으로 한 곳씩 고치면 새 버그만 쌓인다. 각 가설을 *직접 증거로* 죽이는 게 빠르다. 번들의 문자열, 바이트코드 버전, pod 목록 — 추측을 사실로 바꾸는 건 로그가 아니라 산출물이다.

2. **무조건 렌더되는 프로브를 심어라.** magenta 한 장이 "이건 화면 컴포넌트 문제다 / 아니다, 루트뷰가 아예 안 붙는다"를 단번에 갈랐다. 가장 단순한 계측이 가장 비싼 정보를 준다.

3. **앱을 디버깅하는지 툴체인을 디버깅하는지 알아채라.** 가장 어려운 건 기술이 아니라 이 판단이다. "내 코드가 틀렸다"는 가정은 자연스럽고, 그래서 오래 붙잡게 된다. 하지만 앱 레벨 원인이 전부 무죄로 풀리고, 같은 코드가 다른 플랫폼에선 도는 순간 — 방향을 틀어야 한다. 코드를 더 들여다보는 대신, 환경을 바꿔 검증하는 쪽으로.

지난 글의 교훈이 "선언을 채우지 말고 원인을 제거하라"였다면, 이번 교훈은 그 사촌이다. **때로는 원인이 당신 코드 바깥에 있고, 그걸 증명하는 것 자체가 엔지니어링이다.** 흰 화면 앞에서 "내가 뭘 잘못했지"를 다섯 번 물은 끝에, 답이 "아무것도"일 수도 있다는 걸 받아들이는 것 — 그 판단에 도달하는 가장 안전한 길이 소거법이었다.
