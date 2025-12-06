const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

const { upload } = require('./mega');


// 🧹 Delete folder
function removeFile(path) {
    if (fs.existsSync(path)) {
        fs.rmSync(path, { recursive: true, force: true });
    }
}


// 🔑 Random ID for Mega File
function randomMegaId(length = 6, numberLength = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let txt = '';
    for (let i = 0; i < length; i++) txt += chars[Math.floor(Math.random() * chars.length)];
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${txt}${number}`;
}



// ===================== MAIN ROUTE =====================

router.get('/', async (req, res) => {

    // USER ENTER කරන number එක
    let num = req.query.number;

    if (!num) {
        return res.send({ error: "❗ Missing number. Use: ?number=947xxxxxxxx" });
    }


    async function StartPairing() {

        const auth_path = './session/';
        const { state, saveCreds } = await useMultiFileAuthState(auth_path);

        try {

            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
                },
                printQRInTerminal: false,
                browser: Browsers.macOS("Safari"),
                logger: pino({ level: "fatal" })
            });


            // ------------------ PAIR CODE -------------------
            if (!sock.authState.creds.registered) {

                await delay(1500);

                num = num.replace(/[^0-9]/g, '');

                const code = await sock.requestPairingCode(num);

                if (!res.headersSent) {
                    return res.send({ code });
                }
            }


            // Save creds
            sock.ev.on("creds.update", saveCreds);


            // ------------------ CONNECTION HANDLER -------------------
            sock.ev.on("connection.update", async (update) => {

                const { connection, lastDisconnect } = update;

                if (connection === "open") {

                    console.log("\n====================================");
                    console.log("  ✅ Device Paired Successfully!");
                    console.log("====================================\n");

                    try {

                        await delay(4000); // ensure file writing

                        const fileName = `${randomMegaId()}.json`;
                        const filePath = auth_path + "creds.json";

                        const megaUrl = await upload(fs.createReadStream(filePath), fileName);

                        const sid = megaUrl.replace("https://mega.nz/file/", "");

                        console.log("🔥 SESSION ID:", sid);
                        console.log("📁 MEGA LINK:", megaUrl);
                        console.log("====================================\n");

                    } catch (err) {
                        console.error("❌ MEGA Upload Error:", err);
                    }
                }


                // retry logic
                if (connection === "close") {

                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode !== 401) {
                        console.log("♻️ Reconnecting in 10 seconds...");
                        await delay(10000);
                        return StartPairing();
                    } else {
                        console.log("❌ Logged Out - Clearing Old Session");
                        removeFile(auth_path);
                    }
                }

            });


        } catch (err) {
            console.log("❌ Pairing Error:", err.message);
            removeFile('./session');

            if (!res.headersSent) {
                return res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await StartPairing();
});



process.on("uncaughtException", (err) => {
    console.log("Unhandled Error:", err);
});

module.exports = router;
