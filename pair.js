import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@itsliaaa/baileys';
import pino from 'pino';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import chalk from 'chalk';

async function startPairing() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  });

  // Check if session is already paired
  if (!sock.authState.creds.registered) {
    const rl = readline.createInterface({ input, output });

    console.log(chalk.yellow('\n⚡ BOLT PAIRING SETUP ⚡'));
    const rawNumber = await rl.question(
      chalk.cyan('Enter your WhatsApp phone number with country code (e.g. 2348012345678): ')
    );
    rl.close();

    const phoneNumber = rawNumber.replace(/[^0-9]/g, '');

    if (!phoneNumber) {
      console.log(chalk.red('Invalid phone number provided. Exiting...'));
      process.exit(1);
    }

    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(chalk.green(`\nYour Bolt Pairing Code: `) + chalk.bgGreen.black.bold(` ${code} `));
        console.log(chalk.gray('Enter this code in WhatsApp > Linked Devices > Link with phone number\n'));
      } catch (err) {
        console.error(chalk.red('Failed to request pairing code:'), err);
      }
    }, 3000);
  } else {
    console.log(chalk.green('Already paired! Run `npm start` to run Bolt.'));
    process.exit(0);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log(chalk.green('\n⚡ Bolt paired successfully! Session saved in ./session.'));
      console.log(chalk.cyan('You can now stop this script and start the bot with: npm start\n'));
      process.exit(0);
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        startPairing();
      } else {
        console.log(chalk.red('Session logged out. Delete ./session and pair again.'));
        process.exit(1);
      }
    }
  });
}

startPairing();