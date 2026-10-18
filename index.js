import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@itsliaaa/baileys';
import pino from 'pino';
import chalk from 'chalk';
import fs from 'fs';
import { loadCommands, handleMessages } from './commands.js';

async function startBolt() {
  if (!fs.existsSync('./session/creds.json')) {
    console.log(chalk.red('No session found! Please pair first by running:'));
    console.log(chalk.yellow('npm run pair'));
    process.exit(1);
  }

  console.log(chalk.yellow('⚡ Starting Bolt WhatsApp Bot...'));

  // 1. Load command plugins
  await loadCommands('./plugins');

  // 2. Initialize connection
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Bolt Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  // 3. Connection lifecycle
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(chalk.yellow(`Connection closed. Reason: ${reason}`));

      if (reason !== DisconnectReason.loggedOut) {
        console.log(chalk.cyan('Reconnecting Bolt...'));
        startBolt();
      } else {
        console.log(chalk.red('Session logged out. Run `npm run pair` again.'));
        process.exit(1);
      }
    } else if (connection === 'open') {
      console.log(chalk.green('⚡ Bolt is online and connected!'));
    }
  });

  // 4. Route incoming messages
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    await handleMessages(sock, chatUpdate);
  });
}

startBolt();