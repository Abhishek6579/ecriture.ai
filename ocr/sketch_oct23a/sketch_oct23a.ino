#include "esp_camera.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "img_converters.h" // Required for frame2jpg

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define FLASH_LED_PIN 4  // Built-in flash LED pin

bool led_on = false;     // <--- CHANGE 1: Track if LED is currently ON
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Use 921600 for reliability. Higher may corrupt with CH340.
#define SERIAL_BAUD 921600

// JPEG Quality (0-100). Lower = smaller file, faster transfer, worse quality.
// 60-70 is a good balance for text.
#define JPEG_QUALITY 65

void setup() {
  Serial.begin(SERIAL_BAUD);
  Serial.setTxBufferSize(16384);
  Serial.setRxBufferSize(1024);

 pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;

  // Capture raw RGB565 from the RHYX sensor
  config.pixel_format = PIXFORMAT_RGB565;
  config.frame_size   = FRAMESIZE_QVGA; // 320x240
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.fb_count     = 1; // Must be 1 for RGB565 on AI-Thinker

  if (esp_camera_init(&config) != ESP_OK) {
    pinMode(33, OUTPUT);
    while (1) { digitalWrite(33, !digitalRead(33)); delay(200); }
  }

  Serial.println("READY");
}

void sendJpegFrame() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    // Send 0-length header on error
    uint32_t zero = 0;
    Serial.write((uint8_t*)&zero, 4);
    return;
  }

  uint8_t *jpg_buf = NULL;
  size_t jpg_len = 0;

  // === SOFTWARE JPEG COMPRESSION ===
  // This is the CPU-intensive part. It takes ~100-300ms on ESP32.
  bool ok = frame2jpg(fb, JPEG_QUALITY, &jpg_buf, &jpg_len);

  esp_camera_fb_return(fb); // Free the raw RGB frame immediately

  if (!ok || jpg_buf == NULL) {
    uint32_t zero = 0;
    Serial.write((uint8_t*)&zero, 4);
    return;
  }

  // Send 4-byte length prefix, then JPEG data
  uint32_t len32 = (uint32_t)jpg_len;
  Serial.write((uint8_t*)&len32, 4);
  Serial.write(jpg_buf, jpg_len);

  free(jpg_buf); // MUST free the JPEG buffer
}

void loop() {
  // Wait for trigger from PC
  if (Serial.available()) {
    char cmd = Serial.read();
    if (cmd == 'C' || cmd == 'c') {
      sendJpegFrame();
    }
  }
} 