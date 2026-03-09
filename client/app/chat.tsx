import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert, Modal
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
    const [alias, setAlias] = useState('');
    const [tempAlias, setTempAlias] = useState('');
    const [showAliasModal, setShowAliasModal] = useState(true);
    const [cryptoKey, setCryptoKey] = useState(null);
    const [userCount, setUserCount] = useState(1);
    const [isTyping, setIsTyping] = useState(false);
    const [someoneTyping, setSomeoneTyping] = useState(false);

    const typingTimeoutRef = useRef(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        const setupKey = async () => {
            // Give UI a moment to show loading state before blocking thread
            await new Promise(resolve => setTimeout(resolve, 10));
            try {
                if (password) {
                    const derived = deriveKey(password, roomId);
                    setCryptoKey(derived);
                } else if (randomKey) {
                    const parsed = parseRandomKey(randomKey);
                    setCryptoKey(parsed);
                } else {
                    const derived = deriveKey('', roomId);
                    setCryptoKey(derived);
                }
            } catch (err) {
                Alert.alert('CRYPTO_ERR', 'FAILED_TO_DERIVE_KEYS');
            }
        };
        setupKey();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, password, randomKey]);

    useEffect(() => {
        if (!cryptoKey) return;

        socketService.connect();

        if (isCreator === '1') {
            socketService.createRoom(roomId, !!password, (res) => {
                if (res?.error) {
                    Alert.alert('ERR', res.error);
                    router.replace('/');
                    return;
                }
                socketService.joinRoom(roomId, (joinRes) => {
                    if (joinRes?.success) setUserCount(joinRes.userCount);
                });
            });
        } else {
            socketService.joinRoom(roomId, (res) => {
                if (res?.error) {
                    Alert.alert('ERR', res.error);
                    router.replace('/');
                    return;
                }
                setUserCount(res?.userCount || 1);
            });
        }

        socketService.onUserJoined(() => {
            setUserCount(c => c + 1);
            addSystemMessage('NODE_CONNECTED');
        });

        socketService.onUserLeft(() => {
            setUserCount(c => Math.max(1, c - 1));
            addSystemMessage('NODE_DISCONNECTED');
        });

        socketService.onMessage((encryptedPayload) => {
            setSomeoneTyping(false);
            if (!cryptoKey) return;

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
            socketService.offAll();
            socketService.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, isCreator, cryptoKey]);

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

        const { iv, cipher } = encryptMessage(plainText, cryptoKey);

        const payload = {
            iv,
            cipher,
            sender: alias,
            timestamp: ts
        };

        socketService.sendMessage(payload);

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
                    <Text style={styles.systemMessage}>[SYS_WARN]: {item.text}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.messageWrapper, item.isOwn ? styles.messageOwnWrapper : {}]}>
                {!item.isOwn && <Text style={styles.senderAlias}>&lt;{item.sender}&gt;</Text>}
                <View style={[styles.messageBubble, item.isOwn ? styles.messageOwn : styles.messageOther]}>
                    <Text style={styles.messageText}>
                        {item.isOwn ? '> ' : ''}{item.text}
                    </Text>
                </View>
                <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
            </View>
        );
    };

    const handleSetAlias = () => {
        if (tempAlias.trim().length > 0) {
            setAlias(tempAlias.trim());
        } else {
            setAlias(generateAlias());
        }
        setShowAliasModal(false);
    };

    if (!cryptoKey) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>[ INITIATING_SECURE_HANDSHAKE... ]</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Modal visible={showAliasModal} animationType="fade" transparent>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>IDENTIFY_YOURSELF</Text>
                        <Text style={styles.modalSub}>Leave blank for random assignment.</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="anon_"
                            placeholderTextColor={theme.colors.textMuted}
                            value={tempAlias}
                            onChangeText={setTempAlias}
                            autoFocus
                            maxLength={15}
                            onSubmitEditing={handleSetAlias}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={() => router.replace('/')}>
                                <Text style={styles.leaveText}>[ ABORT ]</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={handleSetAlias}>
                                <Text style={styles.modalBtnText}>[ ENTER_NODE ]</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <View style={styles.header}>
                <View>
                    <Text style={styles.roomCode}>TARGET_NODE: {roomId}</Text>
                    <Text style={styles.userCount}>ACTIVE_CONNECTIONS: {userCount}</Text>
                </View>
                <TouchableOpacity
                    style={styles.leaveBtn}
                    onPress={() => router.replace('/')}
                >
                    <Text style={styles.leaveText}>[ ABORT ]</Text>
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
                    <Text style={styles.typingText}>Incoming transmission...</Text>
                </View>
            )}

            <View style={styles.inputContainer}>
                <Text style={styles.prompt}>~/&gt;</Text>
                <TextInput
                    style={styles.input}
                    placeholder="_"
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
                    <Text style={styles.sendText}>EXEC</Text>
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
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
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
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.accentGlow,
        fontFamily: theme.typography.fontFamilyMono,
    },
    userCount: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginTop: 2,
        fontFamily: theme.typography.fontFamilyMono,
    },
    leaveBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: theme.colors.danger,
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.bgPrimary,
    },
    leaveText: {
        color: theme.colors.danger,
        fontSize: 12,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamilyMono,
    },
    chatContainer: {
        padding: theme.spacing.md,
        flexGrow: 1,
        justifyContent: 'flex-end',
    },
    systemMessageContainer: {
        alignItems: 'flex-start',
        marginVertical: 10,
    },
    systemMessage: {
        color: '#ffaa00', // Warning yellow/orange for sys
        fontSize: 12,
        fontFamily: theme.typography.fontFamilyMono,
    },
    messageWrapper: {
        marginBottom: 16,
        maxWidth: '90%',
        alignSelf: 'flex-start',
    },
    messageOwnWrapper: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    senderAlias: {
        fontSize: 10,
        color: theme.colors.textMuted,
        marginBottom: 2,
        marginLeft: 2,
        fontFamily: theme.typography.fontFamilyMono,
    },
    messageBubble: {
        padding: 8,
        borderRadius: theme.borderRadius.sm,
        borderWidth: 1,
    },
    messageOwn: {
        backgroundColor: 'transparent',
        borderColor: theme.colors.accent,
    },
    messageOther: {
        backgroundColor: theme.colors.bgSecondary,
        borderColor: theme.colors.border,
    },
    messageText: {
        color: theme.colors.textPrimary,
        fontSize: 14,
        fontFamily: theme.typography.fontFamilyMono,
    },
    messageTime: {
        fontSize: 10,
        color: theme.colors.textMuted,
        marginTop: 4,
        fontFamily: theme.typography.fontFamilyMono,
    },
    typingIndicator: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: 8,
    },
    typingText: {
        color: theme.colors.accentGlow,
        fontSize: 10,
        fontFamily: theme.typography.fontFamilyMono,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: theme.spacing.md,
        backgroundColor: theme.colors.bgSecondary,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        alignItems: 'center',
    },
    prompt: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 16,
        marginRight: 8,
    },
    input: {
        flex: 1,
        backgroundColor: 'transparent',
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 16,
        paddingVertical: 8,
        maxHeight: 100,
    },
    sendBtn: {
        marginLeft: 12,
        backgroundColor: theme.colors.bgCard,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: 16,
        paddingVertical: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        borderColor: theme.colors.border,
        opacity: 0.5,
    },
    sendText: {
        color: theme.colors.accent,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamilyMono,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    modalContent: {
        backgroundColor: theme.colors.bgSecondary,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        padding: theme.spacing.lg,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    modalTitle: {
        color: theme.colors.accentGlow,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalSub: {
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 12,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInput: {
        width: '100%',
        borderWidth: 1,
        borderColor: theme.colors.border,
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        padding: 12,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    modalActionBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    modalBtnText: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontWeight: 'bold',
    }
});
