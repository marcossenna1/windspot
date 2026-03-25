FROM node:20-alpine

# Sharp needs native binaries; install build deps
RUN apk add --no-cache vips-dev fftw-dev gcc g++ make python3

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8001

CMD ["node", "index.js"]
