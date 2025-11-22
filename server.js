const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const heroes = [
  "Anti-Mage", "Axe", "Bane", "Bloodseeker", "Crystal Maiden", "Drow Ranger",
  "Earthshaker", "Juggernaut", "Mirana", "Morphling", "Shadow Fiend", "Phantom Lancer",
  "Puck", "Pudge", "Razor", "Sand King", "Storm Spirit", "Sven", "Tiny", "Vengeful Spirit",
  "Windranger", "Zeus", "Kunkka", "Lina", "Lion", "Necrophos", "Ogre Magi", "Riki", "Sniper",
  "Templar Assassin", "Viper", "Luna", "Dragon Knight", "Dazzle", "Clockwerk", "Leshrac",
  "Nature's Prophet", "Lifestealer", "Dark Seer", "Clinkz", "Omniknight", "Enchantress",
  "Huskar", "Night Stalker", "Broodmother", "Bounty Hunter", "Weaver", "Jakiro", "Batrider",
  "Chen", "Spectre", "Ancient Apparition", "Doom", "Ursa", "Spirit Breaker", "Gyrocopter",
  "Alchemist", "Invoker", "Silencer", "Outworld Destroyer", "Lycan", "Brewmaster",
  "Shadow Shaman", "Lone Druid", "Chaos Knight", "Meepo", "Treant Protector", "Undying",
  "Rubick", "Disruptor", "Nyx Assassin", "Naga Siren", "Keeper of the Light", "Io",
  "Visage", "Slark", "Medusa", "Troll Warlord", "Tusk", "Bristleback", "Skywrath Mage",
  "Abaddon", "Elder Titan", "Legion Commander", "Techies", "Ember Spirit", "Earth Spirit",
  "Abyssal Underlord", "Terrorblade", "Phoenix", "Oracle", "Winter Wyvern", "Arc Warden",
  "Monkey King", "Dark Willow", "Pangolier", "Grimstroke", "Hoodwink", "Void Spirit",
  "Snapfire", "Mars", "Dawnbreaker", "Marci", "Primal Beast", "Muerta"
];

const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    if (!roomId || !playerName) return;

    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        started: false,
        votes: {} // голоса: { playerId: voterId[] }
      };
    }
    const player = { id: socket.id, name: playerName };
    rooms[roomId].players.push(player);
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.started || room.players.length < 2) return;

    room.started = true;
    room.votes = {}; // сброс голосов
    const hero = heroes[Math.floor(Math.random() * heroes.length)];
    const spyIndex = Math.floor(Math.random() * room.players.length);

    room.players.forEach((player, i) => {
      const role = i === spyIndex ? "ШПИОН" : hero;
      io.to(player.id).emit('yourRole', { role });
    });

    io.to(roomId).emit('gameStarted');
  });

  socket.on('vote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;

    // Инициализация голосов за цель
    if (!room.votes[targetId]) room.votes[targetId] = [];
    const voterId = socket.id;

    // Удаляем старый голос игрока (если был)
    for (const tId in room.votes) {
      room.votes[tId] = room.votes[tId].filter(id => id !== voterId);
    }

    // Добавляем новый голос
    room.votes[targetId].push(voterId);

    // Отправляем обновлённые итоги ВСЕМ
    const voteSummary = {};
    for (const tId in room.votes) {
      voteSummary[tId] = room.votes[tId].length;
    }
    io.to(roomId).emit('updateVotes', voteSummary);
  });

  socket.on('disconnect', () => {
    // Можно реализовать удаление игрока, но для простоты — пропускаем
  });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});