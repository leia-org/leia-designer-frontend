FROM node:lts-alpine

WORKDIR /leia-designer-frontend

COPY . .

RUN npm ci && \
    npm run build && \
    rm -rf $(npm get cache)

ENTRYPOINT ["node", "server.cjs"]
