import fetch from "node-fetch";
import { CONFIG } from "./config.js";

export async function queryOSV(packageName, version) {
    const body = {
        package: {
            name: packageName,
            ecosystem: "npm"
        },
        version: version
    };

    const resp = await fetch(CONFIG.osvApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        throw new Error(`OSV API error ${resp.status}`);
    }

    const json = await resp.json();
    return json.vulns || [];
}
