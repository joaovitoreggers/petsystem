# Imagem única (sem otimização de tamanho) para esta prova de conceito: o
# monorepo Nx compartilha um único node_modules entre back-end e front-end,
# então o container do back-end acaba carregando também as dependências do
# Angular. Suficiente para o desafio; um workspace com pastas de dependência
# separadas por app reduziria isso.
FROM node:24-alpine

WORKDIR /app

# python3/make/g++: necessários para compilar os módulos nativos (bcrypt, pg).
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx run backend:build

EXPOSE 3000

CMD ["node", "apps/backend/dist/main.js"]
