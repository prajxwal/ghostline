import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert, Modal,
    Vibration
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import { theme } from '../styles/theme';
import socketService from '../utils/socket';
import { generateAlias, formatTime } from '../utils/helpers';
import { deriveKey, encryptMessage, decryptMessage } from '../utils/crypto';

export default function ChatScreen() {
    const { roomId, password, isCreator, sessionId } = useLocalSearchParams();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [alias, setAlias] = useState('');
    const [tempAlias, setTempAlias] = useState('');
    const [showAliasModal, setShowAliasModal] = useState(true);
    const [cryptoKey, setCryptoKey] = useState(null);
    const [userCount, setUserCount] = useState(1);
    const [isTyping, setIsTyping] = useState(false);
    const [someoneTyping, setSomeoneTyping] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);

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
    }, [roomId, password]);

    useEffect(() => {
        if (!cryptoKey) return;

        socketService.connect(sessionId);

        // Track connection status
        socketService.onStatusChange((connected) => {
            setIsOnline(connected);
        });
        setIsOnline(socketService.isConnected);

        if (isCreator === '1') {
            socketService.createRoom(roomId, !!password, (res) => {
                if (res?.error) {
                    Alert.alert('ERR', res.error);
                    router.replace('/');
                    return;
                }
                socketService.joinRoom(roomId, (joinRes) => {
                    if (joinRes?.success) {
                        setUserCount(joinRes.userCount);
                        setShowShareModal(true);
                    }
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
            const dec = decryptMessage(iv, cipher, cryptoKey, sender);

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

        socketService.onRoomNuked(() => {
            Alert.alert('ROOM_NUKED', 'The creator has completely destroyed this room. All connections severed.');
            router.replace('/');
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

        const { iv, cipher } = encryptMessage(plainText, cryptoKey, alias);

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

    const handleCopyCode = async () => {
        await Clipboard.setStringAsync(String(roomId));
        Vibration.vibrate(50);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
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

            {/* Share Room Code Modal (shown after creation) */}
            <Modal visible={showShareModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>ROOM_CREATED</Text>
                        <Text style={styles.modalSub}>Share this code with your contact. They need it to join.</Text>
                        <View style={styles.shareCodeBox}>
                            <Text style={styles.shareCodeText}>{roomId}</Text>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={async () => {
                                await Clipboard.setStringAsync(String(roomId));
                                Vibration.vibrate(50);
                                setShowShareModal(false);
                                addSystemMessage(`CODE_COPIED: ${roomId}`);
                            }}>
                                <Text style={styles.modalBtnText}>[ COPY_CODE ]</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={() => setShowShareModal(false)}>
                                <Text style={styles.modalBtnText}>[ ENTER_ROOM ]</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={styles.header}>
                <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
                    <View style={styles.headerLeft}>
                        <View style={styles.roomCodeRow}>
                            <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
                            <Text style={styles.roomCode}>TARGET_NODE: {roomId}</Text>
                        </View>
                        <Text style={styles.userCount}>
                            {codeCopied ? '> CODE_COPIED_TO_CLIPBOARD' : `ACTIVE_CONNECTIONS: ${userCount}`}
                        </Text>
                    </View>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    {isCreator === '1' && (
                        <TouchableOpacity
                            style={[styles.leaveBtn, styles.nukeBtn]}
                            onPress={() => {
                                Alert.alert(
                                    'CONFIRM_NUKE',
                                    'Are you sure you want to completely destroy this room? This action cannot be reversed.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'NUKE', style: 'destructive', onPress: () => {
                                                socketService.nukeRoom((res: any) => {
                                                    if (res?.error) Alert.alert('ERR', res.error);
                                                });
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <Text style={[styles.leaveText, styles.nukeText]}>[ NUKE ]</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.leaveBtn}
                        onPress={() => router.replace('/')}
                    >
                        <Text style={styles.leaveText}>[ ABORT ]</Text>
                    </TouchableOpacity>
                </View>
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
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nukeBtn: {
        borderColor: '#ffaa00',
        marginRight: 8,
    },
    nukeText: {
        color: '#ffaa00',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusOnline: {
        backgroundColor: theme.colors.accent,
        shadowColor: theme.colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    statusOffline: {
        backgroundColor: theme.colors.danger,
        shadowColor: theme.colors.danger,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    headerLeft: {
        flexShrink: 1,
    },
    roomCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shareCodeBox: {
        borderWidth: 1,
        borderColor: theme.colors.accent,
        borderStyle: 'dashed',
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginVertical: 20,
        width: '100%',
        alignItems: 'center',
    },
    shareCodeText: {
        color: theme.colors.accentGlow,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 28,
        fontWeight: 'bold',
        letterSpacing: 6,
    },
});
