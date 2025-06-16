require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const { initConnection } = require('./src/database/connection');
const authRoutes = require('./src/routes/auth.routes');
const homeRoutes = require('./src/routes/home.routes');
const imagesRoutes = require('./src/routes/images.routes');
const tagRoutes = require('./src/routes/tags.routes');
const searchRoutes = require('./src/routes/search.routes');
const usersRoutes = require('./src/routes/users.routes');
const { initSocketIO } = require('./src/socket/socket');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: 'http://localhost:4321',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// 🧠 Configuración general
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'src', 'views')); 
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));



// 🧠 Middleware
app.use(
  cors({
    origin: 'http://localhost:4321',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    exposedHeaders: ['set-cookie'],
  })
);
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); 


// 📦 Rutas
app.use(authRoutes);
app.use(homeRoutes);
app.use('/images', imagesRoutes); 
app.use('/tags', tagRoutes);
app.use('/users', searchRoutes); 
app.use('/users', usersRoutes);  


// 🔌 WebSockets
initSocketIO(io);

// server and connection db
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initConnection()
    .then(() => console.log('Database connected'))
    .catch((err) => console.error('Database error:', err));
});
