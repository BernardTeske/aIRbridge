# aIRbridge MQTT Gateway

Ein Node.js-Service, der ESP-IR-Geräte über HTTP-API steuert und virtuelle MQTT-Devices für die Homebridge-Integration bereitstellt.

## Features

- Steuert mehrere ESP-IR-Geräte über HTTP-API
- Erstellt virtuelle MQTT-Devices für jedes konfigurierte IR-Gerät
- Unterstützt mehrere baugleiche ESP-Geräte
- Einfache JSON-basierte Konfiguration
- Docker-Container mit Multi-Architecture Support (ARM für Raspberry Pi)
- Automatischer Build und Push zu GitHub Container Registry (GHCR)

## Architektur

```
MQTT Broker
    ↓ (subscribe: {topic}/set)
Node.js Service
    ↓ (HTTP GET)
ESP Device (192.168.x.x/send?code=0x...)
    ↓ (IR Signal)
IR Device
```

## Voraussetzungen

- Node.js 20+ (für lokale Entwicklung)
- Docker und Docker Compose
- MQTT-Broker (z.B. Mosquitto)
- ESP-Geräte mit HTTP-API

## Installation

### Mit Docker Compose (empfohlen)

1. Klone das Repository:
```bash
git clone <repository-url>
cd aIRbridge
```

2. Erstelle die Device-Konfiguration:
```bash
# Bearbeite config/devices.json mit deinen Geräten
```

3. Erstelle eine `.env` Datei (optional, für lokale Entwicklung):
```bash
cp env.example .env
# Bearbeite .env mit deinen MQTT-Broker-Einstellungen
```

4. Passe die `docker-compose.yml` an:
   - Ersetze `<dein-username>` in der `image:` Zeile mit deinem GitHub-Benutzernamen
   - Stelle sicher, dass das `smart-home` Netzwerk existiert (oder entferne die `networks:` Sektion)

5. Stelle sicher, dass das Docker-Netzwerk existiert (falls verwendet):
```bash
docker network create smart-home
```

6. Starte den Service:
```bash
docker-compose up -d
```

### Lokale Entwicklung

1. Installiere Dependencies:
```bash
yarn install
```

2. Erstelle `.env` Datei (siehe oben)

3. Starte den Service:
```bash
yarn start
```

## Konfiguration

### Device-Konfiguration (`config/devices.json`)

Jedes virtuelle IR-Device wird in der JSON-Datei konfiguriert:

```json
[
  {
    "id": "tv-living-room",
    "name": "TV Wohnzimmer",
    "espIp": "192.168.4.135",
    "mqttTopic": "ir-device/tv-living-room",
    "onCode": "0x0FC1",
    "offCode": "0x07C8"
  },
  {
    "id": "tv-bedroom",
    "name": "TV Schlafzimmer",
    "espIp": "192.168.4.136",
    "mqttTopic": "ir-device/tv-bedroom",
    "onCode": "0x1FC2",
    "offCode": "0x2FC3"
  }
]
```

**Felder:**
- `id`: Eindeutige Device-ID (alphanumerisch, Bindestriche erlaubt)
- `name`: Anzeigename (optional, für Logging)
- `espIp`: IP-Adresse des ESP-Geräts
- `mqttTopic`: MQTT-Topic-Präfix (ohne `/set` oder `/status`)
- `onCode`: Hex-Code für AN-Befehl (z.B. "0x0FC1")
- `offCode`: Hex-Code für AUS-Befehl (z.B. "0x07C8")

### Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `MQTT_BROKER_HOST` | MQTT-Broker Hostname/IP | **erforderlich** |
| `MQTT_BROKER_PORT` | MQTT-Broker Port | `1883` |
| `MQTT_USERNAME` | MQTT-Benutzername | (optional) |
| `MQTT_PASSWORD` | MQTT-Passwort | (optional) |
| `CONFIG_PATH` | Pfad zur devices.json | `/app/config/devices.json` |

## MQTT-Topics

### Befehle senden

Sende `ON` oder `OFF` an das Topic `{mqttTopic}/set`:

```bash
mosquitto_pub -h localhost -t "ir-device/tv-living-room/set" -m "ON"
mosquitto_pub -h localhost -t "ir-device/tv-living-room/set" -m "OFF"
```

### Status abonnieren

Der Service publiziert den aktuellen Status auf `{mqttTopic}/status`:

```bash
mosquitto_sub -h localhost -t "ir-device/tv-living-room/status"
```

## Homebridge Integration

Für die Integration in Homebridge kannst du ein MQTT-Plugin verwenden, z.B.:
- `homebridge-mqttthing`
- `homebridge-mqtt`

Beispiel-Konfiguration für `homebridge-mqttthing`:

```json
{
  "accessory": "mqttthing",
  "type": "switch",
  "name": "TV Wohnzimmer",
  "url": "mqtt://localhost:1883",
  "topics": {
    "getOn": "ir-device/tv-living-room/status",
    "setOn": "ir-device/tv-living-room/set"
  },
  "onValue": "ON",
  "offValue": "OFF"
}
```

## Docker Image von GHCR

Das Image wird automatisch bei jedem Push zu `main`/`master` gebaut und zu GHCR gepusht.

### Image verwenden

1. Erstelle `docker-compose.yml`:
```yaml
version: '3.8'

services:
  airbridge-gateway:
    image: ghcr.io/<dein-username>/airbridge-mqtt-gateway:latest
    container_name: airbridge-gateway
    restart: unless-stopped
    environment:
      - MQTT_BROKER_HOST=mosquitto
      - MQTT_BROKER_PORT=1883
    volumes:
      - ./config/devices.json:/app/config/devices.json:ro
    networks:
      - smart-home
```

2. Starte den Container:
```bash
docker-compose up -d
```

## Entwicklung

### Lokale Entwicklung

```bash
# Installiere Dependencies
yarn install

# Starte im Watch-Mode
yarn dev

# Oder normal starten
yarn start
```

### Tests

```bash
# Teste MQTT-Verbindung
mosquitto_pub -h localhost -t "ir-device/tv-living-room/set" -m "ON"

# Prüfe Logs
docker-compose logs -f airbridge-gateway
```

## Troubleshooting

### ESP-Gerät antwortet nicht

- Prüfe, ob die IP-Adresse korrekt ist
- Stelle sicher, dass das ESP-Gerät im selben Netzwerk ist
- Prüfe die ESP-Logs

### MQTT-Verbindung schlägt fehl

- Prüfe `MQTT_BROKER_HOST` und `MQTT_BROKER_PORT`
- Stelle sicher, dass der MQTT-Broker erreichbar ist
- Prüfe Benutzername/Passwort falls konfiguriert

### Device-Konfiguration wird nicht geladen

- Prüfe den Pfad in `CONFIG_PATH`
- Stelle sicher, dass die JSON-Datei valide ist
- Prüfe die Container-Logs: `docker-compose logs airbridge-gateway`

## Lizenz

MIT

