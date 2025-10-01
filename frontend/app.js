// ---- CONFIG: set these to your deployed details ----
const CONTRACT_ADDRESS = "0xYOUR_REAL_DEPLOYED_ADDRESS";
const MODULE_NAME = "voting";


// ---- Basic state ----
let wallet = null;
let account = null;

const els = {
  connectBtn: document.getElementById("connectBtn"),
  walletStatus: document.getElementById("walletStatus"),
  createPollForm: document.getElementById("createPollForm"),
  createStatus: document.getElementById("createStatus"),
  pollsBody: document.getElementById("pollsBody"),
  loadStatus: document.getElementById("loadStatus"),
  refreshBtn: document.getElementById("refreshBtn"),
};

// ---- Wallet connect (Petra-compatible) ----
async function connect() {
  if (!window.aptos) {
    alert("No Aptos wallet found. Install Petra extension and reload.");
    return;
  }
  try {
    const res = await window.aptos.connect();
    wallet = window.aptos;
    account = res.address;
    els.walletStatus.textContent = `Connected: ${short(account)}`;
    els.connectBtn.textContent = "Connected";
    els.connectBtn.disabled = true;
  } catch (e) {
    console.error(e);
    alert(e.message || "Failed to connect wallet");
  }
}
els.connectBtn.addEventListener("click", connect);

function short(addr) {
  return addr?.slice(0, 6) + "…" + addr?.slice(-4);
}

// ---- Contract calls ----
async function createPoll(question) {
  if (!wallet) throw new Error("Connect wallet first");
  const payload = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::create_poll`,
    type_arguments: [],
    arguments: [question],
  };
  return wallet.signAndSubmitTransaction({ payload });
}

async function vote(pollId, choiceBool) {
  if (!wallet) throw new Error("Connect wallet first");
  const payload = {
    type: "entry_function_payload",
    function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::vote`,
    type_arguments: [],
    arguments: [String(pollId), !!choiceBool],
  };
  return wallet.signAndSubmitTransaction({ payload });
}

async function fetchPolls() {
  try {
    els.loadStatus.textContent = "Loading polls…";
    // Use wallet network if available; fallback to public mainnet endpoint
    let nodeUrl = "https://fullnode.mainnet.aptoslabs.com/v1";
    if (wallet?.network) {
      try {
        const n = await wallet.network();
        nodeUrl = n?.api || n?.node_url || nodeUrl;
      } catch {}
    }

    // Requires a #[view] Move function: get_polls() -> (vector<u64>, vector<String>, vector<u64>, vector<u64>)
    const body = {
      function: `${CONTRACT_ADDRESS}::${MODULE_NAME}::get_polls`,
      type_arguments: [],
      arguments: [],
    };

    const res = await fetch(`${nodeUrl}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("View call failed");
    const data = await res.json();
    const [ids = [], questions = [], yeses = [], nos = []] = data || [];
    const polls = ids.map((id, i) => ({
      id,
      question: questions[i],
      yes: yeses[i],
      no: nos[i],
    }));
    renderPolls(polls);
    els.loadStatus.textContent = polls.length ? "" : "No polls yet.";
  } catch (e) {
    console.warn("Could not load polls:", e);
    renderPolls([]);
    els.loadStatus.textContent = "Could not load polls (ensure get_polls view exists).";
  }
}

function renderPolls(polls) {
  els.pollsBody.innerHTML = "";
  polls.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id ?? "-"}</td>
      <td>${escapeHtml(p.question ?? "")}</td>
      <td><span class="badge">${p.yes ?? 0}</span></td>
      <td><span class="badge">${p.no ?? 0}</span></td>
      <td class="actions">
        <button class="btn" onclick="vote(${p.id}, true)">Yes</button>
        <button class="btn" onclick="vote(${p.id}, false)">No</button>
      </td>
    `;
    els.pollsBody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

// ---- UI events ----
els.createPollForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = (document.getElementById("question").value || "").trim();
  if (!question) return;
  els.createStatus.textContent = "Submitting…";
  try {
    const tx = await createPoll(question);
    els.createStatus.textContent = "Transaction: " + (tx?.hash || "");
    document.getElementById("question").value = "";
  } catch (err) {
    console.error(err);
    els.createStatus.textContent = "Failed: " + (err.message || "error");
  }
});

els.refreshBtn.addEventListener("click", fetchPolls);

// Auto-load list on open
fetchPolls();
