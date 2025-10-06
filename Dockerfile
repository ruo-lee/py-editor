FROM python:3.11-alpine

# Install Node.js
RUN apk add --no-cache nodejs npm

# Create app directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies (skip root - only needed for local dev)
RUN cd server && npm install
RUN cd client && npm install

# Install Python language server with balanced features
# - python-lsp-server: Core LSP functionality
# - python-lsp-black: Auto-formatting support
# - pylsp-mypy: Type checking support (live_mode disabled for memory optimization)
# - pyflakes: Syntax error detection
RUN pip install python-lsp-server python-lsp-black pylsp-mypy pyflakes

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Create workspace directory
RUN mkdir -p /app/workspace
RUN mkdir -p /app/snippets

# Default Python snippets
COPY snippets/python.json /app/snippets/

# Set environment variable for version
ENV APP_VERSION=dev

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]