# tt-blog

> ⚠️ **Next.js 16 주의**: 이 프로젝트는 Next.js 16.x + React 19를 사용한다.
> 학습 데이터의 Next.js와 API/규약/파일 구조가 다를 수 있다. 코드를 작성하기 전에
> `node_modules/next/dist/docs/`의 관련 가이드를 확인하고 deprecation 안내를 따른다.
> (create-next-app이 생성한 `AGENTS.md` 참고)

## 기술 스택

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: TailwindCSS v4 + shadcn/ui
- **Icons**: lucide-react, react-icons
- **Validation**: Zod
- **Auth**: 없음
- **State**: Zustand
- **Date**: date-fns
- **Test**: Vitest + Testing Library
- **Deploy**: Vercel
- **CI/CD**: GitHub Actions
- **Env**: .env.local

> 이 프로젝트는 데이터베이스(ORM)를 사용하지 않는다. 게시글 데이터는 현재
> `src/services/post.service.ts`의 인메모리 시드에서 제공된다. 추후 MDX 파일,
> 헤드리스 CMS, 또는 DB(Prisma)로 교체할 수 있으며, 컴포넌트는 서비스 계층만
> 의존하므로 교체 범위가 한 곳으로 한정된다.

## 프로젝트 구조

```
src/
├── app/              # App Router (페이지, API 라우트)
├── components/       # 공유 컴포넌트
│   └── ui/           # shadcn/ui 컴포넌트
├── hooks/            # 커스텀 훅
├── lib/              # 유틸리티
│   ├── utils.ts      # cn() 등 (shadcn)
│   └── validations/  # Zod 스키마
├── services/         # 비즈니스 로직 계층 (Service 패턴)
├── stores/           # Zustand 스토어
└── types/            # TypeScript 타입 정의
tests/                # 테스트 코드 (루트 레벨, src 밖)
├── unit/
└── integration/
```

## 핵심 규칙

### 데이터 접근

- 데이터 접근/조회 로직은 컴포넌트에 직접 작성하지 않고 **Service 패턴**(`src/services/`)을 통한다.
- 컴포넌트는 서비스 인터페이스만 의존한다. 데이터 소스(인메모리 → MDX → CMS → DB)가 바뀌어도 컴포넌트는 영향받지 않는다.

### 상태관리 (Zustand)

- 전역 상태는 `src/stores/`에 스토어 단위로 작성한다 (`use-*-store.ts`).
- 블로그에서 전역 스토어는 주로 UI 상태(테마, 모바일 내비)에 쓴다. 게시글 데이터는 서버 컴포넌트에서 직접 가져오고 전역 상태로 끌어올리지 않는다.

### 테스트 규칙

- 테스트 파일은 루트의 `tests/` 폴더에 작성한다 (src 내부에 두지 않는다).
- 실행: `npm run test` (단일 실행) / `npm run test:watch` (감시 모드).
- 파일명 패턴: `*.test.ts` 또는 `*.test.tsx`.

### 유효성 검사

- 외부 입력(API, 폼) 검증은 **Zod** 스키마를 사용한다.
- 스키마는 `src/lib/validations/`에 정의한다.

### 타입 규칙

- `any` 타입을 사용하지 않는다. `unknown`, 구체적인 타입, 또는 제네릭을 사용한다.
- `catch (e)` → `catch (e: unknown)`, 콜백 파라미터에도 명시적 타입을 부여한다.

### 날짜 처리

- 날짜 관련 작업은 **date-fns**를 사용한다 (`moment.js`, `dayjs` 미사용).

### 환경변수

- 환경변수는 `.env.local`에 저장한다 (`.env` 아님).
- `.env.example`은 팀원 공유용 템플릿으로 git에 커밋한다.
- `.env.local`은 절대 git에 커밋하지 않는다.

### 배포

- Vercel에 배포한다 (`vercel.json` 불필요, Next.js 자동 감지).
- 환경변수는 Vercel 대시보드에서 설정한다.
- push → GitHub Actions CI 자동 실행 → Vercel 자동 배포.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 시작 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint 실행 |
| `npm run test` | 테스트 실행 |
| `npm run test:watch` | 테스트 감시 모드 |
| `npm run test:coverage` | 커버리지 측정 |
