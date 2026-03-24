import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableWithoutFeedback, StatusBar } from 'react-native';
import { theme } from '../styles/theme';

const FAKE_LOGS = [
    "[ OK ] Reached target Network.",
    "[ OK ] Kernel modules loaded successfully.",
    "Starting OpenBSD Secure Shell server...",
    "[ OK ] Started OpenBSD Secure Shell server.",
    "Starting Permit User Sessions...",
    "[ OK ] Started Permit User Sessions.",
    "pinging 8.8.8.8 with 32 bytes of data:",
    "Reply from 8.8.8.8: bytes=32 time=14ms TTL=117",
    "Reply from 8.8.8.8: bytes=32 time=12ms TTL=117",
    "Reply from 8.8.8.8: bytes=32 time=13ms TTL=117",
    "net.ipv4.ip_forward = 1",
    "net.ipv6.conf.all.forwarding = 1",
    "[ OK ] Established connection to primary node [192.168.1.104].",
    "Handshake complete. Tunnel encrypted.",
    "Fetching registry data from upstream...",
    "GET https://registry.npmjs.org/react-native/0.74 200 OK - 42ms",
    "GET https://registry.npmjs.org/expo/51.0.0 200 OK - 31ms",
    "[WARN] Dependency tree requires audit.",
    "Compiling native binaries...",
    "Building target: x86_64-linux-gnu",
    "Linking dependencies...",
    "[ OK ] Build finished in 4.2s"
];

const generateRandomLog = () => {
    // Return a random log line, or slightly mutate one for variety
    const base = FAKE_LOGS[Math.floor(Math.random() * FAKE_LOGS.length)];
    if (base.includes("Reply from")) {
        const time = Math.floor(Math.random() * 20) + 10;
        return `Reply from 8.8.8.8: bytes=32 time=${time}ms TTL=117`;
    }
    return base;
};

export default function BossModeTerminal({ onExit }: { onExit: () => void }) {
    const [logs, setLogs] = useState<string[]>([]);
    const flatListRef = useRef<FlatList>(null);
    const lastTap = useRef(0);

    useEffect(() => {
        // Initial flood of logs to make it look like it's been running
        const initialLogs = [];
        for (let i = 0; i < 30; i++) {
            initialLogs.push(generateRandomLog());
        }
        setLogs(initialLogs);

        const interval = setInterval(() => {
            setLogs((prev) => {
                const newLogs = [...prev, generateRandomLog()];
                // Keep only last 50 lines to prevent memory issues
                if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
                return newLogs;
            });
        }, Math.random() * 500 + 100);

        return () => clearInterval(interval);
    }, []);

    const handleTap = () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap mapped!
            onExit();
        }
        lastTap.current = now;
    };

    return (
        <TouchableWithoutFeedback onPress={handleTap}>
            <View style={styles.container}>
                <StatusBar hidden={true} />
                <FlatList
                    ref={flatListRef}
                    data={logs}
                    keyExtractor={(_, index) => index.toString()}
                    renderItem={({ item }) => <Text style={styles.logText}>{item}</Text>}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                />
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        zIndex: 9999,
        elevation: 9999,
        padding: 8,
        paddingTop: 40, // For notch and general breathing room
    },
    logText: {
        color: '#008f11', // Dim green suitable for old CRT terminals
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: 10,
        marginBottom: 2,
    }
});
