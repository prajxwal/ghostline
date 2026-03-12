import 'react-native-get-random-values';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

// noble/ciphers returns functions, no need to instantiate Classes out of nothing
// It works perfectly without async/await native WebCrypto bounds

// Encode string to Uint8Array (full UTF-8 support)
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function strToBytes(str) {
    return encoder.encode(str);
}

// Byte array to string (full UTF-8 support)
function bytesToStr(bytes) {
    return decoder.decode(bytes);
}

function hexToBytes(hexString) {
    if (hexString.length % 2 !== 0) throw new Error('Invalid hex string');
    const array = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        array[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return array;
}

function bytesToHex(bytes) {
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
    const ciphertextBytes = aesGcm.encrypt(plaintextBytes, aadBytes);

    return {
        iv: bytesToHex(iv),
        cipher: bytesToHex(ciphertextBytes)
    };
}

/**
 * Decrypts a message
 * @param {string} ivHex 
 * @param {string} cipherHex 
 * @param {Uint8Array} key 
 * @param {string} sender Alias for AAD
 * @returns {string} plaintext message
 */
export function decryptMessage(ivHex, cipherHex, key, sender) {
    try {
        const iv = hexToBytes(ivHex);
        const cipherText = hexToBytes(cipherHex);
        const aesGcm = gcm(key, iv);
        const aadBytes = strToBytes(sender);

        const plainBytes = aesGcm.decrypt(cipherText, aadBytes);
        return bytesToStr(plainBytes);
    } catch (e) {
        console.error("Decryption failed", e);
        return "[Message could not be decrypted]";
    }
}
