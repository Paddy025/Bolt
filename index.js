import startPair from './pair.js';
import { loadCommands, handleCommand } from './commands.js';
import { makeWASocket, useMultiFileAuthState } from "@itsliaaa/baileys";
import pino from "pino";
import chalk from "chalk";
import fs from 'fs';

async function startBolt() {
    console.log(chalk.cyan("Starting Bolt WhatsApp Bot..."));
    
    // Load plugin commands first
    await loadCommands();

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    
    // If session doesn't exist, trigger pairing flow
    if (!fs.existsSync('./session/creds.json') || !state.creds.registered) {
        await startPair();
        return;
    }

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green("Bolt is online and listening for messages!"));
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                console.log(chalk.yellow("Reconnecting Bolt..."));
                startBolt();
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const mek = messages[0];
        if (!mek.message || mek.key.fromMe) return;
        await handleCommand(sock, mek);
    });
}

startBolt();
