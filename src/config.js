import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
    slackToken: process.env.SLACK_BOT_TOKEN,
    slackUserId: process.env.SLACK_USER_ID,
    packagePath: process.env.PACKAGE_PATH || "./package.json",
    stateFile: process.env.STATE_FILE || "./.osv_state.json",
    pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS || "60", 10),
    osvApiUrl: process.env.OSV_API_URL || "https://api.osv.dev/v1/query"
};
