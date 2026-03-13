const { createRoom, joinRoom, leaveRoom, getRoomUserCount, roomExists, nukeRoom } = require('./rooms');
const { v4: uuidv4 } = require('uuid');

module.exports = (io) => {
    io.on('connection', (socket) => {
        // Assign persistent ID from client or create ephemeral fallback
        const userId = socket.handshake.auth?.sessionId || uuidv4();
        socket.data.userId = userId;

        // Rate limit state
        socket.data.lastMessageTime = 0;
        socket.data.messageCount = 0;

        console.log(`Client connected: user ID assigned.`);

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
        socket.on('chat-message', (payload, callback) => {
            const now = Date.now();
            if (now - socket.data.lastMessageTime > 1000) {
                socket.data.messageCount = 0;
                socket.data.lastMessageTime = now;
            }
            socket.data.messageCount++;

            if (socket.data.messageCount > 5) {
                console.log(`[SYS_WARN] Rate limit exceeded by ${userId}. Terminating connection.`);
                socket.disconnect(true);
                return;
            }

            const roomId = socket.data.roomId;
            if (roomId) {
                // Broadcast to everyone else in the room
                socket.to(roomId).emit('chat-message', payload);
                // Acknowledge sent to sender
                if (typeof callback === 'function') callback({ status: 'sent' });
            }
        });

        // Delivery receipt: recipient confirms they got the message
        socket.on('msg-delivered', ({ msgId, to }) => {
            const roomId = socket.data.roomId;
            if (roomId) {
                // Relay delivery confirmation to everyone else (sender will pick it up)
                socket.to(roomId).emit('msg-delivered', { msgId });
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
