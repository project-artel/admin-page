# admin-page

ARTEL 어드민 페이지. React 19 + TypeScript + Vite.

## 개발

```bash
npm install
npm run dev
```

기본 포트는 `5174`다. `artel-home`이 `5173`을 쓴다.

| 목적 | 명령 |
|---|---|
| 개발 서버 | `npm run dev` |
| 린트 | `npm run lint` |
| 타입 검사 | `npx tsc -b` |
| 빌드 | `npm run build` |

## 디자인 시스템

`src/styles/tokens.css`가 토큰을 정의하고 `src/styles/index.css`가 리셋과 전역
규칙을 얹는다. 두 파일은 `artel-home`과 같은 값을 유지한다. UI를 바꾸기 전에
`.agents/docs/DESIGN.md`를 읽는다.

## 에이전트 도구

`.jira.env`와 `.notion.env`는 gitignore 대상이다. 각각 `.example` 파일을
복사해서 값을 채운다.
