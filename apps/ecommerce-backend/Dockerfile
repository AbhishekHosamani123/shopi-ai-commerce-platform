# Build stage
FROM node:21-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runner stage
FROM node:21-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy built code and dependencies
COPY --from=build /app /app

EXPOSE 3500

CMD ["node", "index.js"]