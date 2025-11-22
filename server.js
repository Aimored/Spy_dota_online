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
        votes: {},
        trueHero: null,
        spyId: null
      };
    }
    const player = { id: socket.id, name: playerName };
    rooms[roomId].players.push(player);
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.started || room.players.length < 2) return;

    const trueHero = heroes[Math.floor(Math.random() * heroes.length)];
    const spyIndex = Math.floor(Math.random() * room.players.length);
    const spyId = room.players[spyIndex].id;

    room.started = true;
    room.votes = {};
    room.trueHero = trueHero;
    room.spyId = spyId;

    room.players.forEach((player, i) => {
      if (i === spyIndex) {
        io.to(player.id).emit('chooseSpyHero', { heroes, trueHero });
      } else {
        io.to(player.id).emit('yourRole', { role: trueHero });
      }
    });
    io.to(roomId).emit('gameStarted');
  });

  socket.on('spyGuess', ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.spyId) return;

    if (guess === room.trueHero) {
      const spy = room.players.find(p => p.id === room.spyId);
      io.to(roomId).emit('gameEnd', {
        winner: 'spy',
        message: `Шпион угадал героя и победил! Это был ${spy.name}!`,
        spyName: spy.name
      });
    } else {
      // Отправляем только шпиону, что герой неправильный
      io.to(socket.id).emit('heroIncorrect', { guess });
    }
  });

  socket.on('vote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;

    if (!room.votes[targetId]) room.votes[targetId] = [];
    const voterId = socket.id;

    // Удаляем предыдущий голос игрока
    for (const tId in room.votes) {
      room.votes[tId] = room.votes[tId].filter(id => id !== voterId);
    }
    room.votes[targetId].push(voterId);

    // Проверка: все, кроме одного (шпиона), проголосовали за одного
    const totalPlayers = room.players.length;
    const nonSpyCount = totalPlayers - 1;
    let accusedId = null;
    for (const tId in room.votes) {
      if (room.votes[tId].length === nonSpyCount) {
        // Убедимся, что шпион не голосовал за этого игрока
        if (!room.votes[tId].includes(room.spyId)) {
          accusedId = tId;
          break;
        }
      }
    }

    const voteSummary = {};
    for (const tId in room.votes) {
      voteSummary[tId] = room.votes[tId].length;
    }
    io.to(roomId).emit('updateVotes', voteSummary);

    if (accusedId) {
      const accused = room.players.find(p => p.id === accusedId);
      const spy = room.players.find(p => p.id === room.spyId);
      if (accusedId === room.spyId) {
        io.to(roomId).emit('gameEnd', {
          winner: 'players',
          message: `Шпион раскрыт! Это был ${spy.name}!`,
          spyName: spy.name
        });
      }
    }
  });

  socket.on('disconnect', () => {});
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});