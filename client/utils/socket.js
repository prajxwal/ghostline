import { io } from 'socket.io-client';
import { Platform } from 'react-native';

// For local testing on simulator, Android uses 10.0.2.2 usually. 
// Standard Expo uses your machine IP or localhost depending on how it's run.
// Ensure you configure this IP to point to your backend correctly during dev!
const SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

class SocketService {
    socket = null;
    isConnected = false;
    _statusCallback = null;

    onStatusChange(callback) {
        this._statusCallback = callback;
    }

    connect(sessionId) {
        if (!this.socket) {
            this.socket = io(SERVER_URL, {
                transports: ['websocket'],
                reconnection: true,
                auth: { sessionId }
            });

            this.socket.on('connect', () => {
                console.log('Connected to Ghostline server');
                this.isConnected = true;
                this._statusCallback?.(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.isConnected = false;
                this._statusCallback?.(false);
            });

            this.socket.on('reconnect', () => {
                this.isConnected = true;
                this._statusCallback?.(true);
            });
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    createRoom(roomId, hasPassword, callback) {
        this.socket?.emit('create-room', { roomId, hasPassword }, callback);
    }

    joinRoom(roomId, callback) {
        this.socket?.emit('join-room', { roomId }, callback);
    }

    sendMessage(encryptedPayload, callback) {
        this.socket?.emit('chat-message', encryptedPayload, callback);
    }

    setTyping(isTyping) {
        this.socket?.emit('typing', { isTyping });
    }

    onMessage(callback) {
        this.socket?.on('chat-message', callback);
    }

    onTyping(callback) {
        this.socket?.on('typing', callback);
    }

    onUserJoined(callback) {
        this.socket?.on('user-joined', callback);
    }

    onUserLeft(callback) {
        this.socket?.on('user-left', callback);
    }

    nukeRoom(callback) {
        this.socket?.emit('nuke-room', callback);
    }

    onRoomNuked(callback) {
        this.socket?.on('room-nuked', callback);
    }

    offAll() {
        this.socket?.off('chat-message');
        this.socket?.off('typing');
        this.socket?.off('user-joined');
        this.socket?.off('user-left');
        this.socket?.off('room-nuked');
        this.socket?.off('msg-delivered');
    }

    sendDelivered(msgId) {
        this.socket?.emit('msg-delivered', { msgId });
    }

    onDelivered(callback) {
        this.socket?.on('msg-delivered', callback);
    }
}

const socketService = new SocketService();
export default socketService;
