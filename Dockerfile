FROM node:20-alpine

# Aktiviere Corepack für Yarn 4
RUN corepack enable && corepack prepare yarn@4.12.0 --activate

WORKDIR /app

# Kopiere package.json und installiere Dependencies
COPY package.json ./
COPY yarn.lock* ./
RUN yarn install --mode=production

# Kopiere Anwendungscode
COPY src/ ./src/

# Erstelle Config-Verzeichnis
RUN mkdir -p /app/config

# Standard-Config-Pfad als Umgebungsvariable
ENV CONFIG_PATH=/app/config/devices.json

# Exponiere keinen Port (nur MQTT)
EXPOSE 1883

# Starte die Anwendung
CMD ["node", "src/index.js"]

