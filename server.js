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

const allHeroes = [
  "Abaddon", "Alchemist", "Ancient Apparition", "Anti-Mage", "Arc Warden", "Axe",
  "Bane", "Batrider", "Beastmaster", "Bloodseeker", "Bounty Hunter", "Brewmaster",
  "Bristleback", "Broodmother", "Centaur Warrunner", "Chaos Knight", "Chen", "Clinkz",
  "Clockwerk", "Crystal Maiden", "Dark Seer", "Dark Willow", "Dawnbreaker", "Dazzle",
  "Disruptor", "Doom", "Dragon Knight", "Drow Ranger", "Earth Spirit", "Earthshaker",
  "Elder Titan", "Ember Spirit", "Enchantress", "Faceless Void", "Grimstroke", "Gyrocopter",
  "Hoodwink", "Huskar", "Invoker", "Io", "Jakiro", "Juggernaut", "Keeper of the Light",
  "Kunkka", "Legion Commander", "Leshrac", "Lich", "Lifestealer", "Lina", "Lion", "Lone Druid",
  "Luna", "Lycan", "Magnus", "Marci", "Mars", "Medusa", "Meepo", "Mirana", "Monkey King",
  "Morphling", "Muerta", "Naga Siren", "Nature's Prophet", "Necrophos", "Night Stalker",
  "Nyx Assassin", "Ogre Magi", "Omniknight", "Oracle", "Outworld Destroyer", "Pangolier",
  "Phantom Assassin", "Phantom Lancer", "Phoenix", "Primal Beast", "Puck", "Pudge",
  "Queen of Pain", "Razor", "Riki", "Rubick", "Sand King", "Shadow Demon", "Shadow Fiend",
  "Shadow Shaman", "Silencer", "Skywrath Mage", "Slardar", "Slark", "Snapfire", "Sniper",
  "Spectre", "Spirit Breaker", "Storm Spirit", "Sven", "Techies", "Templar Assassin",
  "Terrorblade", "Tidehunter", "Timbersaw", "Tinker", "Tiny", "Treant Protector",
  "Troll Warlord", "Tusk", "Underlord", "Undying", "Ursa", "Vengeful Spirit", "Venomancer",
  "Viper", "Visage", "Void Spirit", "Warlock", "Weaver", "Windranger", "Winter Wyvern",
  "Witch Doctor", "Wraith King", "Zeus"
];

const heroesByAttribute = {
  strength: [
    "Ogre Magi", "Alchemist", "Axe", "Bristleback", "Centaur Warrunner", "Chaos Knight",
    "Dawnbreaker", "Doom", "Dragon Knight", "Earth Spirit", "Earthshaker", "Elder Titan",
    "Huskar", "Kunkka", "Legion Commander", "Lifestealer", "Mars", "Night Stalker",
    "Omniknight", "Primal Beast", "Pudge", "Slardar", "Spirit Breaker", "Sven",
    "Tidehunter", "Tiny", "Treant Protector", "Tusk", "Underlord", "Undying", "Wraith King"
  ],
  agility: [
    "Anti-Mage", "Bloodseeker", "Bounty Hunter", "Clinkz", "Drow Ranger",
    "Ember Spirit", "Faceless Void", "Gyrocopter", "Hoodwink", "Juggernaut", "Luna",
    "Medusa", "Meepo", "Monkey King", "Morphling", "Naga Siren", "Phantom Assassin",
    "Phantom Lancer", "Razor", "Riki", "Shadow Fiend", "Slark", "Sniper", "Templar Assassin",
    "Terrorblade", "Troll Warlord", "Ursa", "Viper", "Weaver"
  ],
  intelligence: [
    "Ancient Apparition", "Chen", "Crystal Maiden", "Disruptor", "Enchantress",
    "Grimstroke", "Invoker", "Jakiro", "Keeper of the Light", "Leshrac", "Lich", "Lina",
    "Lion", "Muerta", "Nature's Prophet", "Necrophos", "Oracle", "Outworld Destroyer", "Puck",
    "Queen of Pain", "Rubick", "Shadow Demon", "Shadow Shaman",
    "Silencer", "Skywrath Mage", "Storm Spirit", "Tinker", "Warlock", "Witch Doctor", "Zeus"
  ],
  universal: [
    "Abaddon", "Bane", "Batrider", "Beastmaster", "Brewmaster", "Broodmother",
    "Clockwerk", "Dark Seer", "Dark Willow", "Dazzle", "Io", "Lone Druid",
    "Lycan", "Magnus", "Marci", "Mirana", "Nyx Assassin", "Pangolier", "Phoenix", "Sand King",
    "Snapfire", "Techies", "Timbersaw", "Vengeful Spirit", "Venomancer", "Visage",
    "Void Spirit", "Windranger", "Winter Wyvern", "Arc Warden"
  ]
};

const rooms = {};
const roomOrder = [];

function cleanupRooms() {
  while (roomOrder.length > 2) {
    const oldestRoomId = roomOrder.shift();
    delete rooms[oldestRoomId];
    console.log(`🗑️ Комната ${oldestRoomId} удалена (лимит 2 комнат)`);
  }
}

io.on('connection', (socket) => {
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    if (!roomId || !playerName || typeof playerName !== 'string' || playerName.trim() === '') return;

    socket.emit('joined', { myId: socket.id });

    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        started: false,
        votes: {},
        trueHero: null,
        heroAttribute: null,
        spyId: null,
        spyErrors: 0
      };
      roomOrder.push(roomId);
      cleanupRooms();
    }

    const existing = rooms[roomId].players.find(p => p.id === socket.id);
    if (!existing) {
      rooms[roomId].players.push({ id: socket.id, name: playerName.trim() });
    }
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.started || room.players.length < 2) return;

    const attributes = Object.keys(heroesByAttribute);
    const randomAttr = attributes[Math.floor(Math.random() * attributes.length)];
    const heroList = heroesByAttribute[randomAttr];
    const trueHero = heroList[Math.floor(Math.random() * heroList.length)];

    const spyIndex = Math.floor(Math.random() * room.players.length);
    const spyId = room.players[spyIndex].id;

    room.started = true;
    room.votes = {};
    room.trueHero = trueHero;
    room.heroAttribute = randomAttr;
    room.spyId = spyId;
    room.spyErrors = 0;

    room.players.forEach((player, i) => {
      if (i === spyIndex) {
        io.to(player.id).emit('chooseSpyHero', { heroesByAttribute });
      } else {
        io.to(player.id).emit('yourRole', {
          role: trueHero,
          attribute: randomAttr
        });
      }
    });
  });

  socket.on('spyGuess', ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room || socket.id !== room.spyId) return;

    if (guess === room.trueHero) {
      const spy = room.players.find(p => p.id === room.spyId);
      io.to(roomId).emit('gameEnd', {
        winner: 'spy',
        message: `Шпион угадал героя и победил! Это был ${spy.name}. Настоящий герой: ${room.trueHero}.`,
        spyName: spy.name,
        trueHero: room.trueHero
      });
    } else {
      room.spyErrors = (room.spyErrors || 0) + 1;
      if (room.spyErrors >= 5) {
        const spy = room.players.find(p => p.id === room.spyId);
        io.to(roomId).emit('gameEnd', {
          winner: 'players',
          message: `Шпион раскрыт после 5 ошибок! Это был ${spy.name}. Настоящий герой: ${room.trueHero}.`,
          spyName: spy.name,
          trueHero: room.trueHero
        });
      } else {
        io.to(socket.id).emit('heroIncorrect', { guess });
      }
    }
  });

  socket.on('vote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;

    if (!room.votes[targetId]) room.votes[targetId] = [];
    const voterId = socket.id;

    for (const tId in room.votes) {
      room.votes[tId] = room.votes[tId].filter(id => id !== voterId);
    }
    room.votes[targetId].push(voterId);

    const voteSummary = {};
    for (const tId in room.votes) {
      voteSummary[tId] = room.votes[tId].length;
    }
    io.to(roomId).emit('updateVotes', voteSummary);

    const totalPlayers = room.players.length;
    let accusedId = null;
    for (const tId in room.votes) {
      if (room.votes[tId].length === totalPlayers - 1) {
        accusedId = tId;
        break;
      }
    }

    if (accusedId) {
      const accused = room.players.find(p => p.id === accusedId);
      const spy = room.players.find(p => p.id === room.spyId);
      let message = accusedId === room.spyId
        ? `✅ Игроки выгнали шпиона! Это был ${spy.name}. Настоящий герой: ${room.trueHero}.`
        : `❌ Игроки выгнали невиновного! Выгнан ${accused.name}. Шпион — ${spy.name}. Настоящий герой: ${room.trueHero}.`;

      io.to(roomId).emit('gameEnd', {
        winner: accusedId === room.spyId ? 'players' : 'spy',
        message: message,
        spyName: spy.name,
        trueHero: room.trueHero,
        accusedName: accused.name
      });
    }
  });

  socket.on('restartGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.started = false;
    room.votes = {};
    room.trueHero = null;
    room.heroAttribute = null;
    room.spyId = null;
    room.spyErrors = 0;
    io.to(roomId).emit('gameRestarted');
  });

  socket.on('disconnect', () => {
    // При желании можно очищать комнаты с 0 игроков, но не обязательно
  });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});