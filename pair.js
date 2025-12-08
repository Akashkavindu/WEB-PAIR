const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const { upload } = require('./mega'); // ඔබේ local dependency

// ----------------------------------------------------
// Baileys සඳහා විචල්‍යයන් හිස්ව තබා ගන්න
// ----------------------------------------------------
let makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser;

// ----------------------------------------------------
// ✅ Baileys ESM මොඩියුලය CJS පරිසරයකට Load කරන async ශ්‍රිතය
// ----------------------------------------------------
async function loadBaileys() {
    // ESM-only මොඩියුලයක් dynamic import() හරහා පටවයි
    const baileysModule = await import("@whiskeysockets/baileys");
    
    // අවශ්‍ය සියලුම exports විචල්‍යයන්ට assign කරයි
    makeWASocket = baileysModule.default;
    useMultiFileAuthState = baileysModule.useMultiFileAuthState;
    delay = baileysModule.delay;
    makeCacheableSignalKeyStore = baileysModule.makeCacheableSignalKeyStore;
    Browsers = baileysModule.Browsers;
    jidNormalizedUser = baileysModule.jidNormalizedUser;
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    
    // Baileys Load කර නොමැති නම්, එය මුලින්ම Load කරන්න
    if (!makeWASocket) {
        await loadBaileys();
    }
    
    async function DanuwaPair() {
        // Baileys functions දැන් භාවිත කළ හැක
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let DanuwaPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!DanuwaPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await DanuwaPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            DanuwaPairWeb.ev.on('creds.update', saveCreds);
            DanuwaPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionDanuwa = fs.readFileSync('./session/creds.json');

                        const auth_path = './session/';
                        const user_jid = jidNormalizedUser(DanuwaPairWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                            result += characters.charAt(Math.floor(Math.random() * characters.length));
                                }
                                const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                                return `${result}${number}`;
                                }

                                const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), `${randomMegaId()}.json`);

                                const string_session = mega_url.replace('https://mega.nz/file/', '');

                                const sid = string_session;

                                const dt = await DanuwaPairWeb.sendMessage(user_jid, {
                                    text: sid
                                });

                            } catch (e) {
                                exec('pm2 restart danuwa');
                            }

                            await delay(100);
                            return await removeFile('./session');
                            process.exit(0);
                        } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                            await delay(10000);
                            DanuwaPair();
                        }
                    });
                } catch (err) {
                    exec('pm2 restart danuwa-md');
                    console.log("service restarted");
                    DanuwaPair();
                    await removeFile('./session');
                    if (!res.headersSent) {
                        await res.send({ code: "Service Unavailable" });
                    }
                }
            }
            return await DanuwaPair();
        });

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart danuwa');
});


module.exports = router;
