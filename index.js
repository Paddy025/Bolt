import { DisconnectReason } from "@itsliaaa/baileys";
import { Boom } from "@hapi/boom";
import chalk from "chalk";
import { createPairSocket } from "./pair.js";
import { loadPlugins, handleMessages } from "./commands.js";

async function startBolt() {
  console.log(chalk.bold.blue("\n⚡ STARTING BOLT BOT ⚡\n"));

  // 1. Load command plugins
  await loadPlugins("./plugins");

  // 2. Initialize socket and pairing logic
  const { sock } = await createPairSocket("./session");

  // 3. Connection lifecycle monitoring
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        chalk.red(`[BOLT] Connection closed. Reason code: ${statusCode}. Reconnecting: ${shouldReconnect}`)
      );

      if (shouldReconnect) {
        startBolt(); // Restart bot
      } else {
        console.log(chalk.red("[BOLT] Device logged out. Delete 'session' folder and restart."));
      }
    } else if (connection === "open") {
      console.log(chalk.bold.green("\n⚡ [BOLT] Connected successfully to WhatsApp! ⚡\n"));
    }
  });

  // 4. Hook messages upsert to command router
  sock.ev.on("messages.upsert", async (m) => {
    await handleMessages(sock, m);
  });
}

// Global process error safety guards
process.on("unhandledRejection", (err) => {
  console.error(chalk.red("[UNHANDLED REJECTION]"), err);
});
process.on("uncaughtException", (err) => {
  console.error(chalk.red("[UNCAUGHT EXCEPTION]"), err);
});

// Launch Bolt
startBolt();