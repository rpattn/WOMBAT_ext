# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine
# Copy the 'dist' folder from the build stage (Vite outputs to 'dist')
COPY --from=builder /app/dist /usr/share/nginx/html
# Expose port 80 for Nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]