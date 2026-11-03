import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const commands = new Map();

export async function loadCommands() {
    const pluginsDir = path.resolve('plugins');
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
    }

    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    for (const file of files) {
        const filePath = path.join(pluginsDir, file);
        try {
            const fileUrl = pathToFileURL(filePath).href;
            const commandModule = await import(fileUrl);
            if (commandModule.name && typeof commandModule.execute === 'function') {
                commands.set(commandModule.name, commandModule);
                console.log(`Loaded plugin command: ${commandModule.name}`);
            }
        } catch (err) {
            console.error(`Failed to load plugin ${file}:`, err);
        }
    }
    return commands;
}

export async function handleCommand(sock, mek) {
    const messageContent = mek.message?.conversation || 
                           mek.message?.extendedTextMessage?.text || '';
    const prefix = '.';
    
    if (!messageContent.startsWith(prefix)) return;

    const args = messageContent.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (command) {
        try {
            await command.execute(sock, mek, args);
        } catch (err) {
            console.error(`Error executing command ${commandName}:`, err);
        }
    }
}
