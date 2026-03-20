const axios = require('axios');

const BASE_URL = process.env.GALENE_URL;
const BASE_GROUP = process.env.GALENE_BASE_GROUP || 'public';
const AUTH = {
  username: process.env.GALENE_ADMIN,
  password: process.env.GALENE_PASSWORD,
};

function groupApiUrl(roomName) {
  return `${BASE_URL}/galene-api/v0/.groups/${BASE_GROUP}/${roomName}/`;
}

async function createRoom(roomName, displayName) {
  await axios.put(
    groupApiUrl(roomName),
    { displayName, public: true, 'allow-recording': false, presenter: [{}] },
    { auth: AUTH }
  );
  return `${BASE_URL}/group/${BASE_GROUP}/${roomName}/`;
}

async function deleteRoom(roomName) {
  await axios.delete(groupApiUrl(roomName), { auth: AUTH });
}

// username embedded in token so the join form is pre-filled — user only needs to click Join
async function createInviteToken(roomName, username, expiresInMs = 24 * 60 * 60 * 1000) {
  const expires = new Date(Date.now() + expiresInMs).toISOString();
  const res = await axios.post(
    `${groupApiUrl(roomName)}.tokens/`,
    { expires, username },
    { auth: AUTH }
  );

  const token = res.headers['location'];
  if (!token) throw new Error('No token in Location header');
  return `${BASE_URL}/group/${BASE_GROUP}/${roomName}/?token=${token}`;
}

module.exports = { createRoom, deleteRoom, createInviteToken };
