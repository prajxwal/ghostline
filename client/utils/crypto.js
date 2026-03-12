import 'react-native-get-random-values';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

// noble/ciphers returns functions, no need to instantiate Classes out of nothing
// It works perfectly without async/await native WebCrypto bounds

// Encode string to Uint8Array
function strToBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i); // Assuming UTF-8 base for simple chat
    }
    return bytes;
}

// Byte array to Latin1 string (for base64 encoding later or direct passage)
function bytesToStr(bytes) {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return str;
}

function base64ToBytes(hexString) {
    if (hexString.length % 2 !== 0) throw new Error('Invalid hex string');
    const array = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        array[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return array;
}

function bytesToBase64(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Derive 256-bit AES key from password using PBKDF2
 * @param {string} password 
 * @param {string} roomId Used exactly as the salt
 * @returns {Uint8Array} Derived key bytes (32 bytes = 256 bits)
 */
export function deriveKey(password, roomId) {
    const salt = strToBytes(roomId);
    const pass = strToBytes(password);
    // PBKDF2 with SHA-256, 100000 iterations, 32 bytes derived key lengths
    return pbkdf2(sha256, pass, salt, { c: 100000, dkLen: 32 });
}

/**
 * Encrypts a message
 * @param {string} text Plaintext message
 * @param {Uint8Array} key 32-byte key
 * @param {string} sender Alias for AAD
 * @returns {Object} { iv: string, cipher: string } base64 encoded
 */
export function encryptMessage(text, key, sender) {
    const iv = new Uint8Array(12); // Standard GCM IV size
    crypto.getRandomValues(iv);

    const aesGcm = gcm(key, iv);
    const plaintextBytes = strToBytes(text);
    const aadBytes = strToBytes(sender);
    const ciphertextBytes = aesGcm.encrypt(plaintextBytes, { AAD: aadBytes });

    return {
        iv: bytesToBase64(iv),
        cipher: bytesToBase64(ciphertextBytes)
    };
}

/**
 * Decrypts a message
 * @param {string} ivBase64 
 * @param {string} cipherBase64 
 * @param {Uint8Array} key 
 * @param {string} sender Alias for AAD
 * @returns {string} plaintext message
 */
export function decryptMessage(ivBase64, cipherBase64, key, sender) {
    try {
        const iv = base64ToBytes(ivBase64);
        const cipherText = base64ToBytes(cipherBase64);
        const aesGcm = gcm(key, iv);
        const aadBytes = strToBytes(sender);

        const plainBytes = aesGcm.decrypt(cipherText, { AAD: aadBytes });
        return bytesToStr(plainBytes);
    } catch (e) {
        console.error("Decryption failed", e);
        return "[Message could not be decrypted]";
    }
}
