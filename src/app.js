import { CONFIG } from "./config.js";
import { readState } from "./stateStore.js";
import { scanAndNotify } from "./scanner.js";

async function main() {
    if (!CONFIG.slackToken || !CONFIG.slackUserId) {
        console.error("Missing SLACK_BOT_TOKEN or SLACK_USER_ID in environment");
        process.exit(1);
    }

    const state = await readState(CONFIG.stateFile);

    try {
        const res = await scanAndNotify(CONFIG.packagePath, state, CONFIG.stateFile, CONFIG.slackUserId);
        console.log("Initial scan result:", res);
    } catch (e) {
        console.error("Initial scan failed:", e);
    }

    setInterval(async () => {
        try {
            const currentState = await readState(CONFIG.stateFile);
            const res = await scanAndNotify(CONFIG.packagePath, currentState, CONFIG.stateFile, CONFIG.slackUserId);
            console.log("Poll scan:", res, new Date().toISOString());
        } catch (e) {
            console.error("Periodic scan error:", e);
        }
    }, CONFIG.pollIntervalSeconds * 1000);
}

main();
