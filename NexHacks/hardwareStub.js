// Hardware Control Agent Stub
// Simulates Arduino hardware control without actual hardware

class HardwareStub {
  constructor() {
    this.position = 0; // mm
    this.ledBrightness = 0; // PWM 0-255
    this.ledOnTime = 0; // ms LED has been on
    this.lastLEDOn = 0;
    this.dutyWindowStart = Date.now();
    this.dutyWindowMS = 5 * 60 * 1000; // 5 minutes
    this.maxLEDTimePerWindow = 60 * 1000; // 60 seconds
  }

  async moveLightSource(positionMm) {
    // Validate position
    if (positionMm < 0 || positionMm > 50) {
      return {
        ack: false,
        error: "Position out of bounds (0-50mm)",
        position_mm: this.position
      };
    }

    // Simulate 200ms latency
    await new Promise(resolve => setTimeout(resolve, 200));

    this.position = positionMm;
    
    return {
      position_mm: this.position,
      ack: true,
      duty_cycle_remaining_s: this.getDutyCycleRemaining()
    };
  }

  async setLED(brightness) {
    // Validate brightness
    if (brightness < 0 || brightness > 255) {
      return {
        ack: false,
        error: "Brightness out of range (0-255)"
      };
    }

    // Check duty cycle
    const dutyStatus = this.getDutyStatus();
    if (brightness > 0 && dutyStatus === "DUTY_LIMIT") {
      return {
        ack: false,
        error: "Duty cycle limit exceeded",
        brightness: 0
      };
    }

    // Simulate 200ms latency
    await new Promise(resolve => setTimeout(resolve, 200));

    // Track LED on time
    if (this.ledBrightness > 0 && brightness === 0) {
      // Turning off
      const onDuration = Date.now() - this.lastLEDOn;
      this.ledOnTime += onDuration;
    } else if (this.ledBrightness === 0 && brightness > 0) {
      // Turning on
      this.lastLEDOn = Date.now();
    }

    this.ledBrightness = brightness;
    
    return {
      brightness: this.ledBrightness,
      ack: true,
      duty_cycle_remaining_s: this.getDutyCycleRemaining()
    };
  }

  getDutyCycleRemaining() {
    const now = Date.now();
    const windowElapsed = now - this.dutyWindowStart;
    
    // Reset window if expired
    if (windowElapsed > this.dutyWindowMS) {
      this.dutyWindowStart = now;
      this.ledOnTime = 0;
      if (this.ledBrightness > 0) {
        this.lastLEDOn = now;
      }
      return this.maxLEDTimePerWindow / 1000;
    }

    // Calculate current LED on time
    let currentOnTime = this.ledOnTime;
    if (this.ledBrightness > 0) {
      currentOnTime += (now - this.lastLEDOn);
    }

    const remaining = Math.max(0, this.maxLEDTimePerWindow - currentOnTime);
    return Math.floor(remaining / 1000);
  }

  getDutyStatus() {
    const remaining = this.getDutyCycleRemaining();
    return remaining > 0 ? "DUTY_OK" : "DUTY_LIMIT";
  }

  async home() {
    // Simulate 200ms latency
    await new Promise(resolve => setTimeout(resolve, 200));
    
    this.position = 0;
    
    return {
      position_mm: 0,
      ack: true
    };
  }

  getStatus() {
    return {
      position_mm: this.position,
      led_brightness: this.ledBrightness,
      duty_status: this.getDutyStatus(),
      duty_cycle_remaining_s: this.getDutyCycleRemaining()
    };
  }
}

// Export singleton instance
window.hardwareStub = new HardwareStub();
