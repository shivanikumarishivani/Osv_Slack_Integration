import fs from "fs/promises";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "logs", "scan_history.json");

async function ensureLogFile() {
    try {
        await fs.access(LOG_FILE);
    } catch (e) {
        // create file with empty array
        await fs.writeFile(LOG_FILE, "[]", "utf8");
    }
}

export async function appendScanRecord(record) {
    try {
        await ensureLogFile();
        const raw = await fs.readFile(LOG_FILE, "utf8");
        const arr = JSON.parse(raw || "[]");
        arr.push(record);
        await fs.writeFile(LOG_FILE, JSON.stringify(arr, null, 2), "utf8");
    } catch (err) {
        // best-effort: write to console if log fails
        // Do not throw — logging must not stop scans
        // eslint-disable-next-line no-console
        console.error("Failed to write scan log:", err);
    }
}

export function info(msg) {
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
}

export function error(msg) {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
}
