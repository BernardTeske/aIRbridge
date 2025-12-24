const axios = require('axios');

class ESPClient {
  constructor(espIp, maxRetries = 3, retryDelay = 1000, repeatCount = 5, repeatDelay = 200) {
    this.espIp = espIp;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.repeatCount = repeatCount; // Anzahl der Wiederholungen
    this.repeatDelay = repeatDelay; // Verzögerung zwischen Wiederholungen (ms)
  }

  /**
   * Sendet einen einzelnen HTTP-Request an das ESP-Gerät
   * @param {string} code - Hex-Code (z.B. "0x0FC1")
   * @returns {Promise<boolean>} - true bei Erfolg, false bei Fehler
   */
  async sendSingleRequest(code) {
    const url = `http://${this.espIp}/send?code=${code}`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          validateStatus: (status) => status < 500 // Akzeptiere 2xx, 3xx, 4xx
        });

        if (response.status === 200) {
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

  /**
   * Sendet einen IR-Code mehrmals hintereinander an das ESP-Gerät
   * @param {string} code - Hex-Code (z.B. "0x0FC1")
   * @returns {Promise<boolean>} - true bei Erfolg, false bei Fehler
   */
  async sendCode(code) {
    console.log(`[ESP ${this.espIp}] Sende Code ${code} ${this.repeatCount} Mal...`);
    
    let successCount = 0;
    for (let i = 1; i <= this.repeatCount; i++) {
      const success = await this.sendSingleRequest(code);
      if (success) {
        successCount++;
        console.log(`[ESP ${this.espIp}] Code ${code} erfolgreich gesendet (${i}/${this.repeatCount})`);
      } else {
        console.warn(`[ESP ${this.espIp}] Code ${code} fehlgeschlagen (${i}/${this.repeatCount})`);
      }
      
      // Verzögerung zwischen den Wiederholungen (außer beim letzten Mal)
      if (i < this.repeatCount) {
        await this.sleep(this.repeatDelay);
      }
    }

    const allSuccess = successCount === this.repeatCount;
    if (allSuccess) {
      console.log(`[ESP ${this.espIp}] Code ${code} erfolgreich ${this.repeatCount} Mal gesendet`);
    } else {
      console.warn(`[ESP ${this.espIp}] Code ${code} nur ${successCount}/${this.repeatCount} Mal erfolgreich gesendet`);
    }

    // Rückgabe true, wenn mindestens eine Sendung erfolgreich war
    return successCount > 0;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ESPClient;

