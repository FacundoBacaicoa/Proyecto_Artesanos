let ioInstance = null;

function initSocketIO(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Unirse a una sala privada basada en el ID de usuario
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} se unió a la sala user_${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.id);
    });
  });
}

function emitToUser(userId, evento, data) {
  if (!ioInstance) return;
  ioInstance.to(`user_${userId}`).emit(evento, data);
}

function emitEvent(evento, data) {
  if (!ioInstance) {
    console.error('Socket.IO no inicializado, no se puede emitir evento:', evento);
    return;
  }
  ioInstance.emit(evento, data);
}

module.exports = {
  initSocketIO,
  emitEvent,
  emitToUser,
};
