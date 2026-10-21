# VirtualDeck AI Coding Agent Instructions

This document provides guidance for AI coding agents working on the VirtualDeck codebase.

## Project Overview

VirtualDeck is an Electron-based application that provides a user-configurable grid of buttons. These buttons can trigger actions such as playing local audio files, launching external applications, or responding to Twitch events.

## Architecture

The application follows a standard Electron architecture with a main process and a renderer process.

-   **Main Process (`main.js`):** This is the core of the application. It manages the application lifecycle, handles all interactions with the operating system (file system, global hotkeys), and manages connections to external services like Twitch. It is the single source of truth for application state and configuration.

-   **Renderer Process (`public/`):** This is the user interface, built with HTML, CSS, and JavaScript (`public/script.js`). It is responsible for displaying the button grid and the configuration modals. It communicates with the main process to perform actions and retrieve data.

-   **Preload Script (`preload.js`):** This script acts as a secure bridge between the main and renderer processes. It uses Electron's `contextBridge` to expose specific IPC channels, preventing the renderer from having direct access to Node.js APIs. All communication between the renderer and main process *must* go through the functions exposed in `preload.js`.

## Communication Patterns

Communication between the renderer and main processes is exclusively handled via Electron's Inter-Process Communication (IPC).

-   **Renderer to Main:** The renderer sends messages to the main process to request actions. For example, when a user saves a new button, `public/script.js` calls an IPC function (exposed via `preload.js`) like `window.electron.addMedia(data)`.

-   **Main to Renderer:** The main process sends messages to the renderer to update the UI. For example, after a button is deleted, `main.js` sends a `refresh-ui` message to the renderer. Similarly, when a Twitch event occurs, `main.js` forwards the event data to the renderer via channels like `twitch-chat-event` or `twitch-eventsub`.

## Configuration and Data Management

-   **Configuration File (`config.json`):** The button grid configuration is stored in `config.json` located in the Electron `userData` path. This is managed by the `ensureUserData` function in `main.js`. Do not attempt to read this file directly from the renderer. Instead, use the `get-config` IPC handle.

-   **User Media:** Audio files are copied into a `sounds` directory within the `userData` path to ensure they are self-contained. Application paths are stored directly.

## Twitch Integration

-   **Connection Flow:** The user enters their Twitch credentials (username, OAuth token, Client ID) in the UI (`TwitchConnected/tc.js`). These credentials are then sent to the main process via the `twitch-connect` IPC channel.

-   **Main Process Responsibility:** The main process is solely responsible for establishing and maintaining connections to Twitch services (`tmi.js` for chat, `ws` for EventSub). It handles all API requests and WebSocket communication.

-   **Event Handling:** All incoming Twitch events (chat messages, follows, subscriptions, etc.) are received in `main.js` and then forwarded to the renderer process via dedicated IPC channels (`twitch-chat-event`, `twitch-eventsub`). This allows the UI to react to events and will be the basis for triggering button actions.

## Key Developer Workflows

-   **Running the App:** The application is a standard Electron app. The entry point is `main.js`.
-   **Debugging:** The developer tools can be opened with the `F12` key. This is useful for inspecting both the renderer process and the console output from the main process.
-   **Adding Features:**
    1.  **UI:** If new UI is needed, modify the HTML/JS files in the `public/` directory.
    2.  **IPC:** Define a new communication channel in `preload.js`.
    3.  **Backend Logic:** Implement the corresponding handler for the new IPC channel in `main.js`.
