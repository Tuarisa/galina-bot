# Galina Bot

Telegram-бот для управления видеокомнатами [Galene](https://galene.org).

## Функции

| Команда | Описание |
|---|---|
| `/room` | Создать новую комнату в группе `public`, вернуть ссылку |
| `/rooms` | Показать все активные комнаты с временем создания |
| `/invite [название]` | Сгенерировать токен-приглашение (24 ч) для комнаты |

Крон-задача запускается каждый час и удаляет комнаты старше 12 часов.

## Установка

```bash
npm install
cp .env.example .env
# Заполните .env
npm start
```

## Конфигурация `.env`

| Переменная | Описание | По умолчанию |
|---|---|---|
| `TELEGRAM_TOKEN` | Токен бота от @BotFather | — |
| `GALENE_URL` | URL сервера Galene | `` |
| `GALENE_ADMIN` | Логин администратора Galene | `admin` |
| `GALENE_PASSWORD` | Пароль администратора Galene | `admin` |
| `GALENE_BASE_GROUP` | Родительская группа для комнат | `public` |

## Структура проекта

```
galina-bot/
├── src/
│   ├── bot.js       # Главный файл: команды бота, крон
│   ├── galene.js    # HTTP-клиент Galene API
│   └── storage.js   # Локальное хранилище комнат (data/rooms.json)
├── data/
│   └── rooms.json   # Создаётся автоматически
├── .env.example
└── package.json
```

## Galene API

Бот использует Galene HTTP API:

- `PUT /api/group/{group}/` — создать комнату (subgroup)
- `DELETE /api/group/{group}/` — удалить комнату
- `POST /api/group/{group}/tokens/` — создать токен-приглашение

Авторизация — HTTP Basic Auth.
