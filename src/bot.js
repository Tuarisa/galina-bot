require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const { randomUUID } = require('crypto');

const galene = require('./galene');
const storage = require('./storage');
const { generateAlias, generateUsername } = require('./words');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

let botUsername = '';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

function formatDate(isoString) {
  return dateFormatter.format(new Date(isoString));
}

function isGroupChat(ctx) {
  return ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
}

// /start
bot.start((ctx) => {
  if (isGroupChat(ctx)) {
    return ctx.reply(
      'Привет! Управляю видеокомнатами Galene для этого чата.\n\n' +
        '/room [название] — создать комнату для чата (лимит: 2)\n' +
        '/rooms — активные комнаты этого чата\n' +
        '/invite [название] [имя] — ссылка-приглашение'
    );
  }
  return ctx.reply(
    'Привет! Я управляю видеокомнатами Galene.\n\n' +
      '/room [название] — создать новую комнату\n' +
      '/rooms — список твоих активных комнат\n' +
      '/invite [название] [имя] — ссылка-приглашение для комнаты'
  );
});

// /room [alias] — создать комнату
bot.command('room', async (ctx) => {
  const alias = ctx.message.text.split(/\s+/).slice(1).join(' ').trim() || generateAlias();

  if (isGroupChat(ctx)) {
    const chatId = ctx.chat.id;
    const oldest = storage.getOldestChatRoom(chatId);
    if (oldest) {
      try {
        await galene.deleteRoom(oldest.name);
        storage.removeRoom(oldest.name);
      } catch (err) {
        console.error('evict group room error:', err.message);
      }
    }
    const roomName = randomUUID();
    try {
      const url = await galene.createRoom(roomName, alias);
      storage.addRoom(roomName, url, ctx.from.id, alias, chatId);
      await ctx.reply(
        `Комната создана: *${alias}*\n\n🔗 ${url}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('🔗 Получить приглашение', `invite:${roomName}`),
          ]),
        }
      );
    } catch (err) {
      console.error('createRoom error (group):', err.message);
      await ctx.reply('Не удалось создать комнату. Проверьте настройки Galene.');
    }
    return;
  }

  // Личный чат
  const userId = ctx.from.id;
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
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('🔗 Пригласить', `invite:${roomName}`),
        ]),
      }
    );
  } catch (err) {
    console.error('createRoom error:', err.message);
    await ctx.reply('Не удалось создать комнату. Проверьте настройки Galene.');
  }
});

// Кнопка "Пригласить" / "Получить приглашение"
bot.action(/^invite:(.+)$/, async (ctx) => {
  const roomName = ctx.match[1];
  const room = storage.getRoomByName(roomName);

  if (!room) {
    return ctx.answerCbQuery('Комната не найдена или уже удалена', { show_alert: true });
  }

  // Отвечаем немедленно, чтобы не превысить 10-секундный таймаут Telegram
  await ctx.answerCbQuery(room.chatId ? 'Генерирую ссылку...' : '');

  const username = generateUsername();
  try {
    const inviteUrl = await galene.createInviteToken(roomName, username);
    const message = `🔗 Приглашение для *${room.alias}*\nИмя: \`${username}\`\n\n${inviteUrl}`;

    if (room.chatId) {
      // Групповая комната — отправляем ссылку в личку нажавшему
      try {
        await ctx.telegram.sendMessage(ctx.from.id, message, { parse_mode: 'Markdown' });
      } catch (err) {
        if (err.code === 403) {
          await ctx.reply(
            `@${ctx.from.username ? '@' + ctx.from.username : ctx.from.first_name}, напишите боту в личку: @${botUsername}`
          );
        } else {
          throw err;
        }
      }
    } else {
      // Личная комната — отвечаем в чат
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('invite button error:', err.message);
    await ctx.reply('Не удалось создать ссылку-приглашение.');
  }
});

// /rooms — список комнат
bot.command('rooms', async (ctx) => {
  const rooms = isGroupChat(ctx)
    ? storage.getRoomsByChat(ctx.chat.id)
    : storage.getRoomsByUser(ctx.from.id);

  if (rooms.length === 0) {
    return ctx.reply(isGroupChat(ctx) ? 'У этого чата нет активных комнат.' : 'У тебя нет активных комнат.');
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

  const room = isGroupChat(ctx)
    ? storage.getRoomByAliasInChat(alias, ctx.chat.id)
    : storage.getRoomByAlias(alias, ctx.from.id);

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
bot.telegram.getMe().then((me) => {
  botUsername = me.username;
  console.log(`Бот запущен: @${me.username}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
