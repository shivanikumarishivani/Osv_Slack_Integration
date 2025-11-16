import { WebClient } from "@slack/web-api";
import { CONFIG } from "./config.js";

const client = new WebClient(CONFIG.slackToken);

export async function sendDirectMessage(userId, text, blocks = undefined) {
    const openRes = await client.conversations.open({ users: userId });
    const channel = openRes.channel?.id;
    if (!channel) throw new Error("Failed to open Slack conversation");

    const res = await client.chat.postMessage({
        channel,
        text,
        blocks
    });

    return res;
}
