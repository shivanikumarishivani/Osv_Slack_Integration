import fs from "fs/promises";

export async function readState(path) {
    try {
        const raw = await fs.readFile(path, "utf8");
        return JSON.parse(raw);
    } catch (e) {
        return { packages: {} };
    }
}

export async function writeState(path, state) {
    await fs.writeFile(path, JSON.stringify(state, null, 2), "utf8");
}
