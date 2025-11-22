const express = require("express");
const router = express.Router();
const { 
    default: makeWASocket, 
    fetchLatestBaileysVersion, 
    useMultiFileAuthState,
    delay
} = require("@adiwajshing/baileys");
const fs = require("fs");
require("dotenv").config();
const readline = require("readline");

// Read console input (for phone-link code)
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

async function startPair() {
    const { version } = await fetchLatestBaileysVersion();

    if (!fs.existsSync("./session")) fs.mkdirSync("./session");
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, receivedPendingNotifications } = update;

        if (update.connection === "close" && lastDisconnect?.error?.output?.statusCode === 431) {
            console.log("⚠️ Phone-link code required");

            const code = await askQuestion("Enter code from your phone: ");
            await sock.loginWithCode(code); // Baileys v6 function, pseudo code
            console.log("✅ Code entered, reconnecting...");
        }

        if (connection === "open") {
            console.log("✅ WhatsApp connected!");

            const sessionFiles = fs.readdirSync("./session");
            let sessionData = {};
            sessionFiles.forEach(file => {
                const content = fs.readFileSync(`./session/${file}`, "utf8");
                sessionData[file] = content;
            });

            const sessionID = Buffer.from(JSON.stringify(sessionData)).toString("base64");

            // Save to .env
            let envData = fs.readFileSync(".env", "utf8");
            if (/SESSION_ID=.*/.test(envData)) {
                envData = envData.replace(/SESSION_ID=.*/, `SESSION_ID=${sessionID}`);
            } else {
                envData += `\nSESSION_ID=${sessionID}`;
            }
            fs.writeFileSync(".env", envData);
            console.log("📌 SESSION_ID updated in .env");

            // Send to OWNER_NUMBER
            const owner = process.env.OWNER_NUMBER;
            if (owner) {
                await sock.sendMessage(`${owner}@s.whatsapp.net`, {
                    text: `🔐 Your session ID:\n${sessionID}`
                });
                console.log("📨 Session ID sent to OWNER_NUMBER!");
            }
        }
    });
}

// Express route
router.get("/", (req, res) => {
    res.send("PAIR system working… enter phone code in console if prompted.");
    startPair();
});

module.exports = router;
