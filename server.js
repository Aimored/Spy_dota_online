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
        spyIds: new Set(), // ← множество ID шпионов
        spyErrors: {} // отдельно для каждого шпиона
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

    const totalPlayers = room.players.length;

    // ✅ Определяем количество шпионов
    let numSpies = 1; // по умолчанию
    if (Math.random() < 0.2 && totalPlayers > 2) { // 20% шанс, только если >2 игроков
      numSpies = Math.floor(Math.random() * (totalPlayers - 1)) + 1; // от 1 до N-1
    }

    // Выбираем героев
    const attributes = Object.keys(heroesByAttribute);
    const randomAttr = attributes[Math.floor(Math.random() * attributes.length)];
    const heroList = heroesByAttribute[randomAttr];
    const trueHero = heroList[Math.floor(Math.random() * heroList.length)];

    // Выбираем шпионов случайно
    const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
    const spyIds = new Set();
    for (let i = 0; i < numSpies; i++) {
      spyIds.add(shuffledPlayers[i].id);
    }

    // Сброс состояния
    room.started = true;
    room.votes = {};
    room.trueHero = trueHero;
    room.heroAttribute = randomAttr;
    room.spyIds = spyIds;
    room.spyErrors = {};

    // Рассылка ролей
    room.players.forEach(player => {
      if (spyIds.has(player.id)) {
        io.to(player.id).emit('chooseSpyHero', { heroesByAttribute });
        room.spyErrors[player.id] = 0;
      } else {
        io.to(player.id).emit('yourRole', {
          role: trueHero,
          attribute: randomAttr
        });
      }
    });

    console.log(`🎮 Комната ${roomId}: ${numSpies} шпион(ов) из ${totalPlayers} игроков`);
  });

  socket.on('spyGuess', ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room || !room.spyIds.has(socket.id)) return;

    if (guess === room.trueHero) {
      const spy = room.players.find(p => p.id === socket.id);
      io.to(roomId).emit('gameEnd', {
        winner: 'spy',
        message: `Шпион «${spy.name}» угадал героя! Настоящий герой: ${room.trueHero}. Шпионов было: ${room.spyIds.size}.`,
        trueHero: room.trueHero
      });
    } else {
      room.spyErrors[socket.id] = (room.spyErrors[socket.id] || 0) + 1;
      if (room.spyErrors[socket.id] >= 5) {
        // Проверяем: остались ли ещё нераскрытые шпионы?
        const activeSpies = room.players.filter(p => room.spyIds.has(p.id) && room.spyErrors[p.id] < 5);
        if (activeSpies.length === 0) {
          // Все шпионы совершили 5 ошибок
          const spyNames = Array.from(room.spyIds).map(id => {
            const p = room.players.find(pp => pp.id === id);
            return p ? p.name : '???';
          }).join(', ');
          io.to(roomId).emit('gameEnd', {
            winner: 'players',
            message: `Все шпионы раскрыты после ошибок! Шпионы: ${spyNames}. Настоящий герой: ${room.trueHero}.`,
            trueHero: room.trueHero
          });
        } else {
          // Только личное уведомление об ошибке
          io.to(socket.id).emit('heroIncorrect', { guess });
        }
      } else {
        io.to(socket.id).emit('heroIncorrect', { guess });
      }
    }
  });

  socket.on('vote', ({ roomId, targetId }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;

    const voterId = socket.id;
    if (!room.spyIds.has(voterId)) {
      // Только не-шпионы могут голосовать (по классике)
    }

    if (!room.votes[targetId]) room.votes[targetId] = [];
    
    // Удаляем предыдущий голос игрока
    for (const tId in room.votes) {
      room.votes[tId] = room.votes[tId].filter(id => id !== voterId);
    }
    room.votes[targetId].push(voterId);

    const nonSpyCount = room.players.filter(p => !room.spyIds.has(p.id)).length;
    const voteSummary = {};
    for (const tId in room.votes) {
      voteSummary[tId] = room.votes[tId].length;
    }
    io.to(roomId).emit('updateVotes', voteSummary);

    // Проверка: все не-шпионы проголосовали против одного игрока?
    let accusedId = null;
    for (const tId in room.votes) {
      if (room.votes[tId].length === nonSpyCount && nonSpyCount > 0) {
        accusedId = tId;
        break;
      }
    }

    if (accusedId) {
      const accused = room.players.find(p => p.id === accusedId);
      const spyNames = Array.from(room.spyIds).map(id => {
        const p = room.players.find(pp => pp.id === id);
        return p ? p.name : '???';
      }).join(', ');

      let message = '';
      if (room.spyIds.has(accusedId)) {
        message = `✅ Игроки выгнали шпиона! Выгнан ${accused.name}. Шпионы: ${spyNames}. Настоящий герой: ${room.trueHero}.`;
        io.to(roomId).emit('gameEnd', {
          winner: 'players',
          message: message,
          trueHero: room.trueHero
        });
      } else {
        message = `❌ Игроки выгнали невиновного! Выгнан ${accused.name}. Шпионы: ${spyNames}. Настоящий герой: ${room.trueHero}.`;
        io.to(roomId).emit('gameEnd', {
          winner: 'spy',
          message: message,
          trueHero: room.trueHero
        });
      }
    }
  });

  socket.on('restartGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.started = false;
    room.votes = {};
    room.trueHero = null;
    room.heroAttribute = null;
    room.spyIds = new Set();
    room.spyErrors = {};
    io.to(roomId).emit('gameRestarted');
  });

  socket.on('disconnect', () => {
    // Опционально: можно удалять игрока из комнаты
  });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});