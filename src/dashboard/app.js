let scanData = [];

async function loadData() {
    const res = await fetch("../../logs/scan_history.json");
    scanData = await res.json();
    renderDashboard();

}

function renderDashboard() {
    let data = [...scanData];
    const container = document.getElementById("scan-container");
    container.innerHTML = "";

    const search = document.getElementById("searchPackage").value.toLowerCase();
    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;
    const severity = document.getElementById("filterSeverity").value;
    const sort = document.getElementById("sortBy").value;

    data = data.filter(d => {
        if (from && new Date(d.timestamp) < new Date(from)) return false;
        if (to && new Date(d.timestamp) > new Date(to)) return false;
        if (severity === "vulnerable" && !d.changes.some(c => c.vulnsCount > 0)) return false;
        return true;
    });

    data.forEach(scan => scan.totalVulns = scan.changes.reduce((s, c) => s + c.vulnsCount, 0));

    if (sort === "newest") data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (sort === "oldest") data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (sort === "mostVulns") data.sort((a, b) => b.totalVulns - a.totalVulns);

    data.forEach(scan => {
        const card = document.createElement("div");
        card.classList.add("card");

        let changesHTML = scan.changes
            .filter(c => c.name.toLowerCase().includes(search))
            .map(c => `
        <div class="change-box">
          <span class="badge ${c.type}">${c.type.toUpperCase()}</span>
          <p><strong>${c.name}@${c.version}</strong></p>
          <p>Dependency: ${c.name}</p>
          <p>Vulnerabilities: ${c.vulnsCount}</p>
          ${c.remediation ? `<p class="success">Fix: ${c.remediation}</p>` : ""}
        </div>
      `).join("");

        card.innerHTML = `
      <div class="timestamp">⏱ ${scan.timestamp}</div>
      <p><strong>Total Dependencies:</strong> ${scan.totalDependencies}</p>
      <p><strong>Total Vulnerabilities:</strong> ${scan.totalVulns}</p>
      ${changesHTML}
    `;

        container.appendChild(card);
    });
}

document.querySelectorAll("#searchPackage, #fromDate, #toDate, #filterSeverity, #sortBy")
    .forEach(el => el.addEventListener("input", renderDashboard));



function toggleDark() {
    document.body.classList.toggle("dark");
}

loadData();
