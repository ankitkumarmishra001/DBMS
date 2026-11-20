let me = null,
  view = "",
  note = null,
  D = {},
  rfilter = "All",
  dp = { q: "", g: "All", page: 1 };
const PAGE = 25;
const $ = (s) => document.querySelector(s),
  $$ = (s) => document.querySelectorAll(s),
  app = $("#app");
const esc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const ic = (n) => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const DROP = "M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z",
  GAUGE_MAX = 15;
const say = (t, err) => {
  note = { t, err };
};
const initials = (n) =>
  n
    .split(" ")
    .filter((w) => /^[A-Za-z]/.test(w) && !/\.$/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
const av = (n) => `<span class="av">${esc(initials(n))}</span>`;
const bg = (g) => `<span class="bg">${g}</span>`;
const table = (head, rows) =>
  rows.length
    ? `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<p class="empty">Nothing here yet.</p>`;
const opts = (a) => a.map((x) => `<option>${x}</option>`).join("");
const head = (t, s, act = "") =>
  `<header class="ph"><div><h1>${t}</h1><p>${s}</p></div>${act}</header>`;
const kpi = (i, v, l) =>
  `<div class="kpi"><span class="kic">${ic(i)}</span><div><b>${v}</b><small>${l}</small></div></div>`;
function toast(n) {
  const t = document.createElement("div");
  t.className = "toast" + (n.err ? " err" : "");
  t.setAttribute("role", "status");
  t.textContent = n.t;
  document.body.append(t);
  setTimeout(() => t.remove(), 4200);
}
function csv(name, rows) {
  const b = new Blob(
    [
      rows
        .map((r) =>
          r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n"),
    ],
    { type: "text/csv" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
// call the API, show the result as a toast, then redraw the page
async function act(path, method, body, okMsg) {
  try {
    await api(path, method, body);
    say(okMsg);
  } catch (e) {
    say(e.message, 1);
  }
  render();
}

const gauge = (n, i) => {
  const h = 19.5 * Math.max(0, Math.min(1, n / GAUGE_MAX));
  return `<svg viewBox="0 0 24 24" class="gauge" aria-hidden="true"><defs><clipPath id="gc${i}"><path d="${DROP}"/></clipPath></defs><path class="dbg" d="${DROP}"/><rect class="fill" clip-path="url(#gc${i})" x="0" y="${22 - h}" width="24" height="${h + 2}"/></svg>`;
};
const stockGrid = (s) =>
  `<div class="grid">${GROUPS.map((g, i) => {
    const c = s[g] <= 0 ? "crit" : s[g] < LOW_STOCK ? "low" : "";
    return `<div class="unit ${c}">${gauge(s[g], i)}<div class="g">${g}</div><b>${s[g]}</b><small>${c === "crit" ? "Out of stock" : c ? "Low stock" : "In stock"}</small></div>`;
  }).join("")}</div>`;
const status = (d) =>
  !d.available
    ? '<span class="tag bad">Unavailable</span>'
    : d.wait_days > 0
      ? `<span class="tag wait">In ${d.wait_days} days</span>`
      : '<span class="tag ok">Eligible now</span>';

async function loginView(mode = "login") {
  let p = { donors: 0, units: 0 };
  try {
    p = await api("/public");
  } catch (e) {}
  const reg = mode === "register",
    err = note ? `<div class="msg" role="alert">${esc(note.t)}</div>` : "";
  const form = reg
    ? `<form class="form" id="rg"><h2>Create your donor account</h2><p class="hint" style="margin:0">Register as a blood donor to see your eligibility and history.</p>${err}
<label for="rn">Full name</label><input id="rn" required maxlength="80" autocomplete="name">
<div class="two"><div><label for="rgr">Blood group</label><select id="rgr">${opts(GROUPS)}</select></div><div><label for="rc">City</label><input id="rc" required maxlength="50"></div></div>
<div class="two"><div><label for="rp">Phone</label><input id="rp" required pattern="[+]?[0-9 ]{10,15}" title="10 to 15 digits, optional +" inputmode="tel"></div><div><label for="re">Email (optional)</label><input id="re" type="email" maxlength="80"></div></div>
<label for="ru">Username</label><input id="ru" required pattern="[A-Za-z0-9_]{3,20}" title="3 to 20 letters, numbers or underscores" autocomplete="username">
<div class="two"><div><label for="rw">Password</label><input id="rw" type="password" required minlength="8" autocomplete="new-password"></div><div><label for="rw2">Confirm password</label><input id="rw2" type="password" required minlength="8" autocomplete="new-password"></div></div>
<button class="btn">${ic("user")} Create account</button><p class="hint">Already registered? <a href="#" id="sw">Sign in</a></p></form>`
    : `<form class="form" id="lf"><h2>Welcome back</h2><p class="hint" style="margin:0">Sign in to continue.</p>${err}
<label for="u">Username</label><input id="u" required autocomplete="username"><label for="p">Password</label><input id="p" type="password" required autocomplete="current-password">
<label class="chk"><input type="checkbox" id="sp"> Show password</label><button class="btn">${ic("user")} Sign in</button>
<p class="hint">New donor? <a href="#" id="sw">Create an account</a></p><p class="hint" style="margin-top:.3rem">Demo accounts: admin / admin123, donor1 / donor123</p></form>`;
  app.innerHTML = `<div class="login"><section class="hero"><div class="logo">${ic("drop")} LifeFlow Blood Bank</div>
<div style="position:relative"><h1>Every unit has a donor behind it.</h1><p style="margin-top:1rem">Register donors, record donations and answer hospital requests from one place.</p></div>
<div class="hstats"><div><b>${p.donors.toLocaleString()}</b><small>Registered donors</small></div><div><b>${p.units}</b><small>Units in stock</small></div><div><b>${GROUPS.length}</b><small>Blood groups tracked</small></div></div>
<svg class="big" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="hc"><path d="${DROP}"/></clipPath></defs><path class="out" d="${DROP}"/><rect class="fill" clip-path="url(#hc)" x="0" y="8" width="24" height="16"/></svg></section>
${form}</div>`;
  note = null;
  $("#sw").onclick = (e) => {
    e.preventDefault();
    note = null;
    loginView(reg ? "login" : "register");
  };
  if (reg) {
    $("#rg").onsubmit = async (e) => {
      e.preventDefault();
      if ($("#rw").value !== $("#rw2").value)
        return toast({ t: "The two passwords do not match.", err: 1 });
      try {
        const r = await api("/register", "POST", {
          name: $("#rn").value.trim(),
          group: $("#rgr").value,
          city: $("#rc").value.trim(),
          phone: $("#rp").value.trim(),
          email: $("#re").value.trim(),
          username: $("#ru").value.trim(),
          password: $("#rw").value,
        });
        token = r.token;
        me = r.user;
        view = "profile";
        say("Account created. Welcome!");
        render();
      } catch (err) {
        toast({ t: err.message, err: 1 });
      }
    };
    return;
  }
  $("#sp").onchange = (e) =>
    ($("#p").type = e.target.checked ? "text" : "password");
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/login", "POST", {
        username: $("#u").value.trim(),
        password: $("#p").value,
      });
      token = r.token;
      me = r.user;
      view = me.role === "admin" ? "dashboard" : "profile";
      render();
    } catch (err) {
      say(err.message, 1);
      loginView();
    }
  };
}

const MENU = {
  admin: [
    ["dashboard", "Dashboard", "grid"],
    ["donors", "Donors", "users"],
    ["donations", "Donations", "heart"],
    ["requests", "Requests", "hosp"],
    ["reports", "Reports", "chart"],
    ["centers", "Centres", "pin"],
  ],
  donor: [
    ["profile", "My profile", "user"],
    ["history", "My donations", "list"],
    ["centers", "Where to donate", "pin"],
  ],
};
const LOAD = {
  dashboard: () => api("/summary"),
  donations: () => api("/donations"),
  requests: () => api("/requests?status=" + rfilter),
  reports: () => api("/reports"),
  profile: () => api("/me"),
  history: () => api("/me"),
  centers: async () => ({
    rows: (await api("/centers")).rows,
    donor: me.role === "donor" ? (await api("/me")).donor : null,
  }),
};
async function render() {
  if (!me) return loginView();
  app.innerHTML = `<div class="shell"><nav><div class="brand">${ic("drop")} LifeFlow</div>${MENU[me.role].map(([k, l, i]) => `<button data-v="${k}" class="${k === view ? "on" : ""}">${ic(i)}<span>${l}</span></button>`).join("")}<div class="who">${av(me.name)}<div>${esc(me.name)}<small>${me.role === "admin" ? "Administrator" : "Donor"}</small></div><button id="out" aria-label="Sign out">${ic("out")}</button></div></nav><main id="main"><p class="empty">Loading...</p></main></div>`;
  $$("nav [data-v]").forEach(
    (b) =>
      (b.onclick = () => {
        view = b.dataset.v;
        note = null;
        render();
      }),
  );
  $("#out").onclick = () => {
    token = null;
    me = null;
    note = null;
    loginView();
  };
  // UI guard only: the server checks the role on every request too
  if (me.role === "donor" && !MENU.donor.some((m) => m[0] === view)) {
    view = "profile";
    say("You can only view your own records.", 1);
  }
  let html;
  try {
    D = LOAD[view] ? await LOAD[view]() : {};
    html = VIEWS[view](D);
  } catch (e) {
    html = `<div class="msg" role="alert">${esc(e.message)}</div>`;
  }
  if (!me) return;
  $("#main").innerHTML = html;
  if (note) {
    toast(note);
    note = null;
  }
  (BIND[view] || (() => {}))();
  scrollTo(0, 0);
}

const donorRows = (list, del) =>
  table(
    ["Donor", "Group", "City", "Phone", "Status", ...(del ? [""] : [])],
    list.map((d) => [
      `<div class="who2">${av(d.name)}<div>${esc(d.name)}<br><small style="color:var(--mute)">ID ${d.id}</small></div></div>`,
      bg(d.group),
      esc(d.city),
      esc(d.phone),
      status(d),
      ...(del
        ? [
            `<button class="btn sm ghost" data-x="${d.id}" aria-label="Remove ${esc(d.name)}">${ic("trash")}</button>`,
          ]
        : []),
    ]),
  );
const reqRows = (list) =>
  table(
    ["Hospital", "Group", "Units", "Date", "Status", ""],
    list.map((r) => [
      `${esc(r.hospital)} ${r.urgent ? '<span class="tag bad">Urgent</span>' : ""}`,
      bg(r.group),
      r.units,
      r.date,
      `<span class="tag ${r.status === "Fulfilled" ? "ok" : r.status === "Rejected" ? "bad" : "wait"}">${r.status}</span>`,
      r.status === "Pending"
        ? `<div class="acts"><button class="btn sm ok" data-f="${r.id}">Fulfil</button><button class="btn sm ghost" data-r="${r.id}">Reject</button></div>`
        : "",
    ]),
  );
const donRows = (list) =>
  table(
    ["Date", "Donor", "Group", "Units"],
    list.map((x) => [
      x.date,
      `<div class="who2">${av(x.name)}${esc(x.name)}</div>`,
      bg(x.group),
      x.units,
    ]),
  );
const pager = (t) => {
  const a = (dp.page - 1) * PAGE + 1,
    b = Math.min(t, dp.page * PAGE);
  return `<div class="tools" style="margin:.8rem 0 0;align-items:center"><span class="hint" style="margin:0;flex:1">${t ? `Showing ${a}-${b} of ${t.toLocaleString()}` : "No matches"}</span><button class="btn sm ghost" id="pv" ${dp.page < 2 ? "disabled" : ""}>Previous</button><button class="btn sm ghost" id="nx" ${b >= t ? "disabled" : ""}>Next</button></div>`;
};

const centerCards = (rows, city, adm) =>
  rows.length
    ? `<div class="cards">${[...rows]
        .sort((a, b) => (b.city === city) - (a.city === city))
        .map(
          (r) =>
            `<div class="cc ${r.city === city ? "mine" : ""}"><div class="top"><h3>${esc(r.name)}</h3>${r.city === city ? '<span class="tag ok">Your city</span>' : ""}</div><p class="ln">${ic("pin")} ${esc(r.address)}, ${esc(r.city)}</p><p class="ln"><b>Phone</b> ${esc(r.phone)}</p><p class="ln"><b>Hours</b> ${esc(r.hours)}</p>${adm ? `<p style="margin-top:.7rem"><button class="btn sm ghost" data-dc="${r.id}" aria-label="Remove ${esc(r.name)}">${ic("trash")} Remove</button></p>` : ""}</div>`,
        )
        .join("")}</div>`
    : '<p class="empty">No donation centres found.</p>';
const VIEWS = {
  dashboard: (D) => {
    const s = D.stock,
      tot = GROUPS.reduce((a, g) => a + Math.max(0, s[g]), 0),
      low = GROUPS.filter((g) => s[g] < LOW_STOCK);
    return (
      head("Dashboard", "Live stock, requests and donors at a glance") +
      (low.length
        ? `<div class="alert" role="alert">${ic("alert")}<div><b>${low.length} blood group${low.length > 1 ? "s are" : " is"} running low:</b> ${low.join(", ")}. See eligible donors under Reports.</div></div>`
        : "") +
      `<div class="kpis">${kpi("users", D.donors.toLocaleString(), "Registered donors")}${kpi("drop", tot, "Units in stock")}${kpi("hosp", D.pendingList.length, "Pending requests")}${kpi("heart", D.eligible.toLocaleString(), "Donors eligible now")}</div>
  <div class="panel"><h3>Stock by blood group</h3>${stockGrid(s)}</div>
  <div class="cols"><div class="panel"><h3>Pending requests</h3>${D.pendingList.length ? reqRows(D.pendingList) : '<p class="empty">No pending requests.</p>'}</div><div class="panel"><h3>Recent donations</h3>${donRows(D.recent)}</div></div>`
    );
  },
  donors: () =>
    head("Donors", "Register and manage blood donors") +
    `<div class="panel"><h3>Add a donor</h3><form class="tools" id="df"><div><label for="n">Full name</label><input id="n" required></div><div style="flex:0 1 120px"><label for="g">Blood group</label><select id="g">${opts(GROUPS)}</select></div><div><label for="c">City</label><input id="c" required></div><div><label for="ph">Phone</label><input id="ph" required pattern="[+]?[0-9 ]{10,15}" title="10 to 15 digits, optional +" placeholder="+61 400000000"></div><div style="flex:0 1 120px"><label for="av">Available</label><select id="av"><option>Yes</option><option>No</option></select></div><button class="btn">${ic("plus")} Add donor</button></form></div>
  <div class="panel"><h3>Import donors from CSV</h3><p class="hint" style="margin:0 0 .6rem">Required columns: name, city, blood_group, contact_number. Optional: donor_id, email, availability (Yes/No), months_since_first_donation, number_of_donation, pints_donated, created_at. Donors whose donor_id already exists are skipped.</p><div class="tools"><div><label for="cf">CSV file</label><input id="cf" type="file" accept=".csv,text/csv"></div><button class="btn" id="ci">${ic("dl")} Import</button></div><div id="cr"></div></div>
  <div class="panel"><div class="tools"><div class="sbox"><label for="q">Search by name, group or city</label>${ic("search")}<input id="q" placeholder="e.g. Perth or O+" value="${esc(dp.q)}"></div><div style="flex:0 1 160px"><label for="fg">Group</label><select id="fg"><option>All</option>${opts(GROUPS)}</select></div></div><div id="dl"><p class="empty">Loading...</p></div></div>`,
  donations: (D) =>
    head(
      "Donations",
      "Record a donation. Donors must wait " +
        MIN_GAP_DAYS +
        " days between donations.",
    ) +
    `<div class="panel"><form class="tools" id="nf"><div class="sbox"><label for="dq">Find donor</label>${ic("search")}<input id="dq" placeholder="Type a name or city"></div><div><label for="d">Donor</label><select id="d"></select></div><div style="flex:0 1 110px"><label for="u">Units</label><input id="u" type="number" min="1" max="2" value="1" required></div><button class="btn">${ic("plus")} Record donation</button></form><p class="hint" id="eh"></p></div><div class="panel"><h3>Latest donations</h3>${donRows(D.rows)}</div>`,
  requests: (D) =>
    head("Hospital requests", "Log requests and fulfil them from stock") +
    `<div class="panel"><form class="tools" id="rf"><div><label for="h">Hospital</label><input id="h" required></div><div><label for="g">Blood group</label><select id="g">${opts(GROUPS)}</select></div><div style="flex:0 1 100px"><label for="u">Units</label><input id="u" type="number" min="1" max="10" value="1" required></div><div style="flex:0 1 140px"><label for="ur">Priority</label><select id="ur"><option>Normal</option><option>Urgent</option></select></div><button class="btn">${ic("plus")} Log request</button></form></div>
  <div class="panel"><div class="pills">${["All", "Pending", "Fulfilled", "Rejected"].map((s) => `<button class="chip ${s === rfilter ? "on" : ""}" data-s="${s}">${s}</button>`).join("")}</div>${reqRows(D.rows)}</div>`,
  reports: (D) =>
    head(
      "Reports",
      "Inventory, donor eligibility and dataset statistics",
      `<div class="acts"><button class="btn ghost" id="exi">${ic("dl")} Export inventory</button><button class="btn ghost" id="pr">${ic("print")} Print</button></div>`,
    ) +
    `<div class="panel"><h3>Current inventory by blood group</h3>${table(
      ["Group", "Units", "Status"],
      GROUPS.map((g) => [
        bg(g),
        D.stock[g],
        D.stock[g] <= 0
          ? '<span class="tag bad">Out of stock</span>'
          : D.stock[g] < LOW_STOCK
            ? '<span class="tag wait">Low</span>'
            : '<span class="tag ok">OK</span>',
      ]),
    )}</div>
  <div class="panel"><h3>Donors eligible now (${D.eligible.toLocaleString()} in total)</h3><p class="hint" style="margin:0 0 .6rem">Showing the first 25.</p>${donorRows(D.list)}</div>
  <div class="cols"><div class="panel"><h3>Lifetime donations by blood group</h3>${table(
    ["Group", "Donors", "Donations", "Pints"],
    D.lifetime.map((r) => [
      bg(r.group),
      r.donors.toLocaleString(),
      r.donations.toLocaleString(),
      r.pints.toLocaleString(),
    ]),
  )}</div>
  <div class="panel"><h3>Donors by city</h3>${table(
    ["City", "Donors", "Available"],
    D.cities.map((r) => [
      esc(r.city),
      r.donors.toLocaleString(),
      r.available.toLocaleString(),
    ]),
  )}</div></div>`,
  profile: (D) => {
    const d = D.donor,
      w = d.available ? d.wait_days : MIN_GAP_DAYS,
      ready = d.available && !w,
      C = 2 * Math.PI * 65,
      p = ready ? 1 : (MIN_GAP_DAYS - w) / MIN_GAP_DAYS;
    return (
      head("My profile", "Your details and donation eligibility") +
      `<div class="panel prof"><div class="ring ${ready ? "ready" : ""}"><svg width="150" height="150" viewBox="0 0 150 150"><circle class="t" cx="75" cy="75" r="65"/><circle class="p" cx="75" cy="75" r="65" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}"/></svg><div>${ready ? "Ready" : d.available ? w : "Paused"}<small>${ready ? "to donate" : d.available ? "days to go" : "unavailable"}</small></div></div>
  <div><h2>${esc(d.name)} ${bg(d.group)}</h2><p style="color:var(--mute)">${esc(d.city)}, ${esc(d.phone)}</p><p style="margin-top:.6rem">${status(d)}</p>${ready ? `<p style="margin-top:.8rem"><button class="btn sm" id="fc">${ic("pin")} Find a donation centre</button></p>` : ""}</div></div>
  <div class="kpis">${kpi("heart", d.total_donations, "Donations made")}${kpi("drop", d.total_pints, "Pints donated")}${kpi("users", "up to " + d.total_pints * 3, "Patients helped")}</div>
  <div class="panel"><h3>Compatibility</h3><p class="hint" style="margin-top:0">You can receive from</p><div class="pills">${COMPAT[d.group].map(bg).join("")}</div><p class="hint" style="margin-top:0">You can donate to</p><div class="pills">${GROUPS.filter(
    (g) => COMPAT[g].includes(d.group),
  )
    .map(bg)
    .join("")}</div></div>`
    );
  },
  history: (D) =>
    head("My donations", "Donations recorded through this system") +
    `<div class="panel">${table(
      ["Date", "Units"],
      D.history.map((x) => [x.date, x.units]),
    )}</div>`,
  centers: (D) => {
    const d = D.donor,
      adm = me.role === "admin",
      cities = [...new Set(D.rows.map((r) => r.city))];
    const ready = d && d.available && !d.wait_days;
    const banner = d
      ? `<div class="alert ${ready ? "ok" : ""}" role="status">${ic(ready ? "heart" : "alert")}<div>${ready ? "You are eligible to donate now. Pick a centre below." : !d.available ? "Your profile is marked unavailable. Please contact the blood bank before you donate." : `You can donate again in ${d.wait_days} days. You can still choose a centre now.`}</div></div>`
      : "";
    return (
      head(
        adm ? "Donation centres" : "Where to donate",
        adm
          ? "Manage the places where donors can give blood"
          : "Find a centre near you and see what to expect",
      ) +
      banner +
      (adm
        ? `<div class="panel"><h3>Add a centre</h3><form class="tools" id="cf2"><div><label for="cn">Centre name</label><input id="cn" required maxlength="80"></div><div><label for="cy">City</label><input id="cy" required maxlength="50"></div><div><label for="ca">Address</label><input id="ca" required maxlength="120"></div><div><label for="cp">Phone</label><input id="cp" required pattern="[+]?[0-9 ]{10,15}" title="10 to 15 digits, optional +"></div><div><label for="ch">Opening hours</label><input id="ch" required maxlength="80" placeholder="Mon-Fri 9am-5pm"></div><button class="btn">${ic("plus")} Add centre</button></form></div>`
        : `<div class="panel"><h3>How donating works</h3><ol class="steps"><li><div><b>Check you are eligible.</b> You need to be marked available and at least ${MIN_GAP_DAYS} days since your last donation.</div></li><li><div><b>Choose a centre</b> below and call ahead to confirm opening hours.</div></li><li><div><b>Bring photo ID</b>, eat a proper meal and drink plenty of water beforehand.</div></li><li><div><b>Health check and donation.</b> A short screening comes first. The donation itself takes about 10 minutes, and the whole visit around an hour. The centre decides final eligibility.</div></li></ol></div>`) +
      `<div class="panel"><div class="tools"><div style="flex:0 1 220px"><label for="cc">City</label><select id="cc"><option>All</option>${opts(cities)}</select></div></div><div id="cl">${centerCards(D.rows, d && d.city, adm)}</div></div>`
    );
  },
};

function bindReq() {
  $$("[data-f]").forEach(
    (b) =>
      (b.onclick = () =>
        act(
          "/requests/" + b.dataset.f,
          "PATCH",
          { status: "Fulfilled" },
          "Request fulfilled and stock updated.",
        )),
  );
  $$("[data-r]").forEach(
    (b) =>
      (b.onclick = () =>
        act(
          "/requests/" + b.dataset.r,
          "PATCH",
          { status: "Rejected" },
          "Request rejected.",
        )),
  );
}
async function drawDonors() {
  try {
    const r = await api(
      `/donors?q=${encodeURIComponent(dp.q)}&group=${encodeURIComponent(dp.g)}&page=${dp.page}`,
    );
    $("#dl").innerHTML = donorRows(r.rows, 1) + pager(r.total);
    $("#pv").onclick = () => {
      dp.page--;
      drawDonors();
    };
    $("#nx").onclick = () => {
      dp.page++;
      drawDonors();
    };
    $$("[data-x]").forEach(
      (b) =>
        (b.onclick = () => {
          if (confirm("Remove this donor?"))
            act("/donors/" + b.dataset.x, "DELETE", null, "Donor removed.");
        }),
    );
  } catch (e) {
    $("#dl").innerHTML =
      `<div class="msg" role="alert">${esc(e.message)}</div>`;
  }
}
const debounce = (f, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => f(...a), ms);
  };
};

const BIND = {
  dashboard: bindReq,
  donors() {
    $("#fg").value = dp.g;
    drawDonors();
    $("#q").oninput = debounce((e) => {
      dp.q = e.target.value.trim();
      dp.page = 1;
      drawDonors();
    }, 250);
    $("#fg").onchange = (e) => {
      dp.g = e.target.value;
      dp.page = 1;
      drawDonors();
    };
    $("#ci").onclick = async () => {
      const file = $("#cf").files[0];
      if (!file) return toast({ t: "Choose a CSV file first.", err: 1 });
      if (file.size > 4e6)
        return toast({ t: "That file is too large (limit 4 MB).", err: 1 });
      const btn = $("#ci");
      btn.disabled = true;
      try {
        const r = await api("/donors/import", "POST", {
          csv: await file.text(),
        });
        $("#cr").innerHTML =
          `<div class="alert ok" role="status">${ic("alert")}<div><b>${r.added} added</b>, ${r.skipped} skipped as duplicates, ${r.invalid} invalid.${r.errors.length ? "<br>" + r.errors.map(esc).join("<br>") : ""}</div></div>`;
        dp.page = 1;
        drawDonors();
      } catch (e) {
        $("#cr").innerHTML =
          `<div class="msg" role="alert">${esc(e.message)}</div>`;
      }
      btn.disabled = false;
    };
    $("#df").onsubmit = (e) => {
      e.preventDefault();
      act(
        "/donors",
        "POST",
        {
          name: $("#n").value.trim(),
          group: $("#g").value,
          city: $("#c").value.trim(),
          phone: $("#ph").value.trim(),
          available: $("#av").value === "Yes",
        },
        "Donor added.",
      );
    };
  },
  donations() {
    const cache = {};
    const hint = () => {
      const d = cache[$("#d").value];
      $("#eh").innerHTML = d ? status(d) : "";
    };
    const find = async (q) => {
      try {
        const r = await api("/donors?limit=10&q=" + encodeURIComponent(q));
        r.rows.forEach((d) => (cache[d.id] = d));
        $("#d").innerHTML = r.rows
          .map(
            (d) =>
              `<option value="${d.id}">${esc(d.name)} (${d.group}, ${esc(d.city)})</option>`,
          )
          .join("");
        hint();
      } catch (e) {}
    };
    find("");
    $("#dq").oninput = debounce((e) => find(e.target.value.trim()), 250);
    $("#d").onchange = hint;
    $("#nf").onsubmit = (e) => {
      e.preventDefault();
      if (!$("#d").value) return;
      act(
        "/donations",
        "POST",
        { donorId: +$("#d").value, units: +$("#u").value },
        "Donation recorded.",
      );
    };
  },
  requests() {
    $("#rf").onsubmit = (e) => {
      e.preventDefault();
      act(
        "/requests",
        "POST",
        {
          hospital: $("#h").value.trim(),
          group: $("#g").value,
          units: +$("#u").value,
          urgent: $("#ur").value === "Urgent",
        },
        "Request logged.",
      );
    };
    $$("[data-s]").forEach(
      (b) =>
        (b.onclick = () => {
          rfilter = b.dataset.s;
          render();
        }),
    );
    bindReq();
  },
  reports() {
    $("#pr").onclick = () => print();
    $("#exi").onclick = () =>
      csv("inventory.csv", [
        ["Group", "Units"],
        ...GROUPS.map((g) => [g, D.stock[g]]),
      ]);
  },
  profile() {
    const b = $("#fc");
    if (b)
      b.onclick = () => {
        view = "centers";
        render();
      };
  },
  centers() {
    const adm = me.role === "admin";
    const delBind = () =>
      $$("[data-dc]").forEach(
        (b) =>
          (b.onclick = () => {
            if (confirm("Remove this centre?"))
              act(
                "/centers/" + b.dataset.dc,
                "DELETE",
                null,
                "Centre removed.",
              );
          }),
      );
    $("#cc").onchange = (e) => {
      const c = e.target.value;
      $("#cl").innerHTML = centerCards(
        D.rows.filter((r) => c === "All" || r.city === c),
        D.donor && D.donor.city,
        adm,
      );
      delBind();
    };
    delBind();
    if (adm)
      $("#cf2").onsubmit = (e) => {
        e.preventDefault();
        act(
          "/centers",
          "POST",
          {
            name: $("#cn").value,
            city: $("#cy").value,
            address: $("#ca").value,
            phone: $("#cp").value.trim(),
            hours: $("#ch").value,
          },
          "Centre added.",
        );
      };
  },
};
loginView();
