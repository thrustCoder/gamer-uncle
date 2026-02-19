# Gamer Uncle — Feature Catalog

## Executive Summary

Gamer Uncle is a board-game companion app powered by Azure AI. It combines an AI chat assistant with a suite of table-top utility tools so players can get answers, resolve disputes, and manage game nights — all from a single mobile app.

### Feature Overview

| # | Feature | Description | Key Capabilities | Powered By |
|---|---------|-------------|------------------|------------|
| 1 | **Talk to Uncle (AI Chat)** | Conversational AI assistant for board-game questions | Multi-turn conversation with memory; Markdown-formatted responses; context hand-off from Game Setup and Game Search screens | Azure AI Agent Service, OpenAI GPT |
| 2 | **Voice Chat** | Hands-free voice interaction with the AI assistant | Tap-to-record / tap-to-stop; on-device speech recognition; server-side audio processing; text-to-speech (TTS) playback with pause/resume; silence detection auto-stop (10 s); max recording limit (60 s) | Azure OpenAI, expo-av, @react-native-voice |
| 3 | **Game Search** | Browse and explore the BoardGameGeek catalog | Type-ahead search (debounced, 3+ chars); detailed game view with ratings, player count, playtime, mechanics, categories, and age requirement; direct link to official rules; "Ask Uncle" deep-link to AI chat with game context | Cosmos DB (BGG sync), REST API |
| 4 | **Game Setup** | AI-generated setup instructions for any board game | Enter game name + player count; step-by-step setup guide; "Need more help?" flows into AI Chat with pre-filled context | Azure AI Agent Service |
| 5 | **Score Tracker** | Track scores across rounds and maintain a leaderboard | Per-round score entry with +/− buttons and direct input; cumulative game score view; cross-game leaderboard; player rename propagation; game selection via search modal; persistent storage (AsyncStorage) | Local / AsyncStorage |
| 6 | **Turn Selector** | Randomly pick whose turn it is | Animated spinning wheel with sound effects; configurable player names (2–20); celebration animation on result; cached player names shared across tools | Local / expo-av |
| 7 | **Team Randomizer** | Randomly divide players into balanced teams | Configurable player count (2–20) and team count; random shuffle with fanfare sound; celebration animation; names synced with other tools via shared cache | Local / expo-av |
| 8 | **Dice Roller** | Virtual dice with realistic physics animation | 1 or 2 dice toggle; animated roll with shake, bounce, and rotation; sound effects; dice count persisted across sessions | Local / react-native-reanimated, expo-av |
| 9 | **Timer** | Countdown timer for timed turns or activities | Additive preset buttons (10 s, 30 s, 1 m, 5 m); circular SVG progress ring; start / pause / resume / reset controls; pulse animation on completion; timer persists when navigating away (global context) | Local / TimerContext |

### Internal / Infrastructure Features

| # | Feature | Description | Key Capabilities | Powered By |
|---|---------|-------------|------------------|------------|
| 10 | **Telemetry & Analytics** | In-app event tracking for usage insights | Session & device ID tracking; screen views, feature taps, chat events, search queries, voice events, and errors; batched queue flush every 30 s | REST API (custom endpoint) |
| 11 | **Rating Prompt** | Contextual prompt encouraging App Store reviews | Per-feature engagement counters with configurable thresholds; 7-day cooldown after dismissal; native store review integration (expo-store-review); banner + modal UX in Chat, modal UX in other tools | expo-store-review, AsyncStorage |
| 12 | **Force Upgrade** | Ensures users run a supported app version | Server-driven version policy (min version, latest version, upgrade URL); blocking modal for mandatory upgrades; dismissible modal for optional upgrades | REST API (/api/AppConfig) |
| 13 | **Shared Player State** | Unified player configuration across tools | Player names, player count, team count, and dice count cached locally; changes in one tool automatically reflect in others on next visit | AsyncStorage (appCache) |
| 14 | **Tablet / iPad Support** | Responsive layout for larger screens | Automatic tablet detection (≥ 768 px); 3× icon scaling and 1.5× label scaling on Landing screen; adjusted wheel marker sizing in Turn Selector | Dimensions API |

### Platform Support

| Platform | Status |
|----------|--------|
| iOS (iPhone) | Supported — Expo dev-client + EAS builds |
| iOS (iPad) | Supported — adaptive layout |
| Android | Not yet supported |
| Web | Not yet supported |
