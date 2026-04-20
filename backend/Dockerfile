FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate --schema=src/prisma/schema.prisma

EXPOSE 4000

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

CMD ["sh", "entrypoint.sh"]
