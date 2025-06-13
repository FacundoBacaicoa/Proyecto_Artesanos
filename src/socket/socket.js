let ioInstance = null;

function initSocketIO(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('disconnect', () => {
      io.emit('broadcast', { mensaje: 'Un usuario se ha desconectado' });
    });
  });
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
};
