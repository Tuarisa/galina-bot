require('dotenv').config();

const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const { randomBytes } = require('crypto');

const galene = require('./galene');
const storage = require('./storage');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function generateRoomName() {
  return 'room-' + randomBytes(3).toString('hex');
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// /start
bot.start((ctx) =>
  ctx.reply(
    'Привет! Я управляю видеокомнатами Galene.\n\n' +
      '/room — создать новую комнату\n' +
      '/rooms — список активных комнат\n' +
      '/invite [название] — ссылка-приглашение для комнаты'
  )
);

// /room — создать комнату
bot.command('room', async (ctx) => {
  const roomName = generateRoomName();
  try {
    const url = await galene.createRoom(roomName);
    storage.addRoom(roomName, url);
    await ctx.reply(
      `Комната создана: *${roomName}*\n\n🔗 ${url}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('createRoom error:', err.message);
    await ctx.reply('Не удалось создать комнату. Проверьте настройки Galene.');
  }
});

// /rooms — список активных комнат
bot.command('rooms', async (ctx) => {
  const rooms = storage.getAllRooms();
  if (rooms.length === 0) {
    return ctx.reply('Нет активных комнат.');
  }
  const lines = rooms.map(
    (r) => `• *${r.name}* — создана ${formatDate(r.createdAt)}\n  ${r.url}`
  );
  await ctx.reply(lines.join('\n\n'), { parse_mode: 'Markdown' });
});

// /invite [название] — токен-приглашение
bot.command('invite', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const roomName = args[0];

  if (!roomName) {
    return ctx.reply('Использование: /invite [название комнаты]');
  }

  const room = storage.getRoom(roomName);
  if (!room) {
    return ctx.reply(`Комната *${roomName}* не найдена. Используйте /rooms для просмотра списка.`, {
      parse_mode: 'Markdown',
    });
  }

  try {
    const inviteUrl = await galene.createInviteToken(roomName);
    await ctx.reply(
      `Ссылка-приглашение для *${roomName}* (действует 24 ч):\n\n🔗 ${inviteUrl}`,
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
        console.log(`[cron] Удалена комната: ${room.name}`);
      } catch (err) {
        console.error(`[cron] Ошибка удаления ${room.name}:`, err.message);
      }
    })
  );
});

bot.launch().then(() => console.log('Бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
