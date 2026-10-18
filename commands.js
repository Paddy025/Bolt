import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import chalk from 'chalk';

export const commands = new Map();

/**
 * Dynamically loads all .js files inside ./plugins
 */
export async function loadCommands(pluginDir = './plugins') {
  commands.clear();
  const dirPath = path.resolve(pluginDir);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const files = fs.readdirSync(dirPath).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      // Bust module cache with timestamp query
      const moduleUrl = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const plugin = await import(moduleUrl);

      if (plugin.default && plugin.default.name && typeof plugin.default.execute === 'function') {
        commands.set(plugin.default.name.toLowerCase(), plugin.default);

        // Add aliases if present
        if (Array.isArray(plugin.default.aliases)) {
          plugin.default.aliases.forEach((alias) => {
            commands.set(alias.toLowerCase(), plugin.default);
          });
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error loading plugin ${file}:`), err);
    }
  }

  console.log(chalk.blue(`[BOLT] Loaded ${commands.size} commands/aliases.`));
}

/**
 * Handles incoming messages and executes matching plugin
 */
export async function handleMessages(sock, m) {
  try {
    const msg = m.messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    const prefix = '.';
    if (!body.startsWith(prefix)) return;

    const args = body.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = commands.get(commandName);
    if (command) {
      await command.execute({ sock, msg, jid, args, body });
    }
  } catch (error) {
    console.error(chalk.red('[BOLT] Command execution error:'), error);
  }
}