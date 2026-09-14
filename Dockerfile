# Multi-file project: frontend/ & backend/
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy backend package.json and install dependencies
COPY backend/package.json backend/package-lock.json* ./backend/

RUN cd backend && npm install --production

# Copy the rest of the project (frontend + backend)
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/backend

EXPOSE 3000

# Run the backend server (which serves frontend static files)
CMD ["node", "server.js"]
