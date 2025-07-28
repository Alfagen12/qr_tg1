class QRScanner {
    constructor() {
        this.video = document.getElementById('video');
        this.placeholder = document.getElementById('placeholder');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.debugBtn = document.getElementById('debugBtn');
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
        // Пример: return 'https://your-n8n-instance.com/webhook/qr-scanner';
        // Для тестирования можно использовать webhook.site или временно оставить пустым
        return this.urlParams.get('webhook') || '';
    }
    
    init() {
        this.checkBarcodeDetectorSupport();
        this.bindEvents();
        this.updateStatus('Готов к сканированию');
        
        // Добавляем информацию о браузере в консоль
        console.log('User Agent:', navigator.userAgent);
        console.log('BarcodeDetector поддерживается:', 'BarcodeDetector' in window);
    }
    
    checkBarcodeDetectorSupport() {
        if (!('BarcodeDetector' in window)) {
            this.showError('BarcodeDetector API не поддерживается в этом браузере. Попробуйте использовать Chrome или Edge.');
            this.startBtn.disabled = true;
            return false;
        }
        
        // Проверяем поддержку QR кодов
        try {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            console.log('BarcodeDetector поддерживается:', detector);
            return true;
        } catch (error) {
            console.error('Ошибка создания BarcodeDetector:', error);
            this.showError('Ошибка инициализации сканера QR-кодов.');
            this.startBtn.disabled = true;
            return false;
        }
    }
    
    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startScanning());
        this.stopBtn.addEventListener('click', () => this.stopScanning());
        this.debugBtn.addEventListener('click', () => this.showDebugInfo());
        
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
        
        // Добавляем обработчик событий видео
        this.video.addEventListener('loadeddata', () => {
            console.log('Видео данные загружены');
        });
        
        this.video.addEventListener('canplay', () => {
            console.log('Видео готово к воспроизведению');
        });
        
        this.video.addEventListener('error', (error) => {
            console.error('Ошибка видео:', error);
        });
    }
    
    async startScanning() {
        try {
            this.updateStatus('Запуск камеры...', 'scanning');
            
            // Запрашиваем доступ к камере
            const constraints = {
                video: {
                    facingMode: 'environment', // Задняя камера на мобильных устройствах
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 }
                }
            };
            
            console.log('Запрос доступа к камере с настройками:', constraints);
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('Доступ к камере получен:', this.stream);
            this.video.srcObject = this.stream;
            this.video.style.display = 'block';
            this.placeholder.style.display = 'none';
            
            // Ждем загрузки видео
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    console.log('Видео загружено, размеры:', this.video.videoWidth, 'x', this.video.videoHeight);
                    resolve();
                };
                this.video.onerror = (error) => {
                    console.error('Ошибка загрузки видео:', error);
                    reject(error);
                };
                
                // Таймаут на случай зависания
                setTimeout(() => reject(new Error('Таймаут загрузки видео')), 10000);
            });
            
            this.isScanning = true;
            this.startBtn.style.display = 'none';
            this.stopBtn.style.display = 'inline-block';
            
            this.updateStatus('Сканирование... Наведите камеру на QR-код', 'scanning');
            
            // Начинаем сканирование
            this.startDetection();
            
        } catch (error) {
            console.error('Ошибка при запуске камеры:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showError('Доступ к камере запрещен. Разрешите использование камеры и обновите страницу.');
            } else if (error.name === 'NotFoundError') {
                this.showError('Камера не найдена. Убедитесь, что устройство имеет камеру.');
            } else if (error.name === 'NotReadableError') {
                this.showError('Камера уже используется другим приложением.');
            } else {
                this.showError(`Не удалось получить доступ к камере: ${error.message}`);
            }
        }
    }
    
    startDetection() {
        if (!this.isScanning) return;
        
        console.log('Запуск детекции QR-кодов...');
        
        try {
            const barcodeDetector = new BarcodeDetector({
                formats: ['qr_code']
            });
            
            let scanCount = 0;
            const maxScans = 1000; // Максимальное количество попыток сканирования
            
            const detect = async () => {
                if (!this.isScanning || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
                    if (this.isScanning) {
                        // Повторяем через короткий интервал, если видео еще не готово
                        this.scanInterval = setTimeout(detect, 100);
                    }
                    return;
                }
                
                scanCount++;
                
                try {
                    console.log(`Попытка сканирования #${scanCount}, готовность видео:`, this.video.readyState);
                    
                    const barcodes = await barcodeDetector.detect(this.video);
                    console.log('Результат сканирования:', barcodes);
                    
                    if (barcodes.length > 0) {
                        const qrData = barcodes[0].rawValue;
                        console.log('QR-код обнаружен:', qrData);
                        await this.handleQRDetected(qrData);
                        return; // Останавливаем сканирование после успешного распознавания
                    }
                    
                    // Обновляем статус каждые 50 попыток
                    if (scanCount % 50 === 0) {
                        this.updateStatus(`Сканирование... (попытка ${scanCount})`, 'scanning');
                    }
                    
                } catch (error) {
                    console.error('Ошибка детекции:', error);
                    if (scanCount % 100 === 0) {
                        this.updateStatus(`Ошибка сканирования, продолжаем... (${scanCount})`, 'error');
                    }
                }
                
                // Проверяем лимит попыток
                if (scanCount >= maxScans) {
                    console.warn('Достигнут лимит попыток сканирования');
                    this.updateStatus('Слишком много попыток. Попробуйте перезапустить сканирование.', 'error');
                    return;
                }
                
                // Продолжаем сканирование
                if (this.isScanning) {
                    this.scanInterval = setTimeout(detect, 100);
                }
            };
            
            detect();
            
        } catch (error) {
            console.error('Ошибка инициализации детектора:', error);
            this.showError('Ошибка инициализации сканера QR-кодов');
        }
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
    
    showDebugInfo() {
        const debugInfo = {
            userAgent: navigator.userAgent,
            barcodeDetectorSupported: 'BarcodeDetector' in window,
            mediaDevicesSupported: !!navigator.mediaDevices,
            getUserMediaSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            videoElement: {
                readyState: this.video.readyState,
                videoWidth: this.video.videoWidth,
                videoHeight: this.video.videoHeight,
                paused: this.video.paused
            },
            streamActive: this.stream ? this.stream.active : false,
            isScanning: this.isScanning,
            webhookUrl: this.webhookUrl,
            userId: this.userId,
            chatId: this.chatId
        };
        
        console.log('Debug Info:', debugInfo);
        
        this.result.className = 'result';
        this.result.innerHTML = `
            <strong>Debug Information:</strong>
            <div class="qr-data">${JSON.stringify(debugInfo, null, 2)}</div>
            <small>Информация также выведена в консоль браузера</small>
        `;
        this.result.style.display = 'block';
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
