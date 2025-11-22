const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
});