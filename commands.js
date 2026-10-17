import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const commands = new Map();
export const prefix = "."; // Default prefix for Bolt

/**
 * Dynamically loads all command modules inside the plugins directory.
 * @param {string} pluginsDir - Directory containing plugins.
 */
export async function loadPlugins(pluginsDir = "./plugins") {
  const resolvedPath = path.resolve(__dirname, pluginsDir);

  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }

  const files = fs.readdirSync(resolvedPath).filter((f) => f.endsWith(".js"));
  commands.clear();

  for (const file of files) {
    const filePath = path.join(resolvedPath, file);
    try {
      // Use pathToFileURL to maintain valid ESM import paths across platforms
      const module = await import(`${pathToFileURL(filePath).href}?update=${Date.now()}`);
      const plugin = module.default || module;

      if (plugin?.name && typeof plugin?.execute === "function") {
        commands.set(plugin.name.toLowerCase(), plugin);

        if (Array.isArray(plugin.aliases)) {
          plugin.aliases.forEach((alias) => commands.set(alias.toLowerCase(), plugin));
        }

        console.log(chalk.green(`[PLUGIN LOADED] » ${plugin.name}`));
      } else {
        console.log(chalk.red(`[SKIPPED] » ${file} (missing 'name' or 'execute' function)`));
      }
    } catch (err) {
      console.error(chalk.red(`[ERROR LOADING] » ${file}:`), err);
    }
  }

  console.log(chalk.cyan(`[BOLT] Total commands loaded: ${commands.size}`));
}

/**
 * Message handler that inspects messages and routes matching commands.
 */
export async function handleMessages(sock, m) {
  const message = m.messages[0];
  if (!message || !message.message || message.key.fromMe) return;

  // Extract text body from various message wrappers
  const body =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    "";

  if (!body.startsWith(prefix)) return;

  const args = body.slice(prefix.length).trim().split(/ +/);
  const cmdName = args.shift().toLowerCase();

  const command = commands.get(cmdName);
  if (!command) return;

  const jid = message.key.remoteJid;

  try {
    await command.execute({ sock, message, args, body, prefix });
  } catch (error) {
    console.error(chalk.red(`[EXECUTION ERROR] » ${cmdName}:`), error);
    await sock.sendMessage(jid, {
      text: `❌ Error executing command *${cmdName}*: ${error.message}`,
    }, { quoted: message });
  }
}