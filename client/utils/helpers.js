const ADJECTIVES = ['Shadow', 'Ghost', 'Phantom', 'Silent', 'Dark', 'Neon', 'Cyber', 'Void', 'Echo', 'Lost'];
const NOUNS = ['Fox', 'Pine', 'Wolf', 'Raven', 'Byte', 'Pulse', 'Spark', 'Wave', 'Star', 'Viper'];

export function generateAlias() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj}${noun}`;
}

export function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
}
