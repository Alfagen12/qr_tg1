class QRScanner {
    constructor() {
        this.video = document.getElementById('video');
        this.placeholder = document.getElementById('placeholder');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.status = document.getElementById('status');
        this.result = document.getElementById('result');
        
        this.stream = null;
        this.isScanning = false;
        this.scanInterval = null;
        
        // Получаем параметры из URL для интеграции с n8n
        this.urlParams = new URLSearchParams(window.location.search);
        this.webhookUrl = this.urlParams.get('webhook') || this.getDefaultWebhookUrl();
        this.userId = this.urlParams.get('userId');
        this.chatId = this.urlParams.get('chatId');
        
        this.init();
    }
    
    getDefaultWebhookUrl() {
        // Замените на ваш URL webhook n8n
        return 'https://your-n8n-instance.com/webhook/qr-scanner';
    }
    
    init() {
        this.checkBarcodeDetectorSupport();
        this.bindEvents();
        this.updateStatus('Готов к сканированию');
    }
    
    checkBarcodeDetectorSupport() {
        if (!('BarcodeDetector' in window)) {
            this.showError('BarcodeDetector API не поддерживается в этом браузере. Попробуйте использовать Chrome или Edge.');
            this.startBtn.disabled = true;
            return false;
        }
        return true;
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startScanning());
        this.stopBtn.addEventListener('click', () => this.stopScanning());
        
        // Обработка закрытия страницы
        window.addEventListener('beforeunload', () => this.stopScanning());
        
        // Обработка потери фокуса (например, при сворачивании браузера)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isScanning) {
                this.pauseScanning();
            } else if (!document.hidden && this.stream && !this.isScanning) {
                this.resumeScanning();
            }
        });
    }
    
    async startScanning() {
        try {
            this.updateStatus('Запуск камеры...', 'scanning');
            
            // Запрашиваем доступ к камере
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Задняя камера на мобильных устройствах
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            this.video.srcObject = this.stream;
            this.video.style.display = 'block';
            this.placeholder.style.display = 'none';
            
            // Ждем загрузки видео
            await new Promise((resolve) => {
                this.video.onloadedmetadata = resolve;
            });
            
            this.isScanning = true;
            this.startBtn.style.display = 'none';
            this.stopBtn.style.display = 'inline-block';
            
            this.updateStatus('Сканирование... Наведите камеру на QR-код', 'scanning');
            
            // Начинаем сканирование
            this.startDetection();
            
        } catch (error) {
            console.error('Ошибка при запуске камеры:', error);
            this.showError(`Не удалось получить доступ к камере: ${error.message}`);
        }
    }
    
    startDetection() {
        if (!this.isScanning) return;
        
        const barcodeDetector = new BarcodeDetector({
            formats: ['qr_code']
        });
        
        const detect = async () => {
            if (!this.isScanning || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
                return;
            }
            
            try {
                const barcodes = await barcodeDetector.detect(this.video);
                
                if (barcodes.length > 0) {
                    const qrData = barcodes[0].rawValue;
                    await this.handleQRDetected(qrData);
                    return; // Останавливаем сканирование после успешного распознавания
                }
            } catch (error) {
                console.error('Ошибка детекции:', error);
            }
            
            // Продолжаем сканирование
            if (this.isScanning) {
                this.scanInterval = setTimeout(detect, 100);
            }
        };
        
        detect();
    }
    
    async handleQRDetected(qrData) {
        this.updateStatus('QR-код обнаружен! Отправка данных...', 'success');
        
        try {
            // Отправляем данные в n8n
            const response = await this.sendToN8N(qrData);
            
            if (response.ok) {
                this.showSuccess(`QR-код успешно обработан!`, qrData);
                this.updateStatus('Данные успешно отправлены', 'success');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('Ошибка отправки в n8n:', error);
            this.showError(`Ошибка отправки данных: ${error.message}`);
            // Показываем данные локально, даже если отправка не удалась
            this.showSuccess(`QR-код распознан (локально):`, qrData);
        }
        
        // Автоматически останавливаем сканирование через 3 секунды
        setTimeout(() => {
            if (this.isScanning) {
                this.stopScanning();
            }
        }, 3000);
    }
    
    async sendToN8N(qrData) {
        const payload = {
            qrData: qrData,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ...(this.userId && { userId: this.userId }),
            ...(this.chatId && { chatId: this.chatId })
        };
        
        return fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
    }
    
    stopScanning() {
        this.isScanning = false;
        
        if (this.scanInterval) {
            clearTimeout(this.scanInterval);
            this.scanInterval = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video.style.display = 'none';
        this.placeholder.style.display = 'flex';
        this.startBtn.style.display = 'inline-block';
        this.stopBtn.style.display = 'none';
        
        this.updateStatus('Сканирование остановлено');
    }
    
    pauseScanning() {
        this.isScanning = false;
        if (this.scanInterval) {
            clearTimeout(this.scanInterval);
            this.scanInterval = null;
        }
    }
    
    resumeScanning() {
        if (this.stream && !this.isScanning) {
            this.isScanning = true;
            this.startDetection();
            this.updateStatus('Сканирование возобновлено...', 'scanning');
        }
    }
    
    updateStatus(message, type = '') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
    }
    
    showSuccess(message, qrData) {
        this.result.className = 'result success';
        this.result.innerHTML = `
            <strong>${message}</strong>
            <div class="qr-data">${this.escapeHtml(qrData)}</div>
            <small>Данные отправлены в n8n для обработки</small>
        `;
        this.result.style.display = 'block';
    }
    
    showError(message) {
        this.result.className = 'result error';
        this.result.innerHTML = `<strong>Ошибка:</strong> ${this.escapeHtml(message)}`;
        this.result.style.display = 'block';
        this.updateStatus('Ошибка', 'error');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new QRScanner();
});

// Дополнительная проверка для Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    // Настройка для Telegram WebApp
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}
