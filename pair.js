import { makeWASocket, useMultiFileAuthState, delay } from "@itsliaaa/baileys";
import pino from "pino";
import readline from "readline";
import chalk from "chalk";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

export default async function startPair() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" })
    });

    if (!sock.authState.creds.registered) {
        let phoneNumber = await question(chalk.yellow("Enter your WhatsApp phone number (e.g., 2348123456789): "));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
        
        await delay(3000);
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        
        console.log(chalk.green("\n--- PAIRING CODE ---"));
        console.log(chalk.bold.white(code));
        console.log(chalk.green("--------------------\n"));
    }

    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log(chalk.green("Bolt paired and connected successfully!"));
        } else if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) {
                startPair();
            }
        }
    });
}
