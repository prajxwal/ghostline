import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, FlatList, Keyboard,
    ActivityIndicator, Alert, Clipboard
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { theme } from '../styles/theme';
import socketService from '../utils/socket';
import { generateAlias, formatTime } from '../utils/helpers';
import { deriveKey, parseRandomKey, encryptMessage, decryptMessage } from '../utils/crypto';

export default function ChatScreen() {
    const { roomId, password, isCreator, randomKey } = useLocalSearchParams();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [alias] = useState(() => generateAlias());
    const [cryptoKey, setCryptoKey] = useState(null);
    const [userCount, setUserCount] = useState(1);
    const [isTyping, setIsTyping] = useState(false);
    const [someoneTyping, setSomeoneTyping] = useState(false);

    const typingTimeoutRef = useRef(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        // 1. Setup Crypto Key asynchronously (since PBKDF2 can be CPU intensive)
        const setupKey = async () => {
            try {
                if (password) {
                    // Both use the same password -> same derived key
                    const derived = deriveKey(password, roomId);
                    setCryptoKey(derived);
                } else if (randomKey) {
                    // The creator passed a random key. We use it directly.
                    const parsed = parseRandomKey(randomKey);
                    setCryptoKey(parsed);
                } else {
                    // They joined without a password. In a real app they'd need the #key via link,
                    // but since this is an MVP we'd need them to share the key manually.
                    // For simplicity if joining without password, we assume it's just a blank password key derivation 
                    // or we handle this error. If randomKey is missing, we derive from empty string.
                    const derived = deriveKey('', roomId);
                    setCryptoKey(derived);
                }
            } catch (err) {
                Alert.alert('Crypto Error', 'Failed to derive encryption keys.');
            }
        };
        setupKey();

        // 2. Setup Sockets
        socketService.connect();

        if (isCreator === '1') {
            socketService.createRoom(roomId, !!password, (res) => {
                if (res.error) {
                    Alert.alert('Error', res.error);
                    router.replace('/');
                    return;
                }
                socketService.joinRoom(roomId, (joinRes) => {
                    if (joinRes.success) setUserCount(joinRes.userCount);
                });
            });
        } else {
            socketService.joinRoom(roomId, (res) => {
                if (res.error) {
                    Alert.alert('Error', res.error);
                    router.replace('/');
                    return;
                }
                setUserCount(res.userCount);
            });
        }

        socketService.onUserJoined(() => {
            setUserCount(c => c + 1);
            addSystemMessage('A ghost joined the room.');
        });

        socketService.onUserLeft(() => {
            setUserCount(c => Math.max(1, c - 1));
            addSystemMessage('A ghost vanished.');
        });

        socketService.onMessage((encryptedPayload) => {
            setSomeoneTyping(false);
            if (!cryptoKey) return; // Not ready

            const { iv, cipher, sender, timestamp } = encryptedPayload;
            const dec = decryptMessage(iv, cipher, cryptoKey);

            setMessages(prev => [...prev, {
                id: Math.random().toString(),
                text: dec,
                sender,
                timestamp,
                isOwn: false
            }]);
        });

        socketService.onTyping(({ isTyping }) => {
            setSomeoneTyping(isTyping);
        });

        return () => {
            // Ephemeral by design: Cleanup when leaving
            socketService.offAll();
            socketService.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, cryptoKey]);

    const addSystemMessage = (text) => {
        setMessages(prev => [...prev, {
            id: Math.random().toString(),
            text,
            isSystem: true
        }]);
    };

    const handleSend = () => {
        if (!inputText.trim() || !cryptoKey) return;

        const plainText = inputText.trim();
        const ts = new Date().toISOString();

        // Encrypt
        const { iv, cipher } = encryptMessage(plainText, cryptoKey);

        const payload = {
            iv,
            cipher,
            sender: alias,
            timestamp: ts
        };

        socketService.sendMessage(payload);

        // Add to local UI
        setMessages(prev => [...prev, {
            id: Math.random().toString(),
            text: plainText,
            sender: alias,
            timestamp: ts,
            isOwn: true
        }]);

        setInputText('');
        handleTyping(false);
    };

    const handleTyping = (isTypingState = true) => {
        if (isTyping !== isTypingState) {
            setIsTyping(isTypingState);
            socketService.setTyping(isTypingState);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        if (isTypingState) {
            typingTimeoutRef.current = setTimeout(() => {
                handleTyping(false);
            }, 2000);
        }
    };

    const renderMessage = ({ item }) => {
        if (item.isSystem) {
            return (
                <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessage}>{item.text}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.messageWrapper, item.isOwn ? styles.messageOwnWrapper : {}]}>
                {!item.isOwn && <Text style={styles.senderAlias}>{item.sender}</Text>}
                <View style={[styles.messageBubble, item.isOwn ? styles.messageOwn : styles.messageOther]}>
                    <Text style={styles.messageText}>{item.text}</Text>
                </View>
                <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
            </View>
        );
    };

    if (!cryptoKey) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>Deriving Keys & Establishing Secure Tunnel...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.roomCode}>Room: {roomId}</Text>
                    <Text style={styles.userCount}>{userCount} Ghost(s) connected</Text>
                </View>
                <TouchableOpacity
                    style={styles.leaveBtn}
                    onPress={() => router.replace('/')}
                >
                    <Text style={styles.leaveText}>Vanish</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.chatContainer}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                onLayout={() => flatListRef.current?.scrollToEnd()}
            />

            {someoneTyping && (
                <View style={styles.typingIndicator}>
                    <Text style={styles.typingText}>Someone is typing...</Text>
                </View>
            )}

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Whisper into the void..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={inputText}
                    onChangeText={(text) => {
                        setInputText(text);
                        handleTyping(text.length > 0);
                    }}
                    onSubmitEditing={handleSend}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim()}
                >
                    <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bgPrimary,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: theme.colors.bgPrimary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 20,
        color: theme.colors.textMuted,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.md,
        backgroundColor: theme.colors.bgSecondary,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    roomCode: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.accentGlow,
    },
    userCount: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    leaveBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: theme.colors.danger,
        borderRadius: theme.borderRadius.sm,
    },
    leaveText: {
        color: theme.colors.danger,
        fontSize: 14,
        fontWeight: '600',
    },
    chatContainer: {
        padding: theme.spacing.md,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },
    systemMessageContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    systemMessage: {
        backgroundColor: theme.colors.bgSecondary,
        color: theme.colors.textMuted,
        fontSize: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    messageWrapper: {
        marginBottom: 16,
        maxWidth: '85%',
        alignSelf: 'flex-start',
    },
    messageOwnWrapper: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    senderAlias: {
        fontSize: 10,
        color: theme.colors.textMuted,
        marginBottom: 4,
        marginLeft: 4,
    },
    messageBubble: {
        padding: 12,
        borderRadius: theme.borderRadius.lg,
    },
    messageOwn: {
        backgroundColor: theme.colors.accent,
        borderBottomRightRadius: 4,
    },
    messageOther: {
        backgroundColor: theme.colors.bgCard,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    messageText: {
        color: '#fff',
        fontSize: 16,
    },
    messageTime: {
        fontSize: 10,
        color: theme.colors.textMuted,
        marginTop: 4,
    },
    typingIndicator: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: 8,
    },
    typingText: {
        color: theme.colors.accentGlow,
        fontSize: 12,
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        padding: theme.spacing.md,
        backgroundColor: theme.colors.bgSecondary,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        backgroundColor: theme.colors.bgPrimary,
        color: '#fff',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        maxHeight: 100,
    },
    sendBtn: {
        marginLeft: 12,
        backgroundColor: theme.colors.accent,
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: theme.colors.bgCard,
    },
    sendText: {
        color: '#fff',
        fontWeight: '600',
    }
});
