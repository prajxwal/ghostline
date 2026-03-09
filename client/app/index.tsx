import { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../styles/theme';
import { generateRoomCode } from '../utils/helpers';
import { generateRandomKey } from '../utils/crypto';

export default function LandingScreen() {
    const [joinCode, setJoinCode] = null || useState('');
    const [password, setPassword] = useState('');

    const handleCreateRoom = () => {
        try {
            const code = generateRoomCode();
            let randomKey = '';
            if (!password) {
                randomKey = generateRandomKey();
            }

            router.push({
                pathname: '/chat',
                params: {
                    roomId: code,
                    password: password,
                    isCreator: '1',
                    randomKey: randomKey
                }
            });
        } catch (err) {
            alert(`[SYS_ERR]: FAILED_TO_CREATE_ROOM - ${(err as Error).message}`);
        }
    };

    const handleJoinRoom = () => {
        try {
            if (!joinCode.trim()) return;
            router.push({
                pathname: '/chat',
                params: {
                    roomId: joinCode.toUpperCase().trim(),
                    password: password,
                    isCreator: '0'
                }
            });
        } catch (err) {
            alert(`[SYS_ERR]: FAILED_TO_JOIN_ROOM - ${(err as Error).message}`);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.hero}>
                    <Text style={styles.asciiArt}>
                        {`  .-\\-.\n (o o)\n | O \\\n  \\   \\\n   \`~~~'`}
                    </Text>
                    <Text style={styles.title}>GHOSTLINE_</Text>
                    <Text style={styles.subtitle}>
                        TRULY_ANONYMOUS_CHAT.{"\n"}
                        NO_SIGNUP. NO_LOGS. JUST_CHAT.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>[ JOIN_ROOM ]</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ACCESS_CODE"
                        placeholderTextColor={theme.colors.textMuted}
                        value={joinCode}
                        onChangeText={setJoinCode}
                        autoCapitalize="characters"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="PASSWORD (OPTIONAL)"
                        placeholderTextColor={theme.colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity style={styles.button} onPress={handleJoinRoom}>
                        <Text style={styles.buttonText}>&gt; INITIATE_JOIN</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.or}>// OR</Text>
                    <View style={styles.line} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>[ CREATE_ROOM ]</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="SET_PASSWORD (OPTIONAL)"
                        placeholderTextColor={theme.colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={handleCreateRoom}>
                        <Text style={styles.buttonOutlineText}>&gt; INITIATE_CREATE</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bgPrimary,
    },
    scroll: {
        padding: theme.spacing.lg,
        flexGrow: 1,
        justifyContent: 'center',
    },
    hero: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    asciiArt: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 24,
        marginBottom: theme.spacing.sm,
        textShadowColor: theme.colors.accentGlow,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    title: {
        fontSize: theme.typography.h1.fontSize,
        fontWeight: theme.typography.h1.fontWeight,
        fontFamily: theme.typography.h1.fontFamily,
        color: theme.colors.accent,
        marginBottom: theme.spacing.sm,
        textShadowColor: theme.colors.accentGlow,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: theme.typography.body.fontSize,
        fontFamily: theme.typography.body.fontFamily,
        color: theme.colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.lg,
    },
    card: {
        backgroundColor: theme.colors.bgSecondary,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.md,
    },
    cardTitle: {
        fontSize: theme.typography.h2.fontSize,
        fontWeight: theme.typography.h2.fontWeight,
        fontFamily: theme.typography.h2.fontFamily,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.md,
    },
    input: {
        backgroundColor: theme.colors.bgPrimary,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 14,
        marginBottom: theme.spacing.md,
    },
    button: {
        backgroundColor: theme.colors.bgCard,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        alignItems: 'center',
    },
    buttonText: {
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 16,
        fontWeight: '600',
    },
    buttonOutline: {
        backgroundColor: 'transparent',
        borderStyle: 'dashed',
    },
    buttonOutlineText: {
        color: theme.colors.accentGlow,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.md,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    or: {
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamilyMono,
        marginHorizontal: theme.spacing.md,
        fontWeight: '600',
    }
});
