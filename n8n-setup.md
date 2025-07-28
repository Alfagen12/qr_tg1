# QR Scanner для Telegram Bot

## Настройка n8n Workflow

### 1. Создание Webhook узла

Создайте новый workflow в n8n и добавьте узел **Webhook**:

**Настройки Webhook:**
```
HTTP Method: POST
Path: qr-scanner
Authentication: None (или настройте по необходимости)
```

### 2. Обработка данных QR

Добавьте узел **Code** для обработки полученных данных:

```javascript
// Получаем данные из webhook
const qrData = $json.qrData;
const userId = $json.userId;
const chatId = $json.chatId;
const timestamp = $json.timestamp;

// Обрабатываем QR-код
let processedData = {
  originalData: qrData,
  userId: userId,
  chatId: chatId,
  timestamp: timestamp,
  type: 'unknown'
};

// Определяем тип QR-кода
if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
  processedData.type = 'url';
  processedData.url = qrData;
} else if (qrData.includes('@')) {
  processedData.type = 'email';
  processedData.email = qrData;
} else if (qrData.startsWith('tel:')) {
  processedData.type = 'phone';
  processedData.phone = qrData.replace('tel:', '');
} else if (qrData.startsWith('WIFI:')) {
  processedData.type = 'wifi';
  // Парсинг WiFi QR
  const wifiMatch = qrData.match(/WIFI:T:(.*?);S:(.*?);P:(.*?);/);
  if (wifiMatch) {
    processedData.wifi = {
      security: wifiMatch[1],
      ssid: wifiMatch[2],
      password: wifiMatch[3]
    };
  }
} else {
  processedData.type = 'text';
  processedData.text = qrData;
}

return [processedData];
```

### 3. Отправка ответа в Telegram

Добавьте узел **Telegram** для отправки результата:

```javascript
// Формируем сообщение в зависимости от типа QR-кода
let message = `🔍 QR-код распознан!\n\n`;

switch ($json.type) {
  case 'url':
    message += `🌐 Ссылка: ${$json.url}`;
    break;
  case 'email':
    message += `📧 Email: ${$json.email}`;
    break;
  case 'phone':
    message += `📞 Телефон: ${$json.phone}`;
    break;
  case 'wifi':
    message += `📶 WiFi настройки:\n`;
    message += `SSID: ${$json.wifi.ssid}\n`;
    message += `Пароль: ${$json.wifi.password}\n`;
    message += `Тип: ${$json.wifi.security}`;
    break;
  default:
    message += `📝 Текст: ${$json.originalData}`;
}

message += `\n\n⏰ ${new Date($json.timestamp).toLocaleString('ru-RU')}`;

return [{
  chatId: $json.chatId,
  text: message,
  parse_mode: 'HTML'
}];
```

### 4. Создание команды в Telegram Bot

Добавьте узел **Telegram Trigger** для команды `/scan`:

```javascript
// Обработчик команды /scan
const chatId = $json.message.chat.id;
const userId = $json.message.from.id;

// URL веб-приложения на GitHub Pages
const webAppUrl = `https://alfagen12.github.io/qr_tg1/?userId=${userId}&chatId=${chatId}&webhook=${encodeURIComponent('https://your-n8n-instance.com/webhook/qr-scanner')}`;

const message = `📷 Для сканирования QR-кода откройте веб-приложение:\n\n${webAppUrl}\n\n💡 Инструкция:\n1. Откройте ссылку\n2. Разрешите доступ к камере\n3. Наведите на QR-код\n4. Результат будет отправлен автоматически`;

return [{
  chatId: chatId,
  text: message,
  parse_mode: 'HTML'
}];
```

## Пример полного Workflow

```json
{
  "nodes": [
    {
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "parameters": {
        "authenticationMethod": "accessToken",
        "accessToken": "YOUR_BOT_TOKEN"
      }
    },
    {
      "name": "Check Command",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.message.text}}",
              "operation": "startsWith",
              "value2": "/scan"
            }
          ]
        }
      }
    },
    {
      "name": "Send WebApp Link",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "operation": "sendMessage",
        "chatId": "={{$json.message.chat.id}}",
        "text": "📷 Для сканирования QR-кода откройте веб-приложение:\n\nhttps://alfagen12.github.io/qr_tg1/?userId={{$json.message.from.id}}&chatId={{$json.message.chat.id}}&webhook={{encodeURIComponent('https://your-n8n-instance.com/webhook/qr-scanner')}}"
      }
    },
    {
      "name": "QR Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "qr-scanner"
      }
    },
    {
      "name": "Process QR Data",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// Код обработки QR данных (см. выше)"
      }
    },
    {
      "name": "Send Result",
      "type": "n8n-nodes-base.telegram",
      "parameters": {
        "operation": "sendMessage",
        "chatId": "={{$json.chatId}}",
        "text": "🔍 QR-код распознан!\n\n{{$json.originalData}}"
      }
    }
  ],
  "connections": {
    "Telegram Trigger": {
      "main": [["Check Command"]]
    },
    "Check Command": {
      "main": [["Send WebApp Link"]]
    },
    "QR Webhook": {
      "main": [["Process QR Data"]]
    },
    "Process QR Data": {
      "main": [["Send Result"]]
    }
  }
}
```

## Безопасность

1. **HTTPS обязательно** - для доступа к камере
2. **Webhook аутентификация** - добавьте токен проверки
3. **Rate limiting** - ограничьте количество запросов
4. **CORS настройки** - разрешите запросы только с вашего домена

## Тестирование

1. Активируйте workflow в n8n
2. Отправьте команду `/scan` боту
3. Откройте полученную ссылку
4. Отсканируйте тестовый QR-код
5. Проверьте получение результата в Telegram
