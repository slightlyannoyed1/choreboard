FROM node:20-alpine AS builder
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./
COPY --from=builder /app/client/dist ./public
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "index.js"]