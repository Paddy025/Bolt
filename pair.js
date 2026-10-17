import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } from '@itsliaaa/baileys';
import pino from 'pino';
import readline from 'readline';
import chalk from 'chalk';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

/**
 * Initializes and handles the pairing process
 * @param {string} sessionFolder - Directory where credentials will be stored
 * @returns {Promise<{ sock: any, state: any, saveCreds: Function }>}
 */
export async function createPairingSocket(sessionFolder = './session') {
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(chalk.cyan(`[Bolt] Using WA v${version.join('.')}, isLatest: ${isLatest}`));

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  });

  // Pairing code request (runs if session is not yet registered)
  if (!sock.authState.creds.registered) {
    let phoneNumber = await question(
      chalk.yellow('\n[Bolt] Enter your WhatsApp phone number with country code (e.g. 2348012345678): ')
    );

    // Sanitize phone number (strip +, spaces, hyphens)
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    try {
      setTimeout(async () => {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(chalk.green(`\n⚡ Your Bolt Pairing Code: `) + chalk.bgGreen.black.bold(` ${code} \n`));
        console.log(chalk.gray('Enter this code in WhatsApp > Linked Devices > Link with phone number\n'));
      }, 3000);
    } catch (err) {
      console.error(chalk.red('[Bolt] Failed to generate pairing code:'), err);
    }
  }

  return { sock, state, saveCreds };
}