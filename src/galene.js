const axios = require('axios');

// Read config once at module load (dotenv is applied before this module is required)
const BASE_URL = process.env.GALENE_URL;
const BASE_GROUP = process.env.GALENE_BASE_GROUP || 'public';
const AUTH = {
  username: process.env.GALENE_ADMIN,
  password: process.env.GALENE_PASSWORD,
};

function groupPath(roomName) {
  return `${BASE_GROUP}/${roomName}`;
}

function apiUrl(path) {
  return `${BASE_URL}/api/group/${path}`;
}

async function createRoom(roomName) {
  const gp = groupPath(roomName);
  await axios.put(
    apiUrl(`${gp}/`),
    { displayName: roomName, public: true, 'allow-recording': false },
    { auth: AUTH }
  );
  return `${BASE_URL}/group/${gp}/`;
}

async function deleteRoom(roomName) {
  await axios.delete(apiUrl(`${groupPath(roomName)}/`), { auth: AUTH });
}

async function createInviteToken(roomName, expiresInMs = 24 * 60 * 60 * 1000) {
  const gp = groupPath(roomName);
  const expires = new Date(Date.now() + expiresInMs).toISOString();

  const { data } = await axios.post(
    apiUrl(`${gp}/tokens/`),
    { expires, permissions: { present: [''] } },
    { auth: AUTH }
  );

  if (!data.token) throw new Error(`Unexpected token response: ${JSON.stringify(data)}`);
  return `${BASE_URL}/group/${gp}/?token=${data.token}`;
}

module.exports = { createRoom, deleteRoom, createInviteToken };
