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
        const code = generateRoomCode();
        // If no password, we generate a random key. Otherwise we use the password for encryption.
        let randomKey = '';
        if (!password) {
            randomKey = generateRandomKey();
        }

        // We pass params. We can use Expo Router's standard parameters.
        // For extreme privacy, `#key=...` is best, but since it's an app, React Navigation params are totally local and in-memory.
        router.push({
            pathname: '/chat',
            params: {
                roomId: code,
                password: password,
                isCreator: '1',
                randomKey: randomKey
            }
        });
    };

    const handleJoinRoom = () => {
        if (!joinCode.trim()) return;
        router.push({
            pathname: '/chat',
            params: {
                roomId: joinCode.toUpperCase().trim(),
                password: password,
                isCreator: '0'
            }
        });
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.hero}>
                    <Text style={styles.title}>👻 Ghostline</Text>
                    <Text style={styles.subtitle}>
                        Truly anonymous chat. No signup. No logs. No traces. Just chat.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Join a Room</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Room Code (e.g. X7K2M9)"
                        placeholderTextColor={theme.colors.textMuted}
                        value={joinCode}
                        onChangeText={setJoinCode}
                        autoCapitalize="characters"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password (Optional)"
                        placeholderTextColor={theme.colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity style={styles.button} onPress={handleJoinRoom}>
                        <Text style={styles.buttonText}>Join Room</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.or}>OR</Text>
                    <View style={styles.line} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Create a Room</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Set a Password (Optional)"
                        placeholderTextColor={theme.colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={handleCreateRoom}>
                        <Text style={styles.buttonOutlineText}>Create Room</Text>
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
    title: {
        fontSize: theme.typography.h1.fontSize,
        fontWeight: theme.typography.h1.fontWeight,
        color: theme.colors.accentGlow,
        marginBottom: theme.spacing.sm,
    },
    subtitle: {
        fontSize: theme.typography.body.fontSize,
        color: theme.colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.lg,
    },
    card: {
        backgroundColor: theme.colors.bgCard,
        padding: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.md,
    },
    cardTitle: {
        fontSize: theme.typography.h2.fontSize,
        fontWeight: theme.typography.h2.fontWeight,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.md,
    },
    input: {
        backgroundColor: theme.colors.bgSecondary,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        color: theme.colors.textPrimary,
        fontSize: 16,
        marginBottom: theme.spacing.md,
    },
    button: {
        backgroundColor: theme.colors.accent,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.accent,
    },
    buttonOutlineText: {
        color: theme.colors.accentGlow,
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
        marginHorizontal: theme.spacing.md,
        fontWeight: '600',
    }
});
