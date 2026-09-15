# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

# package.json 과 package-lock.json 을 먼저 COPY하고 설치해야, 소스만 고쳤을 때
# 의존성 layer 를 다시 만들지 않는다.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_ORCHESTRATION_URL 과 VITE_HOME_URL 은 Vite 가 빌드 시점에 문자열 리터럴로 굽는다.
# 실제 값 대신 자리를 맡아 두는 문자열로 빌드해 두고, container 가 뜰 때
# docker-entrypoint.sh 가 빌드 산출물 안의 이 문자열을 실제 값으로 치환한다.
ENV VITE_ORCHESTRATION_URL=__ARTEL_ORCHESTRATION_URL__
ENV VITE_HOME_URL=__ARTEL_HOME_URL__
RUN npm run build

# --- runtime stage ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx 이미지의 /docker-entrypoint.d/ 훅은 쓰지 않는다. 그 훅을 도는 loop 에는
# set -e 가 없어서 스크립트가 실패해도 nginx 가 그대로 뜬다. 값이 없을 때 기동을
# 확실히 실패시키려면 자체 ENTRYPOINT 여야 한다.
COPY docker-entrypoint.sh /usr/local/bin/artel-entrypoint.sh
RUN chmod +x /usr/local/bin/artel-entrypoint.sh
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/artel-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
