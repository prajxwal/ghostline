import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView, Animated, LayoutAnimation, UIManager } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../styles/theme';
import { generateAlias } from '../../utils/helpers';
import socketService from '../../utils/socket';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ASCII_ART = `
  ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
 ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
 ██║  ███╗███████║██║   ██║███████╗   ██║   
 ██║   ██║██╔══██║██║   ██║╚════██║   ██║   
 ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   
  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   
`;

const GLITCH_CHARS = '!<>-_/[]{}—=+*^?#_010101';

export default function IndexScreen() {
    const [joinCode, setJoinCode] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [isBooting, setIsBooting] = useState(true);
    const [displayText, setDisplayText] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let iteration = 0;
        const totalIterations = 20;
        
        const interval = setInterval(() => {
            setDisplayText((prev) => {
                let text = '';
                const settlingStart = 5; 
                
                for (let i = 0; i < ASCII_ART.length; i++) {
                    const char = ASCII_ART[i];
                    if (char === '\n' || char === ' ') {
                        text += char;
                        continue;
                    }
                    
                    if (iteration < settlingStart) {
                        text += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                    } else {
                        const progress = (iteration - settlingStart) / (totalIterations - settlingStart);
                        const charPosition = i / ASCII_ART.length;
                        
                        if (charPosition < progress + (Math.random() * 0.2 - 0.1)) {
                            text += char;
                        } else {
                            text += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                        }
                    }
                }
                return text;
            });
            
            iteration++;
            
            if (iteration > totalIterations + 5) {
                clearInterval(interval);
                setDisplayText(ASCII_ART);
                
                LayoutAnimation.configureNext(
                    LayoutAnimation.create(400, 'easeInEaseOut', 'opacity')
                );
                setIsBooting(false);
                
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }).start();
            }
        }, 50);

        return () => clearInterval(interval);
    }, []);

    const handleCreateRoom = async () => {
        setIsCreating(true);
        const roomId = generateAlias(); // e.g., "alpha-bravo-charlie"
        const sessionId = Date.now().toString();

        socketService.connect(sessionId);
        socketService.onStatusChange((connected: boolean) => {
            if (connected && isCreating) {
                setIsCreating(false);
                router.push({
                    pathname: '/chat',
                    params: { roomId, password: createPassword, isCreator: '1', sessionId }
                });
            }
        });
    };

    const handleJoinRoom = () => {
        if (!joinCode.trim()) {
            Alert.alert('ERR', 'Node address required');
            return;
        }

        const sessionId = Date.now().toString();
        router.push({
            pathname: '/chat',
            params: { roomId: joinCode.trim().toLowerCase(), password: joinPassword, isCreator: '0', sessionId }
        });
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.ascii}>
                        {isBooting ? displayText : ASCII_ART}
                    </Text>
                    {!isBooting && (
                        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', width: '100%' }}>
                            <Text style={styles.subtitle}>SECURE P2P COMMUNICATIONS LINK</Text>
                            <Text style={styles.warning}>[!] ZERO LOGGING. ZERO PERSISTENCE. BURN ON READ.</Text>
                        </Animated.View>
                    )}
                </View>

                {!isBooting && (
                    <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
                        <View style={styles.panel}>
                            <Text style={styles.panelTitle}>[ ESTABLISH_NODE ]</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="ENTER_PASSPHRASE_OR_BLANK"
                                placeholderTextColor={theme.colors.textMuted}
                                value={createPassword}
                                onChangeText={setCreatePassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                            <TouchableOpacity style={styles.btn} onPress={handleCreateRoom} disabled={isCreating}>
                                <Text style={styles.btnText}>{isCreating ? 'BOOTING...' : 'INITIATE_PROTOCOL'}</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.panel, styles.panelSecondary]}>
                            <Text style={styles.panelTitle}>[ CONNECT_TO_NODE ]</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="TARGET_NODE_ADDRESS"
                                placeholderTextColor={theme.colors.textMuted}
                                value={joinCode}
                                onChangeText={setJoinCode}
                                autoCapitalize="none"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="PASSPHRASE_IF_REQUIRED"
                                placeholderTextColor={theme.colors.textMuted}
                                value={joinPassword}
                                onChangeText={setJoinPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                onSubmitEditing={() => handleJoinRoom()}
                            />
                            <TouchableOpacity style={styles.btn} onPress={handleJoinRoom}>
                                <Text style={styles.btnText}>ESTABLISH_HANDSHAKE</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* Spacer to prevent overlap with floating pill nav */}
                        <View style={{ height: 100 }} />
                    </Animated.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bgPrimary,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    ascii: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 10,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
    subtitle: {
        color: theme.colors.accentGlow,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    warning: {
        color: theme.colors.danger,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 10,
        textAlign: 'center',
    },
    panel: {
        backgroundColor: theme.colors.bgSecondary,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.lg,
    },
    panelSecondary: {
        borderColor: theme.colors.border,
    },
    panelTitle: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        marginBottom: theme.spacing.md,
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamilyMono,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        fontSize: 14,
    },
    btn: {
        backgroundColor: theme.colors.bgCard,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        padding: theme.spacing.md,
        alignItems: 'center',
    },
    btnText: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
