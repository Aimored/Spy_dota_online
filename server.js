const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app); // ← вот где создаётся server!
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Отдаём статику
app.use(express.static(path.join(__dirname, 'public')));

// Пример простого маршрута (опционально)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Логика игры
const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { players: [] };
    rooms[roomId].players.push({ id: socket.id, name: playerName });
    io.to(roomId).emit('updatePlayers', rooms[roomId].players);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const heroes = ["Anti-Mage", "Pudge", "Invoker", "Doom", "Lina", "Sniper"];
    const hero = heroes[Math.floor(Math.random() * heroes.length)];
    const spyIndex = Math.floor(Math.random() * room.players.length);

    room.players.forEach((player, i) => {
      const role = i === spyIndex ? "ШПИОН" : hero;
      io.to(player.id).emit('yourRole', { role });
    });
    io.to(roomId).emit('gameStarted');
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});