export type Theme = 'light' | 'dark'

const COOKIE_NAME = 'artel-theme'

/**
 * console.artel.kr과 admin.artel.kr은 사용자에게 한 제품이므로 선택을 origin이 아니라 부모
 * 도메인에 남긴다. localStorage로는 그 경계를 넘지 못한다. artel.kr이 아닌 호스트(localhost,
 * 프리뷰 배포)에서는 Domain 없이 host-only로 남는데, 쿠키는 포트를 구분하지 않아 로컬의
 * 5173/5174 사이에서도 그대로 공유된다.
 *
 * 이름과 속성은 artel-home의 src/theme.ts, 그리고 양쪽 index.html의 부트 스크립트와 같아야
 * 한다.
 */
const SHARED_DOMAIN = 'artel.kr'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#14161c' : '#F7F4EE')
  persistTheme(theme)
}

export function persistTheme(theme: Theme) {
  const { hostname, protocol } = window.location
  const onSharedDomain = hostname === SHARED_DOMAIN || hostname.endsWith(`.${SHARED_DOMAIN}`)
  const domain = onSharedDomain ? `; Domain=.${SHARED_DOMAIN}` : ''
  const secure = protocol === 'https:' ? '; Secure' : ''

  document.cookie =
    `${COOKIE_NAME}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${domain}${secure}`
}
