const express = require("express");
const router = express.Router();
const { 
    default: makeWASocket, 
    fetchLatestBaileysVersion, 
    useMultiFileAuthState 
} = require("@adiwajshing/baileys");
const fs = require("fs");
require("dotenv").config();

async function startPair() {
    const { version } = await fetchLatestBaileysVersion();

    // Session folder auto-create
    if (!fs.existsSync("./session")) fs.mkdirSync("./session");
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ["Replit", "Desktop", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;

        if (connection === "open") {
            console.log("✅ WhatsApp connected!");

            // Read all session files
            const sessionFiles = fs.readdirSync("./session");
            let sessionData = {};
            sessionFiles.forEach((file) => {
                const content = fs.readFileSync(`./session/${file}`, "utf8");
                sessionData[file] = content;
            });

            // Convert to Base64 session ID
            const sessionID = Buffer.from(JSON.stringify(sessionData)).toString("base64");

            // Save session ID to .env
            let envData = fs.readFileSync(".env", "utf8");
            if (/SESSION_ID=.*/.test(envData)) {
                envData = envData.replace(/SESSION_ID=.*/, `SESSION_ID=${sessionID}`);
            } else {
                envData += `\nSESSION_ID=${sessionID}`;
            }
            fs.writeFileSync(".env", envData);
            console.log("📌 SESSION_ID updated inside .env");

            // Send session ID to OWNER_NUMBER
            const owner = process.env.OWNER_NUMBER;
            if (owner) {
                await sock.sendMessage(`${owner}@s.whatsapp.net`, {
                    text: `🔐 Your session ID:\n${sessionID}`
                });
                console.log("📨 Session ID sent to OWNER_NUMBER WhatsApp!");
            } else {
                console.log("⚠️ OWNER_NUMBER missing in .env");
            }
        }
    });
}

// Express route
router.get("/", (req, res) => {
    res.send("PAIR system working… scan QR in console.");
    startPair(); // start pairing on route access
});

module.exports = router;
