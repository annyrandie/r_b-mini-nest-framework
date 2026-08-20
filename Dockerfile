FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY test ./test

RUN chown -R node:node /app
USER node

CMD ["npm", "test"]
