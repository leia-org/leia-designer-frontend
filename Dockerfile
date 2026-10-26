# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG BUILD_CONFIG_DIGEST
RUN --mount=type=secret,id=vite_env,target=/app/.env.local,required=true \
    test -n "$BUILD_CONFIG_DIGEST" && WORKERS_CI=1 npm run build

FROM nginx:stable-alpine
ENV PORT=5173
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5173
