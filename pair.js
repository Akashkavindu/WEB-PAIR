const pino = require("pino");
const { Browsers } = require("@adiwajshing/baileys");
const express = require("express");
const router = express.Router();
const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    generateRegistrationCode,
    Browsers
} = require("@adiwajshing/baileys");

const fs = require("fs");
require("dotenv").config();
const pino = require("pino");

// GET /code?number=947XXXXXXXX → return pairing code to frontend
router.get("/", async (req, res) => {
    const phone = req.query.number;
    if (!phone) return res.json({ error: "Phone number missing" });

    try {
        const code = await generateCode(phone);
        res.json({ code });
    } catch (err) {
        console.log(err);
        res.json({ code: "ERROR" });
    }
});

async function generateCode(phone) {
    const { version } = await fetchLatestBaileysVersion();

    if (!fs.existsSync("./session")) fs.mkdirSync("./session");
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.macOS("Safari"),
        logger: pino({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);

    // Generate WhatsApp Pairing Code
    const code = await sock.requestPairingCode(phone);

    // connection success event
    sock.ev.on("connection.update", async (update) => {
        if (update.connection === "open") {
            console.log("📌 WhatsApp connected!");

            // read session folder
            const sessionFiles = fs.readdirSync("./session");
            let sessionData = {};
            sessionFiles.forEach(file => {
                sessionData[file] = fs.readFileSync(`./session/${file}`, "utf8");
            });

            const sessionID = Buffer.from(JSON.stringify(sessionData)).toString("base64");

            // update .env
            let envData = fs.readFileSync(".env", "utf8");
            envData = envData.replace(/SESSION_ID=.*/, `SESSION_ID=${sessionID}`);
            fs.writeFileSync(".env", envData);
            console.log("✔ SESSION_ID stored in .env");

            // send session ID to OWNER_NUMBER
            const owner = process.env.OWNER_NUMBER;
            if (owner) {
                await sock.sendMessage(`${owner}@s.whatsapp.net`, {
                    text: `🔐 *Your WhatsApp SESSION ID:*\n\n${sessionID}`
                });
                console.log("📨 SESSION_ID sent to OWNER_NUMBER");
            }
        }
    });

    return code;
}

module.exports = router;
