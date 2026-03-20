const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'rooms.json');
const MAX_ROOMS_PER_USER = 3;
const MAX_ROOMS_PER_CHAT = 2;

// In-memory cache — loaded once on first access, written through on every mutation
let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

// name = UUID (internal Galene room id), alias = user-facing label
// chatId is set for group rooms, null/absent for personal rooms
function addRoom(name, url, userId, alias, chatId = null) {
  load()[name] = { name, url, userId, alias, chatId, createdAt: new Date().toISOString() };
  save();
}

function getRoomByName(name) {
  return load()[name] || null;
}

function getRoomsByUser(userId) {
  return Object.values(load()).filter(r => !r.chatId && r.userId === userId);
}

function getRoomByAlias(alias, userId) {
  return Object.values(load()).find(r => !r.chatId && r.alias === alias && r.userId === userId) || null;
}

// Returns the oldest personal room to evict if user is at the limit, otherwise null
function getOldestUserRoom(userId) {
  const rooms = getRoomsByUser(userId);
  if (rooms.length < MAX_ROOMS_PER_USER) return null;
  return rooms.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
}

function getRoomsByChat(chatId) {
  return Object.values(load()).filter(r => r.chatId === chatId);
}

function getRoomByAliasInChat(alias, chatId) {
  return Object.values(load()).find(r => r.chatId === chatId && r.alias === alias) || null;
}

// Returns the oldest group room to evict if chat is at the limit, otherwise null
function getOldestChatRoom(chatId) {
  const rooms = getRoomsByChat(chatId);
  if (rooms.length < MAX_ROOMS_PER_CHAT) return null;
  return rooms.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
}

function removeRoom(name) {
  delete load()[name];
  save();
}

function getExpiredRooms(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  return Object.values(load()).filter(r => Date.parse(r.createdAt) < cutoff);
}

module.exports = {
  addRoom,
  getRoomByName, getRoomsByUser, getRoomByAlias, getOldestUserRoom,
  getRoomsByChat, getRoomByAliasInChat, getOldestChatRoom,
  removeRoom, getExpiredRooms,
  MAX_ROOMS_PER_USER, MAX_ROOMS_PER_CHAT,
};
