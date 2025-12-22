require('dotenv').config();
const mqtt = require('mqtt');
const fs = require('fs').promises;
const path = require('path');
const ESPClient = require('./espClient');

class IRBridgeGateway {
  constructor() {
    this.devices = [];
    this.mqttClient = null;
    this.deviceClients = new Map(); // Map von deviceId -> ESPClient
  }

  /**
   * Lädt die Device-Konfiguration aus der JSON-Datei
   */
  async loadConfig() {
    const configPath = process.env.CONFIG_PATH || '/app/config/devices.json';
    
    try {
      const data = await fs.readFile(configPath, 'utf8');
      this.devices = JSON.parse(data);
      
      if (!Array.isArray(this.devices)) {
        throw new Error('Konfiguration muss ein Array von Devices sein');
      }

      console.log(`[Config] ${this.devices.length} Device(s) geladen`);
      
      // Erstelle ESP-Clients für jedes Device
      this.devices.forEach(device => {
        if (!device.espIp || !device.mqttTopic || !device.onCode || !device.offCode) {
          throw new Error(`Device ${device.id || 'unbekannt'} hat unvollständige Konfiguration`);
        }
        this.deviceClients.set(device.id, new ESPClient(device.espIp));
      });

      return true;
    } catch (error) {
      console.error(`[Config] Fehler beim Laden der Konfiguration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verbindet sich mit dem MQTT-Broker
   */
  connectMQTT() {
    const brokerHost = process.env.MQTT_BROKER_HOST;
    const brokerPort = process.env.MQTT_BROKER_PORT || 1883;
    const username = process.env.MQTT_USERNAME;
    const password = process.env.MQTT_PASSWORD;

    if (!brokerHost) {
      throw new Error('MQTT_BROKER_HOST Umgebungsvariable ist nicht gesetzt');
    }

    const options = {
      host: brokerHost,
      port: brokerPort,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
    };

    if (username) {
      options.username = username;
    }
    if (password) {
      options.password = password;
    }

    const brokerUrl = `mqtt://${brokerHost}:${brokerPort}`;
    console.log(`[MQTT] Verbinde mit Broker: ${brokerUrl}`);

    this.mqttClient = mqtt.connect(brokerUrl, options);

    this.mqttClient.on('connect', () => {
      console.log('[MQTT] Verbindung hergestellt');
      this.subscribeToDevices();
    });

    this.mqttClient.on('error', (error) => {
      console.error('[MQTT] Fehler:', error.message);
    });

    this.mqttClient.on('close', () => {
      console.log('[MQTT] Verbindung geschlossen');
    });

    this.mqttClient.on('reconnect', () => {
      console.log('[MQTT] Verbinde neu...');
    });

    this.mqttClient.on('offline', () => {
      console.log('[MQTT] Offline');
    });
  }

  /**
   * Subscribt auf alle Device-Topics
   */
  subscribeToDevices() {
    this.devices.forEach(device => {
      const setTopic = `${device.mqttTopic}/set`;
      this.mqttClient.subscribe(setTopic, (err) => {
        if (err) {
          console.error(`[MQTT] Fehler beim Subscriben auf ${setTopic}:`, err.message);
        } else {
          console.log(`[MQTT] Subscribed auf ${setTopic}`);
        }
      });
    });
  }

  /**
   * Verarbeitet eingehende MQTT-Nachrichten
   */
  setupMessageHandler() {
    this.mqttClient.on('message', async (topic, message) => {
      const payload = message.toString().trim().toUpperCase();
      
      // Finde das Device basierend auf dem Topic
      const device = this.devices.find(d => topic === `${d.mqttTopic}/set`);
      
      if (!device) {
        console.warn(`[MQTT] Unbekanntes Topic: ${topic}`);
        return;
      }

      console.log(`[MQTT] Nachricht empfangen: ${topic} -> ${payload}`);

      if (payload !== 'ON' && payload !== 'OFF') {
        console.warn(`[MQTT] Ungültiger Payload für ${topic}: ${payload} (erwartet: ON oder OFF)`);
        return;
      }

      const espClient = this.deviceClients.get(device.id);
      if (!espClient) {
        console.error(`[Device] ESP-Client für ${device.id} nicht gefunden`);
        return;
      }

      const code = payload === 'ON' ? device.onCode : device.offCode;
      const success = await espClient.sendCode(code);

      if (success) {
        // Publishe Status-Update
        const statusTopic = `${device.mqttTopic}/status`;
        this.mqttClient.publish(statusTopic, payload, { retain: true });
        console.log(`[MQTT] Status publiziert: ${statusTopic} -> ${payload}`);
      } else {
        console.error(`[Device] Fehler beim Senden des Codes für ${device.id}`);
      }
    });
  }

  /**
   * Startet den Gateway-Service
   */
  async start() {
    try {
      await this.loadConfig();
      this.connectMQTT();
      this.setupMessageHandler();

      // Graceful Shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      console.error('[Startup] Fehler beim Starten:', error.message);
      process.exit(1);
    }
  }

  /**
   * Beendet den Service sauber
   */
  shutdown() {
    console.log('[Shutdown] Beende Service...');
    if (this.mqttClient) {
      this.mqttClient.end();
    }
    process.exit(0);
  }
}

// Starte den Service
const gateway = new IRBridgeGateway();
gateway.start();

