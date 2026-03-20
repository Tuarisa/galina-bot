require('dotenv').config();

const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const { randomUUID } = require('crypto');

const galene = require('./galene');
const storage = require('./storage');
const { generateAlias } = require('./words');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

function formatDate(isoString) {
  return dateFormatter.format(new Date(isoString));
}

// /start
bot.start((ctx) =>
  ctx.reply(
    'Привет! Я управляю видеокомнатами Galene.\n\n' +
      '/room [название] — создать новую комнату\n' +
      '/rooms — список твоих активных комнат\n' +
      '/invite [название] [имя] — ссылка-приглашение для комнаты'
  )
);

// /room [alias] — создать комнату
bot.command('room', async (ctx) => {
  const alias = ctx.message.text.split(/\s+/).slice(1).join(' ').trim() || generateAlias();
  const userId = ctx.from.id;

  // Если у пользователя уже MAX комнат — удаляем самую старую
  const oldest = storage.getOldestUserRoom(userId);
  if (oldest) {
    try {
      await galene.deleteRoom(oldest.name);
      storage.removeRoom(oldest.name);
    } catch (err) {
      console.error('evict room error:', err.message);
    }
  }

  const roomName = randomUUID();
  try {
    const url = await galene.createRoom(roomName, alias);
    storage.addRoom(roomName, url, userId, alias);
    await ctx.reply(
      `Комната создана: *${alias}*\n\n🔗 ${url}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('createRoom error:', err.message);
    await ctx.reply('Не удалось создать комнату. Проверьте настройки Galene.');
  }
});

// /rooms — список комнат текущего пользователя
bot.command('rooms', async (ctx) => {
  const rooms = storage.getRoomsByUser(ctx.from.id);
  if (rooms.length === 0) {
    return ctx.reply('У тебя нет активных комнат.');
  }
  const lines = rooms.map(
    (r) => `• *${r.alias}* — создана ${formatDate(r.createdAt)}\n  ${r.url}`
  );
  await ctx.reply(lines.join('\n\n'), { parse_mode: 'Markdown' });
});

// /invite [alias] [username] — токен-приглашение
bot.command('invite', async (ctx) => {
  const [alias, username] = ctx.message.text.split(/\s+/).slice(1);

  if (!alias || !username) {
    return ctx.reply('Использование: /invite [название комнаты] [имя пользователя]');
  }

  const room = storage.getRoomByAlias(alias, ctx.from.id);
  if (!room) {
    return ctx.reply(`Комната *${alias}* не найдена. Используйте /rooms для просмотра списка.`, {
      parse_mode: 'Markdown',
    });
  }

  try {
    const inviteUrl = await galene.createInviteToken(room.name, username);
    await ctx.reply(
      `Ссылка-приглашение для *${alias}* (пользователь: ${username}, действует 24 ч):\n\n🔗 ${inviteUrl}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('createInviteToken error:', err.message);
    await ctx.reply('Не удалось создать токен-приглашение.');
  }
});

// Крон: удалять комнаты старше 12 часов каждый час
cron.schedule('0 * * * *', async () => {
  const expired = storage.getExpiredRooms(ROOM_MAX_AGE_MS);
  if (expired.length === 0) return;

  console.log(`[cron] Удаление ${expired.length} устаревших комнат...`);
  await Promise.all(
    expired.map(async (room) => {
      try {
        await galene.deleteRoom(room.name);
        storage.removeRoom(room.name);
        console.log(`[cron] Удалена комната: ${room.alias} (${room.name})`);
      } catch (err) {
        console.error(`[cron] Ошибка удаления ${room.alias}:`, err.message);
      }
    })
  );
});

console.log('Бот запускается...');
bot.launch();
bot.telegram.getMe().then((me) => console.log(`Бот запущен: @${me.username}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
