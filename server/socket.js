const { createRoom, joinRoom, leaveRoom, getRoomUserCount, roomExists, nukeRoom } = require('./rooms');
const { v4: uuidv4 } = require('uuid');

module.exports = (io) => {
    io.on('connection', (socket) => {
        // Assign random ID that is ephemeral to this connection only.
        // We never tie this to IP or store it persistently.
        const userId = uuidv4();
        socket.data.userId = userId;

        console.log(`Client connected: ephemeral ID assigned.`);

        socket.on('create-room', ({ roomId, hasPassword }, callback) => {
            if (!roomId) return callback({ error: 'Room ID required' });
            const success = createRoom(roomId, userId, hasPassword);
            if (success) {
                callback({ success: true });
            } else {
                callback({ error: 'Room already exists' });
            }
        });

        socket.on('join-room', ({ roomId }, callback) => {
            if (!roomExists(roomId)) {
                return callback({ error: 'Room not found' });
            }

            socket.join(roomId);
            joinRoom(roomId, userId);
            socket.data.roomId = roomId;

            // Notify others
            socket.to(roomId).emit('user-joined');

            callback({
                success: true,
                userCount: getRoomUserCount(roomId)
            });
        });

        // We blindly relay the encrypted payload.
        // The server cannot read 'payload'.
        socket.on('chat-message', (payload) => {
            const roomId = socket.data.roomId;
            if (roomId) {
                // Broadcast to everyone else in the room
                socket.to(roomId).emit('chat-message', payload);
            }
        });

        socket.on('typing', ({ isTyping }) => {
            const roomId = socket.data.roomId;
            if (roomId) {
                socket.to(roomId).emit('typing', { isTyping });
            }
        });

        socket.on('nuke-room', (callback) => {
            const roomId = socket.data.roomId;
            if (roomId) {
                const success = nukeRoom(roomId, userId);
                if (success) {
                    io.in(roomId).emit('room-nuked');
                    if (typeof callback === 'function') callback({ success: true });
                } else {
                    if (typeof callback === 'function') callback({ error: 'Not authorized or room not found' });
                }
            } else {
                if (typeof callback === 'function') callback({ error: 'Not in a room' });
            }
        });

        socket.on('disconnect', () => {
            const roomId = socket.data.roomId;
            if (roomId) {
                leaveRoom(roomId, userId);
                socket.to(roomId).emit('user-left');
            }
            console.log('Client disconnected.');
        });
    });
};
