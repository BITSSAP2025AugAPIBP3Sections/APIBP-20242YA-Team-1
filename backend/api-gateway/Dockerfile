FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src/ ./src/

ENV NODE_ENV=production \
    GATEWAY_PORT=4000

EXPOSE 4000

CMD ["node", "src/index.js"]