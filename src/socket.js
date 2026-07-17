const { Server } = require('socket.io');
const db = require('./db');

function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('missing_token'));

    const device = db.prepare('SELECT group_id, user_id FROM devices WHERE token = ?').get(token);
    if (!device) return next(new Error('invalid_token'));

    socket.groupId = device.group_id;
    socket.userId = device.user_id;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`group:${socket.groupId}`);
    if (socket.userId) {
      socket.join(`group:${socket.groupId}:user:${socket.userId}`);
    }
  });

  return io;
}

module.exports = createSocketServer;
