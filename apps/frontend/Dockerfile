FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx nx run frontend:build

FROM nginx:1.27-alpine
COPY --from=build /app/dist/apps/frontend/browser /usr/share/nginx/html
# O template é renderizado no start do container (envsubst), então o destino
# da API é configurável sem rebuild: BACKEND_URL (padrão abaixo).
COPY apps/frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=http://backend:3000
EXPOSE 80
