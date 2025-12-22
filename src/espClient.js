const axios = require('axios');

class ESPClient {
  constructor(espIp, maxRetries = 3, retryDelay = 1000) {
    this.espIp = espIp;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Sendet einen IR-Code an das ESP-Gerät
   * @param {string} code - Hex-Code (z.B. "0x0FC1")
   * @returns {Promise<boolean>} - true bei Erfolg, false bei Fehler
   */
  async sendCode(code) {
    const url = `http://${this.espIp}/send?code=${code}`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          validateStatus: (status) => status < 500 // Akzeptiere 2xx, 3xx, 4xx
        });

        if (response.status === 200) {
          console.log(`[ESP ${this.espIp}] Code ${code} erfolgreich gesendet`);
          return true;
        } else {
          console.warn(`[ESP ${this.espIp}] Unerwarteter Status-Code: ${response.status} für Code ${code}`);
        }
      } catch (error) {
        console.error(
          `[ESP ${this.espIp}] Fehler beim Senden von Code ${code} (Versuch ${attempt}/${this.maxRetries}):`,
          error.message
        );

        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ESPClient;

