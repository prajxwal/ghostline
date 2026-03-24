import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert, Modal,
    Vibration, Image
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from 'expo-router';
import { theme } from '../styles/theme';
import socketService from '../utils/socket';
import { generateAlias, formatTime } from '../utils/helpers';
import { deriveKey, encryptMessage, decryptMessage } from '../utils/crypto';

const GLITCH_CHARS = '!<>-_/[]{}—=+*^?#_010101';

const DecryptText = ({ text, isOwn }: { text: string, isOwn: boolean }) => {
    const [displayText, setDisplayText] = useState(isOwn ? text : '');
    
    useEffect(() => {
        if (isOwn || !text) {
            setDisplayText(text);
            return;
        }

        let iteration = 0;
        const totalIterations = 15; 
        
        const interval = setInterval(() => {
            setDisplayText((prev: string) => {
                let current = '';
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    if (char === ' ' || char === '\n') {
                        current += char;
                        continue;
                    }
                    const progress = iteration / totalIterations;
                    const charPosition = i / text.length;
                    
                    if (charPosition < progress) {
                        current += char;
                    } else {
                        current += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                    }
                }
                return current;
            });
            
            iteration++;
            if (iteration > totalIterations + 3) {
                clearInterval(interval);
                setDisplayText(text);
            }
        }, 40);

        return () => clearInterval(interval);
    }, [text, isOwn]);

    return (
        <Text style={styles.messageText}>
            {isOwn && text ? '> ' : ''}{displayText}
        </Text>
    );
};

export default function ChatScreen() {
    const { roomId, password, isCreator, sessionId } = useLocalSearchParams();
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [alias, setAlias] = useState('');
    const [cryptoKey, setCryptoKey] = useState(null);
    const [userCount, setUserCount] = useState(1);
    const [isTyping, setIsTyping] = useState(false);
    const [someoneTyping, setSomeoneTyping] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [replyTo, setReplyTo] = useState<any>(null);
    const [selectedImage, setSelectedImage] = useState<any>(null);

    const typingTimeoutRef = useRef(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        const loadIdentity = async () => {
            try {
                const saved = await AsyncStorage.getItem('ghostline_alias');
                if (saved) {
                    setAlias(saved);
                } else {
                    const generated = generateAlias();
                    setAlias(generated);
                    await AsyncStorage.setItem('ghostline_alias', generated);
                }
            } catch (e) {
                setAlias(generateAlias());
            }
        };
        loadIdentity();

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

            const { iv, cipher, sender, timestamp, msgId } = encryptedPayload;
            const dec = decryptMessage(iv, cipher, cryptoKey, sender);

            let parsedObj;
            try {
                parsedObj = JSON.parse(dec);
                if (typeof parsedObj !== 'object' || (!parsedObj.text && !parsedObj.image)) {
                    parsedObj = { text: dec }; 
                }
            } catch (e) {
                parsedObj = { text: dec }; 
            }

            setMessages(prev => [...prev, {
                id: msgId || Math.random().toString(),
                text: parsedObj.text,
                replyTo: parsedObj.replyTo,
                image: parsedObj.image,
                sender,
                timestamp,
                isOwn: false
            }]);

            // Send delivery confirmation back
            if (msgId) {
                socketService.sendDelivered(msgId);
            }
        });

        socketService.onDelivered(({ msgId }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === msgId ? { ...msg, status: 'delivered' } : msg
            ));
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

    const handlePickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            try {
                // aggressively scale down to keep base64 payload size under control for websocket
                const manipResult = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [{ resize: { width: Math.min(asset.width, 800) } }], 
                    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                setSelectedImage({ uri: manipResult.uri, base64: manipResult.base64 });
            } catch(e) {
                Alert.alert('ERR', 'Failed to compress image');
            }
        }
    };

    const handleSend = () => {
        if ((!inputText.trim() && !selectedImage) || !cryptoKey) return;

        const plainText = inputText.trim();
        const ts = new Date().toISOString();
        const msgId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        const messageData = {
            text: plainText,
            replyTo: replyTo ? { sender: replyTo.sender, text: replyTo.text } : null,
            image: selectedImage ? selectedImage.base64 : null
        };
        const stringifiedPlx = JSON.stringify(messageData);

        const { iv, cipher } = encryptMessage(stringifiedPlx, cryptoKey, alias);

        const payload = {
            iv,
            cipher,
            sender: alias,
            timestamp: ts,
            msgId
        };

        // Add message locally with 'sending' status
        setMessages(prev => [...prev, {
            id: msgId,
            text: plainText,
            replyTo: messageData.replyTo,
            image: messageData.image,
            sender: alias,
            timestamp: ts,
            isOwn: true,
            status: 'sending'
        }]);

        socketService.sendMessage(payload, (ack) => {
            if (ack?.status === 'sent') {
                setMessages(prev => prev.map(msg =>
                    msg.id === msgId ? { ...msg, status: 'sent' } : msg
                ));
            }
        });

        setInputText('');
        setReplyTo(null);
        setSelectedImage(null);
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
            <TouchableOpacity 
                activeOpacity={0.8}
                onLongPress={() => {
                    Vibration.vibrate(50);
                    setReplyTo({ 
                        id: item.id, 
                        text: item.text, 
                        sender: item.isOwn ? 'You' : item.sender 
                    });
                }}
                style={[styles.messageWrapper, item.isOwn ? styles.messageOwnWrapper : {}]}
            >
                {!item.isOwn && <Text style={styles.senderAlias}>&lt;{item.sender}&gt;</Text>}
                <View style={[styles.messageBubble, item.isOwn ? styles.messageOwn : styles.messageOther]}>
                    {item.replyTo && (
                        <View style={styles.quoteBlock}>
                            <Text style={styles.quoteSender}>{item.replyTo.sender}</Text>
                            <Text style={styles.quoteText} numberOfLines={3}>{item.replyTo.text}</Text>
                        </View>
                    )}
                    {item.image && (
                        <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.image}` }} 
                            style={[styles.messageImage, { opacity: item.status === 'sending' ? 0.7 : 1 }]} 
                            resizeMode="cover"
                        />
                    )}
                    {item.text ? (
                        <DecryptText text={item.text} isOwn={item.isOwn} />
                    ) : null}
                </View>
                <View style={styles.messageFooter}>
                    <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
                    {item.isOwn && (
                        <Text style={[
                            styles.receiptIndicator,
                            item.status === 'delivered' && styles.receiptDelivered
                        ]}>
                            {item.status === 'delivered' ? ' ✓✓' :
                             item.status === 'sent' ? ' ✓' :
                             ' ⏳'}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
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
                        {!codeCopied && <Text style={styles.copyHint}>[ TAP_TO_COPY_AND_SHARE ]</Text>}
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

            {replyTo && (
                <View style={styles.replyPreviewBanner}>
                    <View style={styles.replyPreviewContent}>
                        <Text style={styles.quoteSender}>Replying to {replyTo.sender}</Text>
                        <Text style={styles.quoteText} numberOfLines={1}>{replyTo.text}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.cancelReplyBtn}>
                        <Text style={styles.cancelReplyText}>[X]</Text>
                    </TouchableOpacity>
                </View>
            )}

            {selectedImage && (
                <View style={styles.replyPreviewBanner}>
                    <View style={[styles.replyPreviewContent, { flexDirection: 'row', alignItems: 'center' }]}>
                        <Image source={{ uri: selectedImage.uri }} style={styles.previewImageThumbnail} />
                        <Text style={[styles.quoteText, { marginLeft: 10 }]}>Encrypted Attachment Ready</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.cancelReplyBtn}>
                        <Text style={styles.cancelReplyText}>[X]</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.inputContainer}>
                <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn}>
                    <Text style={styles.attachText}>[+]</Text>
                </TouchableOpacity>
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
                    style={[styles.sendBtn, (!inputText.trim() && !selectedImage) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim() && !selectedImage}
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
    copyHint: {
        fontSize: 10,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamilyMono,
        marginTop: 2,
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
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    receiptIndicator: {
        fontSize: 10,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamilyMono,
    },
    receiptDelivered: {
        color: theme.colors.accent,
    },
    quoteBlock: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderLeftWidth: 2,
        borderLeftColor: theme.colors.accent,
        padding: 6,
        marginBottom: 6,
        borderRadius: 4,
    },
    quoteSender: {
        color: theme.colors.accent,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
        fontFamily: theme.typography.fontFamilyMono,
    },
    quoteText: {
        color: theme.colors.textMuted,
        fontSize: 12,
        fontFamily: theme.typography.fontFamilyMono,
    },
    replyPreviewBanner: {
        flexDirection: 'row',
        backgroundColor: theme.colors.bgCard,
        padding: 8,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        alignItems: 'center',
    },
    replyPreviewContent: {
        flex: 1,
        borderLeftWidth: 2,
        borderLeftColor: theme.colors.accent,
        paddingLeft: 8,
    },
    cancelReplyBtn: {
        padding: 8,
    },
    cancelReplyText: {
        color: theme.colors.danger,
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: theme.typography.fontFamilyMono,
    },
    attachBtn: {
        paddingRight: 10,
    },
    attachText: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 18,
        fontWeight: 'bold',
    },
    messageImage: {
        width: 220,
        height: 220,
        borderRadius: 4,
        marginBottom: 6,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    previewImageThumbnail: {
        width: 40,
        height: 40,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: theme.colors.accent,
    }
});
