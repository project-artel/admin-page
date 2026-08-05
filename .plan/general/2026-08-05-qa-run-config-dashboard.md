# 2026-08-05 — QA 실행 설정 대시보드

- Date: 2026-08-05
- Jira: None (ARTEL-239 후속, 이슈 미생성)
- Status: Implemented

## Goal

admin-page의 첫 화면으로 QA 런을 실행 설정 축으로 비교하는 대시보드를 만든다. ARTEL-239(PR #72)가
`qa_try`에 남기기 시작한 `model` / `reasoning_effort` / `prompt_version` / `agent_arch`가 축이다.

화면이 답해야 하는 질문: **결과가 좋아졌을 때 모델 덕인지, 프롬프트 덕인지, 구조 덕인지.**

- 축별 런 수와 완주율
- 두 축 교차 매트릭스
- 축별 LLM 토큰·비용
- 최근 런 목록(어떤 설정으로 돌았는지 포함)

## Non-goals

- 라우터. 화면이 하나뿐이라 지금 넣으면 쓰지 않는 추상이다. 두 번째 화면이 생길 때 넣는다.
- 차트 라이브러리. 막대는 CSS로 충분하고, 의존성 하나가 번들과 디자인 토큰 통제를 함께 가져간다.
- 자체 OAuth 화면. 로그인은 artel-home이 이미 갖고 있고 쿠키는 orchestration 도메인에 붙는다.
  여기서는 세션이 없으면 로그인 경계만 보여준다.
- 실시간 갱신. 집계는 실험 회고용이라 수동 새로고침으로 족하다.

## Context / Constraints

**데이터.** `GET /api/qa-stats?projectId&from&to&cellLimit` 하나가 4축 조합 셀 + 전체 합계를 준다.
런은 4-튜플로 분할되므로 단일 축 분해도 두 축 매트릭스도 이 셀의 부분합이다 — 축을 바꿀 때마다
서버를 다시 부르지 않는다. 최근 런은 기존 `GET /api/qa-tries?projectId&size`를 그대로 쓴다.

**미상 축.** 축 값은 nullable이고 null은 "미상"이다(ARTEL-239 이전 런, 구버전 Agent). 화면에서
버리면 축별 합이 총계와 어긋난다. `—` 라벨을 단 하나의 그룹으로 보여준다.

**완주율 ≠ 통과율.** `qa_try.status`는 런 생명주기다. `COMPLETED`는 "끝까지 돌았다"이지 "테스트가
통과했다"가 아니다. 라벨을 완주로 쓰고, 분모에서 `STARTING`/`RUNNING`을 뺀다. `CANCELLED`는
운영자 행동이라 실패와 섞지 않는다.

**비용 null.** `costUsd`가 null이면 "공짜"가 아니라 "단가 미상"이다. `$0.00`으로 렌더하지 않는다.

**디자인.** `.agents/docs/DESIGN.md`의 Blueprint Paper. 그림자 없음, 깊이는 1px 선과 배경 단계로.
문서가 "generic KPI dashboards, repeated rounded cards"를 금지하므로 카드 격자 대신 밀도 높은
표와 헤어라인으로 짠다. 숫자에는 `tabular-nums`, ID·모델명·비율은 mono. 색만으로 상태를 말하지
않는다.

**인증.** orchestration 쿠키는 `SameSite=Lax`다. 포트가 달라도 `localhost`끼리는 같은 site라 로컬
개발은 통하지만, 배포 시 admin-page는 orchestration과 같은 site여야 쿠키가 실린다. CORS는
`artel.auth.allowed-origins`에 admin-page origin을 넣으면 되고 코드 변경은 없다.

## Approach (Checklist)

- [x] **Step 0: Recon**
  - artel-home `src/auth/authApi.ts` — 401 후 단일 refresh 재시도 패턴
  - `.agents/docs/DESIGN.md`, `src/styles/tokens.css` — 토큰은 이미 있음
  - orchestration `AuthController.me`, `ProjectController.list`, `QaTryController.list`

- [x] **Step 1: Implementation**
  - `index.html` — 폰트 3종, 테마 부트스트랩(artel-home과 같은 `artel-theme` 키)
  - `src/api/orchestration.ts` — 베이스 URL, `apiFetch`(credentials + 401 단일 refresh), 파싱 헬퍼
  - `src/auth/sessionApi.ts`, `App.tsx`의 `SignInBoundary` — 세션 없으면 artel-home 로그인으로 안내
  - `src/projects/projectsApi.ts` — 프로젝트 선택기 원천
  - `src/qaStats/qaStatsApi.ts`, `qaStatsTypes.ts`
  - `src/qaStats/pivot.ts` — **순수 함수.** 셀 목록에서 축 분해·매트릭스·완주율을 만든다.
    화면과 분리하는 이유는 이 산술이 조용히 틀리는 자리이기 때문이다.
  - `src/qaStats/*.tsx` — 총계 레일, 축 분해 표 4개, 매트릭스, 최근 런 표
  - 최근 런은 `qaStatsApi.ts`의 `fetchRecentQaTries` — 같은 화면이 쓰는 같은 원천이라 모듈을 나누지 않았다

- [x] **Step 2: Tests**
  - vitest 도입(테스트 러너가 없었다) + `pivot.test.ts`, `render.test.tsx`
    - 축 분해 합 = 총계
    - 미상(null) 축이 그룹으로 남는다
    - 완주율 분모에서 진행 중 런이 빠진다
    - 비용 null이 0으로 접히지 않는다
  - 수동 확인: 1024px / 1440px, 라이트·다크, 빈 상태·오류 상태·미로그인

- [ ] **Step 3: Rollout / Rollback**
  - `VITE_ORCHESTRATION_URL` 필요. 배포 시 orchestration의 `allowed-origins`에 origin 추가.
  - ARTEL-239 머지 전에는 축이 전부 미상으로 보인다(정상 동작, 데이터 부재).

## Validation

- **Commands to run:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- **Expected output:** 무경고 통과, 신규 pivot 테스트 통과

## Risks & Rollback

- **Risks:**
  - `SameSite=Lax` 때문에 배포 도메인이 orchestration과 다른 site면 쿠키가 안 실린다. 로컬에서는
    드러나지 않는 종류의 실패다.
  - `QaTryResponse`에 `reasoningEffort`가 없다(승격 컬럼인데 응답 필드 누락). 최근 런 표의 effort는
    `runConfig.reasoning.effort`에서 읽는다.
  - 축 조합이 상한을 넘으면 `truncated`가 서고 표가 총계보다 적게 더한다. 화면에 명시한다.
- **Rollback steps:** `git revert`. 서버 상태를 만들지 않는다.

## Open Questions

- 관리자 전용 화면이 될지, artel-home 사용자 누구나 볼 수 있는 화면일지. 지금은 후자(프로젝트
  참여자면 본다)이며, 관리자 역할이 생기면 크로스 프로젝트 집계를 여기 붙인다.
