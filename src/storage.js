const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'rooms.json');

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

function addRoom(name, url) {
  load()[name] = { name, url, createdAt: new Date().toISOString() };
  save();
}

function getRoom(name) {
  return load()[name] || null;
}

function getAllRooms() {
  return Object.values(load());
}

function removeRoom(name) {
  delete load()[name];
  save();
}

function getExpiredRooms(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  return getAllRooms().filter(r => new Date(r.createdAt).getTime() < cutoff);
}

module.exports = { addRoom, getRoom, getAllRooms, removeRoom, getExpiredRooms };
