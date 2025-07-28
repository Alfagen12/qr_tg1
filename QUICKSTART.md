# 🚀 Быстрый старт

## Готовое приложение

Ваше веб-приложение для сканирования QR-кодов готово и развернуто на Netlify!

**URL приложения:** https://tgqr1.netlify.app/

## Что уже сделано ✅

- ✅ Веб-приложение с современным дизайном
- ✅ Поддержка BarcodeDetector API
- ✅ Адаптивный дизайн для мобильных устройств
- ✅ Интеграция с n8n через webhook
- ✅ Автоматическое развертывание на Netlify
- ✅ Тестовая страница с примерами QR-кодов

## Следующие шаги

### 1. Настройка n8n (обязательно)

1. Откройте ваш n8n и создайте новый workflow
2. Следуйте инструкциям в файле `n8n-setup.md`
3. Замените `https://your-n8n-instance.com/webhook/qr-scanner` на реальный URL вашего webhook

### 2. Тестирование

1. Откройте https://tgqr1.netlify.app/test.html для тестовых QR-кодов
2. Откройте основное приложение: https://tgqr1.netlify.app/
3. Проверьте работу сканера

### 3. Интеграция с Telegram ботом

В вашем n8n workflow используйте этот URL для отправки пользователям:

```
https://tgqr1.netlify.app/?userId=USER_ID&chatId=CHAT_ID&webhook=YOUR_WEBHOOK_URL
```

## Пример использования в n8n

### Команда /scan в Telegram боте:

```javascript
const chatId = $json.message.chat.id;
const userId = $json.message.from.id;
const webhookUrl = 'https://your-n8n-instance.com/webhook/qr-scanner';

const appUrl = `https://tgqr1.netlify.app/?userId=${userId}&chatId=${chatId}&webhook=${encodeURIComponent(webhookUrl)}`;

return [{
  chatId: chatId,
  text: `📷 Нажмите на ссылку для сканирования QR-кода:\n\n${appUrl}`,
  parse_mode: 'HTML'
}];
```

## Важные особенности

### Безопасность
- Приложение требует HTTPS для доступа к камере
- Netlify автоматически предоставляет HTTPS

### Поддержка браузеров
- ✅ Chrome 83+
- ✅ Edge 83+
- ✅ Samsung Internet 13.0+
- ❌ Firefox (пока не поддерживает BarcodeDetector API)
- ❌ Safari (пока не поддерживает BarcodeDetector API)

### Мобильные устройства
- Автоматически использует заднюю камеру
- Адаптивный дизайн
- Поддержка Telegram WebApp

## Структура проекта

```
qr_tg1/
├── index.html          # Основное приложение
├── test.html           # Тестовые QR-коды
├── js/app.js           # Логика приложения
├── README.md           # Документация
├── n8n-setup.md        # Настройка n8n
├── package.json        # Конфигурация проекта
└── .github/workflows/  # GitHub Actions для автодеплоя
    └── deploy.yml
```

## Поддержка

Если возникают проблемы:

1. Проверьте поддержку BarcodeDetector API в браузере
2. Убедитесь, что сайт открыт по HTTPS
3. Проверьте разрешения для доступа к камере
4. Убедитесь, что webhook URL корректный

## Дальнейшая разработка

Вы можете:
- Добавить поддержку других типов штрих-кодов
- Реализовать fallback для браузеров без BarcodeDetector API
- Добавить историю сканирований
- Улучшить UI/UX
