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

function base64ToBytes(base64) {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

function bytesToBase64(bytes) {
    return btoa(bytesToStr(bytes));
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
 * Generates a completely random 32-byte key
 */
export function generateRandomKey() {
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    return bytesToBase64(key); // Return as string for sharing in #key
}

export function parseRandomKey(base64Key) {
    return base64ToBytes(base64Key);
}

/**
 * Encrypts a message
 * @param {string} text Plaintext message
 * @param {Uint8Array} key 32-byte key
 * @returns {Object} { iv: string, cipher: string } base64 encoded
 */
export function encryptMessage(text, key) {
    const iv = new Uint8Array(12); // Standard GCM IV size
    crypto.getRandomValues(iv);

    const aesGcm = gcm(key, iv);
    const plaintextBytes = strToBytes(text);
    const ciphertextBytes = aesGcm.encrypt(plaintextBytes);

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
 * @returns {string} plaintext message
 */
export function decryptMessage(ivBase64, cipherBase64, key) {
    try {
        const iv = base64ToBytes(ivBase64);
        const cipherText = base64ToBytes(cipherBase64);
        const aesGcm = gcm(key, iv);

        const plainBytes = aesGcm.decrypt(cipherText);
        return bytesToStr(plainBytes);
    } catch (e) {
        console.error("Decryption failed", e);
        return "[Message could not be decrypted]";
    }
}
