require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const initSocket = require('./socket');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Cors configuration for development
app.use(cors());

// We do NOT use any logging middleware like morgan.
// We also remove Express headers for minimal footprint.
app.disable('x-powered-by');

const io = new Server(server, {
    cors: {
        origin: '*', // Allow Expo client by default
        methods: ['GET', 'POST']
    }
});

initSocket(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Ghostline server running silently on port ${PORT}`);
});
