// pair.js
const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
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

// Replit Secret වෙතින් OWNER_NUMBER එක ලබා ගනියි
const OWNER_NUMBER = process.env.OWNER_NUMBER || '';

// OWNER_NUMBER එක ජාත්‍යන්තර ආකෘතියේ JID බවට පත් කරයි (උදා: 9477xxxxxxx@s.whatsapp.net)
const ownerJid = OWNER_NUMBER ? jidNormalizedUser(OWNER_NUMBER + '@s.whatsapp.net') : null;

// Owner Number එක තහවුරු කරයි
if (!ownerJid) {
    console.error("⚠️ OWNER_NUMBER is not configured in Replit Secrets. Session ID cannot be sent via WhatsApp.");
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    // Client ගෙන් query එකෙන් එන number එක ගන්නවා
    let num = req.query.number; 

    async function DanuwaPair() {
        const auth_path = './session/';
        // Session එක ./session/ path එකේ multi-file ක්‍රමයට save කරයි
        const { state, saveCreds } = await useMultiFileAuthState(auth_path); 

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
                
                // Pairing Code එක request කරයි
                const code = await DanuwaPairWeb.requestPairingCode(num);
                
                // Code එක client වෙත යවයි
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            DanuwaPairWeb.ev.on('creds.update', saveCreds);

            // Connection update events
            DanuwaPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    console.log("✅ Device Successfully Paired! Starting MEGA Upload...");
                    try {
                        await delay(5000); // Creds fully save වෙන්න පොඩි delay එකක් දමමු.

                        // creds.json ගොනුව MEGA වෙත යැවීම
                        const fileName = `session_${DanuwaPairWeb.user.id.split(':')[0]}_${Date.now()}.json`;
                        const mega_url = await upload(fs.createReadStream(auth_path + 'creds.json'), fileName);

                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        const sid = string_session;

                        console.log(`✅ Session ID generated and uploaded to MEGA: ${sid}`);

                        // Session ID එක OWNER_NUMBER එකට යැවීම
                        if (ownerJid) {
                            await DanuwaPairWeb.sendMessage(ownerJid, {
                                text: `⭐ Session ID එක සාර්ථකව Generate විය. මෙය ඔබගේ String Session එකයි:\n\n*${sid}*\n\nMEGA Link: ${mega_url}`
                            });
                            console.log(`✅ Session ID sent to Owner Number: ${OWNER_NUMBER}`);
                        } else {
                            console.log("⚠️ OWNER_NUMBER configured නැති නිසා Session ID එක WhatsApp හරහා යැවිය නොහැක. Console එකෙන් ලබා ගන්න.");
                        }

                    } catch (e) {
                        console.error("❌ MEGA upload or Message send failed:", e.message);
                        // ඔබට මෙහිදි 'pm2 restart' එකක් අවශ්‍ය නම්, එය අවශ්‍ය පරිදි තබා ගන්න.
                        // exec('pm2 restart danuwa'); 
                    } finally {
                        // Temp files සහ session එක delete කර process එක නවතයි
                        await delay(100);
                        await removeFile(auth_path); 
                        DanuwaPairWeb.end(); // Connection එක වසයි
                        // process.exit(0); // අවශ්‍ය නම් process එක නවතන්න
                    }

                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    // 401 (Logged Out) නොවන error එකකදී නැවත සම්බන්ධ වීමට උත්සාහ කරයි
                    await delay(10000);
                    DanuwaPair();
                } else if (connection === "close" && lastDisconnect.error.output.statusCode === 401) {
                    // Logged Out නම් temp session එක delete කරයි
                    console.log("❌ Logged out. Removing session files.");
                    removeFile(auth_path); 
                }
            });
        } catch (err) {
            console.error("❌ Pairing process failed:", err.message);
            // exec('pm2 restart danuwa-md'); // අවශ්‍ය නම් pm2 restart
            // console.log("service restarted");
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
    // exec('pm2 restart danuwa'); // අවශ්‍ය නම් pm2 restart
});


module.exports = router;
