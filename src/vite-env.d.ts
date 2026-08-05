/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** orchestration 서버 origin. 없으면 로컬 기본값(`http://localhost:8080`). */
  readonly VITE_ORCHESTRATION_URL?: string
  /** 세션이 없을 때 안내할 로그인 화면. artel-home이 OAuth를 갖고 있다. */
  readonly VITE_HOME_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
