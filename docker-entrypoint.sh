#!/bin/sh
set -eu

# 값이 없으면 여기서 죽는다. 그대로 두면 브라우저가 __ARTEL_ORCHESTRATION_URL__/...
# 로 요청을 보내고, 그 실패는 배포가 아니라 사용자 화면에서 처음 보인다.
: "${VITE_ORCHESTRATION_URL:?orchestration 서버 origin을 VITE_ORCHESTRATION_URL로 넣어야 한다}"
: "${VITE_HOME_URL:?artel-home origin을 VITE_HOME_URL로 넣어야 한다}"

# 빌드 산출물 안의 두 자리 표시 문자열을 실제 값으로 바꾼다.
find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' \) -exec \
  sed -i \
    -e "s|__ARTEL_ORCHESTRATION_URL__|${VITE_ORCHESTRATION_URL}|g" \
    -e "s|__ARTEL_HOME_URL__|${VITE_HOME_URL}|g" \
    {} +

# nginx 이미지 자신의 entrypoint 로 넘긴다. 그것이 template 처리와 로그 설정을 한다.
exec /docker-entrypoint.sh "$@"
