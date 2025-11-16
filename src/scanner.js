import fs from "fs/promises";
import { queryOSV } from "./osvClient.js";
import { sendDirectMessage } from "./slackClient.js";
import { appendScanRecord, info, error } from "./logger.js";

function diffPackages(oldPackages, newPackages) {
    const results = [];
    for (const [name, ver] of Object.entries(newPackages)) {
        if (!oldPackages[name]) {
            results.push({ name, oldVersion: null, newVersion: ver, type: "added" });
        } else if (oldPackages[name] !== ver) {
            results.push({ name, oldVersion: oldPackages[name], newVersion: ver, type: "updated" });
        }
    }
    return results;
}

// Best-effort extract fixed versions from an OSV vuln object
function extractFixedVersions(vuln) {
    const fixedVersions = new Set();

    if (Array.isArray(vuln.affected)) {
        for (const a of vuln.affected) {
            if (Array.isArray(a.ranges)) {
                for (const range of a.ranges) {
                    if (Array.isArray(range.events)) {
                        for (const ev of range.events) {
                            if (ev.fixed) {
                                fixedVersions.add(ev.fixed);
                            }
                            // Some OSV responses may use { introduced, fixed } or { type, introduced, fixed }
                            // Also check other possible keys
                        }
                    }
                }
            }
            // database_specific keys sometimes contain 'fixed_in' or similar
            if (a.database_specific && typeof a.database_specific === "object") {
                const ds = a.database_specific;
                if (ds.fixed_in) {
                    if (Array.isArray(ds.fixed_in)) {
                        ds.fixed_in.forEach(v => fixedVersions.add(v));
                    } else {
                        fixedVersions.add(ds.fixed_in);
                    }
                }
            }
        }
    }

    // fallback: check vuln.references for urls that might hint at a fixed version (not reliable)
    return Array.from(fixedVersions);
}

function buildMessage(pkgName, pkgVersion, vulns, timestamp) {
    if (!vulns || vulns.length === 0) {
        return `*${pkgName}@${pkgVersion}* — The package is free from any vulnerabilities.\n_Scan time: ${timestamp}_`;
    }

    const lines = [
        `*${pkgName}@${pkgVersion}* — Vulnerabilities found: ${vulns.length}`,
        `_Scan time: ${timestamp}_`,
        ""
    ];

    for (const v of vulns) {
        const id = v.id || v.summary || "UNKNOWN";
        const summary = v.summary || (v.details ? v.details.slice(0, 200) : "");
        lines.push(`• *ID:* ${id}`);
        if (summary) lines.push(`  • Summary: ${summary}`);
        if (v.details) lines.push(`  • Details: ${v.details.slice(0, 300)}`);
        // remediation extraction
        const fixed = extractFixedVersions(v);
        if (fixed && fixed.length) {
            // prefer the lowest fixed version (best-effort: show first)
            lines.push(`  • Remediation: Upgrade to version *${fixed[0]}* or later.`);
        } else {
            // try to provide link to references
            if (v.references && v.references.length) {
                const urls = v.references.map(r => r.url).filter(Boolean).slice(0, 2);
                if (urls.length) {
                    lines.push(`• Remediation: Check references for fixed version: ${urls.join(", ")}`);
                } else {
                    lines.push(`• Remediation: Check package repo/OSV for patched version.`);
                }
            } else {
                lines.push(`• Remediation: Check package repo/OSV for patched version.`);
            }
        }

        if (v.references && v.references.length) {
            const urls = v.references.map(r => r.url).filter(Boolean).slice(0, 3);
            if (urls.length) lines.push(`• References: ${urls.join(", ")}`);
        }
        lines.push("");
    }

    return lines.join("\n");
}

export async function scanAndNotify(packagePath, state, statePath, slackUserId) {
    const content = await fs.readFile(packagePath, "utf8");
    const pkgJson = JSON.parse(content);
    const deps = Object.assign({}, pkgJson.dependencies || {}, pkgJson.devDependencies || {});

    const changes = diffPackages(state.packages || {}, deps);
    const timestamp = new Date().toISOString();

    // for logger: collect summary of this run
    const runSummary = {
        timestamp,
        totalDependencies: Object.keys(deps).length,
        changes: []
    };

    for (const change of changes) {
        const { name, newVersion } = change;
        const record = {
            name,
            version: newVersion,
            type: change.type,
            scannedAt: timestamp,
            vulnsCount: 0,
            remediation: null
        };

        try {
            const vulns = await queryOSV(name, newVersion);
            record.vulnsCount = Array.isArray(vulns) ? vulns.length : 0;

            // determine remediation suggestions
            let remediationText = null;
            if (vulns && vulns.length) {
                const allFixed = [];
                for (const v of vulns) {
                    const fixed = extractFixedVersions(v);
                    if (fixed && fixed.length) allFixed.push(...fixed);
                }
                if (allFixed.length) {
                    remediationText = `Upgrade to ${allFixed[0]} or later`;
                    record.remediation = remediationText;
                }
            }

            const message = buildMessage(name, newVersion, vulns, timestamp);
            await sendDirectMessage(slackUserId, message);
            info(`Notified ${slackUserId} about ${name}@${newVersion} (${record.vulnsCount} vulns)`);
        } catch (err) {
            const msg = `Failed to scan ${name}@${newVersion}: ${err.message}`;
            try {
                await sendDirectMessage(slackUserId, msg);
            } catch (e) {
                error(`Failed to send Slack message for ${name}@${newVersion}: ${e.message}`);
            }
            error(msg);
            record.error = err.message;
        }

        runSummary.changes.push(record);
    }

    // write updated state and logs
    state.packages = deps;
    await import("./stateStore.js").then(m => m.writeState(statePath, state));

    // append run summary to log (best-effort)
    try {
        await appendScanRecord(runSummary);
    } catch (e) {
        // already handled inside logger
    }

    return { checked: Object.keys(deps).length, notified: changes.length };
}

export { diffPackages };
