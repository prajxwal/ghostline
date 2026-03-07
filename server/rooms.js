// In-memory strictly. No database.
const rooms = new Map();

// 24 hr expiration for inactive rooms
const ROOM_TIMEOUT = 24 * 60 * 60 * 1000;

function createRoom(roomId, hasPassword = false) {
    if (rooms.has(roomId)) {
        return false; // Already exists
    }
    rooms.set(roomId, {
        users: new Set(),
        createdAt: Date.now(),
        lastActive: Date.now(),
        hasPassword
    });
    return true;
}

function joinRoom(roomId, userId) {
    const room = rooms.get(roomId);
    if (!room) return false;

    room.users.add(userId);
    room.lastActive = Date.now();
    return true;
}

function leaveRoom(roomId, userId) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.users.delete(userId);
    room.lastActive = Date.now();

    // If empty, destroy immediately for privacy
    if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} destroyed (empty)`);
    }
}

function getRoomUserCount(roomId) {
    const room = rooms.get(roomId);
    return room ? room.users.size : 0;
}

function roomExists(roomId) {
    return rooms.has(roomId);
}

// Cleanup stale rooms periodically
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.lastActive > ROOM_TIMEOUT) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} destroyed (timeout)`);
        }
    }
}, 60 * 60 * 1000); // Check every hour

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    getRoomUserCount,
    roomExists
};
