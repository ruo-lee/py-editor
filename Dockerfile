FROM node:18-alpine

# Install Python and required packages (uses latest available version)
RUN apk add --no-cache python3 python3-dev py3-pip

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Install Python language server
RUN pip3 install --break-system-packages python-lsp-server[all] pylsp-mypy pyflakes

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Create workspace directory
RUN mkdir -p /app/workspace
RUN mkdir -p /app/snippets

# Default Python snippets
COPY snippets/python.json /app/snippets/

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]