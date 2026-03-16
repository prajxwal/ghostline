import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../../styles/theme';
import { generateAlias } from '../../utils/helpers';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
    const [alias, setAlias] = useState('');
    const [tempAlias, setTempAlias] = useState('');

    useEffect(() => {
        // Load saved alias on mount
        const loadAlias = async () => {
            try {
                const saved = await AsyncStorage.getItem('ghostline_alias');
                if (saved) {
                    setAlias(saved);
                    setTempAlias(saved);
                } else {
                    const fallback = generateAlias();
                    setAlias(fallback);
                }
            } catch(e) {
                setAlias('anon_error');
            }
        };
        loadAlias();
    }, []);

    const handleSaveAlias = async () => {
        const newAlias = tempAlias.trim() || generateAlias();
        setAlias(newAlias);
        setTempAlias(newAlias);
        try {
            await AsyncStorage.setItem('ghostline_alias', newAlias);
        } catch(e) {
            console.error('Failed to save alias', e);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.headerTitle}>GHOSTLINE_CONFIG</Text>

            <View style={styles.panel}>
                <Text style={styles.panelTitle}>[ IDENTITY_MANAGEMENT ]</Text>
                <Text style={styles.description}>
                    Set a default alias to use across all nodes. This only changes your display name, nothing else is stored globally.
                </Text>
                
                <View style={styles.inputRow}>
                    <Text style={styles.prompt}>~/alias&gt;</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="anon_"
                        placeholderTextColor={theme.colors.textMuted}
                        value={tempAlias}
                        onChangeText={setTempAlias}
                        maxLength={20}
                    />
                </View>
                
                <TouchableOpacity style={styles.btn} onPress={handleSaveAlias}>
                    <Text style={styles.btnText}>SAVE_IDENTITY</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.panel, styles.panelSecondary]}>
                <Text style={styles.panelTitle}>[ SECURITY_PROTOCOL ]</Text>
                <Text style={styles.description}>
                    <Text style={{color: theme.colors.accent, fontWeight: 'bold'}}>1. End-to-End Encrypted:</Text> AES-GCM 256-bit keys are never sent to the server. Your messages remain scrambled in transit.
                </Text>
                <Text style={styles.description}>
                    <Text style={{color: theme.colors.accent, fontWeight: 'bold'}}>2. Zero Logging:</Text> The signaling server holds messages only in RAM long enough to broadcast them to clients.
                </Text>
                <Text style={styles.description}>
                    <Text style={{color: theme.colors.accent, fontWeight: 'bold'}}>3. Ephemeral Nodes:</Text> When you nuke a room, all socket connections drop and the room ceases to exist.
                </Text>
            </View>

            {/* Spacer for floating pill tab bar */}
            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.bgPrimary,
    },
    scrollContent: {
        flexGrow: 1,
        padding: theme.spacing.lg,
        paddingTop: theme.spacing.xl * 2, // Space for status bar
    },
    headerTitle: {
        color: theme.colors.accentGlow,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: theme.spacing.xl,
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
    description: {
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 12,
        lineHeight: 18,
        marginBottom: theme.spacing.sm,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    prompt: {
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamilyMono,
        marginRight: theme.spacing.sm,
    },
    input: {
        flex: 1,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        color: theme.colors.accent,
        fontFamily: theme.typography.fontFamilyMono,
        paddingVertical: 8,
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
