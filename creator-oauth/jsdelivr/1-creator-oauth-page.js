/* Generated from 1-creator-oauth-page.html - edit the .html, then regenerate. */
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  const root = document.getElementById("creator-oauth-content");
  if (!supabase || !root) return;

  root.innerHTML = `<div class="co-loading">Loading…</div>`;

  // ---------- helpers ----------
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeImg = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : "");
  const num = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString());

  const rel = (iso) => {
    if (!iso) return "never";
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  };
  const inRel = (unix) => {
    if (!unix) return "—";
    const s = unix - Math.floor(Date.now() / 1000);
    if (s <= 0) return "expired";
    if (s < 3600) return `in ${Math.max(1, Math.floor(s / 60))} min`;
    return `in ${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  };

  // ---------- session + admin check ----------
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    window.location.href = "/sign-in";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  if (!profile || profile.role !== "admin") {
    window.location.href = "/account";
    return;
  }

  // ---------- result of a connect flow (?oauth=youtube&status=ok|error&reason=...) ----------
  const params = new URLSearchParams(window.location.search);
  let banner = null;
  if (params.get("oauth") && params.get("status")) {
    banner = {
      ok: params.get("status") === "ok",
      provider: params.get("oauth"),
      reason: params.get("reason") || "",
    };
    history.replaceState(null, "", window.location.pathname);
  }

  // ---------- platforms ----------
  const PLATFORMS = [
    {
      id: "youtube", name: "YouTube", icon: "🔴",
      auth: "youtube-auth", refresh: "youtube-refresh", info: "youtube-channel-info",
      render: (c) => ({
        avatar: c.avatar, title: c.title,
        lines: [`Subscribers: ${num(c.subscribers)}`, `Members: ${num(c.members)}`],
        live: c.isLive, liveTitle: c.liveTitle,
      }),
    },
    {
      id: "twitch", name: "Twitch", icon: "🟣",
      auth: "twitch-auth", refresh: "twitch-refresh", info: "twitch-channel-info",
      render: (c) => ({
        avatar: c.avatar, title: c.display_name,
        lines: [`Followers: ${num(c.followers)}`, `Subscribers: ${num(c.subscribers)}`],
        live: c.isLive, liveTitle: c.liveTitle,
      }),
    },
    {
      id: "kick", name: "Kick", icon: "🟢",
      auth: "kick-auth", refresh: "kick-refresh", info: "kick-channel-info",
      render: (c) => ({
        avatar: c.avatar, title: c.username,
        lines: [`Followers: ${num(c.followers)}`],
        live: c.isLive, liveTitle: c.liveTitle,
      }),
    },
  ];

  // One query for all three token rows (no secrets are selected)
  const { data: rows } = await supabase
    .from("provider_tokens")
    .select("provider, expires_at, needs_reauth, revoked, last_error, last_refresh_at")
    .eq("user_id", session.user.id);
  const tokenOf = Object.fromEntries((rows || []).map((r) => [r.provider, r]));

  // Channel info for every connected platform, in parallel; one failing never breaks the page
  const infos = await Promise.all(
    PLATFORMS.map(async (p) => {
      const t = tokenOf[p.id];
      if (!t || t.needs_reauth || t.revoked) return null;
      try {
        const { data, error } = await supabase.functions.invoke(p.info);
        return error ? null : data;
      } catch (_) {
        return null;
      }
    })
  );

  // ---------- UI ----------
  const card = (p, i) => {
    const t = tokenOf[p.id];
    const info = infos[i];
    const needsReconnect = !!t && (t.needs_reauth || t.revoked);
    const connected = !!t && !needsReconnect;

    const status = !t
      ? `<span class="co-pill co-bad">Not connected</span>`
      : needsReconnect
        ? `<span class="co-pill co-warn">Needs reconnect</span>`
        : `<span class="co-pill co-ok">Connected</span>`;

    let channel = "";
    if (info) {
      const v = p.render(info);
      const img = safeImg(v.avatar);
      channel = `
        <div class="co-channel">
          ${img ? `<img src="${esc(img)}" alt="" />` : `<div class="co-noimg"></div>`}
          <div>
            <strong>${esc(v.title)}</strong>
            ${v.lines.map((l) => `<div class="co-sub">${esc(l)}</div>`).join("")}
            ${v.live
              ? `<span class="co-live">● LIVE — ${esc(v.liveTitle)}</span>`
              : `<span class="co-off">Offline</span>`}
          </div>
        </div>`;
    }

    const details = t ? `
      <div class="co-row"><div>Access token</div><div class="co-muted">${connected ? "renews " + inRel(t.expires_at) : "—"}</div></div>
      <div class="co-row"><div>Last auto-refresh</div><div class="co-muted">${rel(t.last_refresh_at)}</div></div>
      ${t.last_error ? `<div class="co-row"><div>Last problem</div><div class="co-err">${esc(t.last_error)}</div></div>` : ""}
    ` : "";

    return `
      <div class="co-card" data-p="${p.id}">
        <h3>${p.icon} ${p.name}</h3>
        ${channel}
        <div class="co-row"><div>Status</div>${status}</div>
        ${details}
        <div class="co-row">
          <div>${t ? "Reconnect (only needed if it says Needs reconnect)" : "Connect (one time)"}</div>
          <div class="co-actions">
            ${connected ? `<button class="co-btn" data-refresh="${p.id}">Refresh now</button>` : ""}
            <button class="co-btn ${needsReconnect || !t ? "co-primary" : ""}" data-connect="${p.id}">${t ? "Reconnect" : "Connect"}</button>
          </div>
        </div>
      </div>`;
  };

  const bannerHtml = banner
    ? `<div class="co-banner ${banner.ok ? "co-banner-ok" : "co-banner-bad"}">
         ${banner.ok
           ? `${esc(banner.provider)} connected. It will now renew itself automatically.`
           : `Could not connect ${esc(banner.provider)}${banner.reason ? ": " + esc(banner.reason) : ""}. Try again.`}
       </div>`
    : "";

  root.innerHTML = `
    <style>
      #creator-oauth-content { color:#eee; }
      #creator-oauth-content .co-card { background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:20px; }
      #creator-oauth-content h2, #creator-oauth-content h3 { margin:0 0 12px; }
      #creator-oauth-content .co-intro { color:#999;margin:0 0 18px;font-size:14px; }
      #creator-oauth-content .co-row { display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #222; }
      #creator-oauth-content .co-row:last-child { border-bottom:none; }
      #creator-oauth-content .co-actions { display:flex;gap:8px; }
      #creator-oauth-content .co-btn { background:#222;border:1px solid #333;padding:6px 14px;border-radius:8px;cursor:pointer;color:#fff; }
      #creator-oauth-content .co-btn:hover { background:#333; }
      #creator-oauth-content .co-btn:disabled { opacity:.5;cursor:default; }
      #creator-oauth-content .co-primary { background:#2a5bd7;border-color:#2a5bd7; }
      #creator-oauth-content .co-primary:hover { background:#3568e6; }
      #creator-oauth-content .co-pill { padding:2px 10px;border-radius:999px;font-size:13px; }
      #creator-oauth-content .co-ok { color:#00ff88;background:#0b2a1c; }
      #creator-oauth-content .co-warn { color:#ffb020;background:#2a2008; }
      #creator-oauth-content .co-bad { color:#ff5555;background:#2a1010; }
      #creator-oauth-content .co-muted { color:#999;font-size:14px; }
      #creator-oauth-content .co-err { color:#ff8888;font-size:13px;max-width:60%;text-align:right; }
      #creator-oauth-content .co-channel { display:flex;align-items:center;gap:12px;margin-bottom:12px; }
      #creator-oauth-content .co-channel img, #creator-oauth-content .co-noimg { width:44px;height:44px;border-radius:50%;background:#222;object-fit:cover; }
      #creator-oauth-content .co-sub { color:#aaa;font-size:14px; }
      #creator-oauth-content .co-live { color:#ff4040;font-weight:bold;font-size:14px; }
      #creator-oauth-content .co-off { color:#888;font-size:14px; }
      #creator-oauth-content .co-banner { padding:12px 16px;border-radius:10px;margin-bottom:18px;font-size:14px; }
      #creator-oauth-content .co-banner-ok { background:#0b2a1c;color:#00ff88; }
      #creator-oauth-content .co-banner-bad { background:#2a1010;color:#ff8888; }
      #creator-oauth-content .co-loading { color:#999; }
      @media (max-width:600px) { #creator-oauth-content .co-row { flex-direction:column;align-items:flex-start; } #creator-oauth-content .co-err { max-width:100%;text-align:left; } }
    </style>

    <h2>Creator OAuth</h2>
    <p class="co-intro">Connect each platform once. Tokens renew automatically in the background (checked every 10 minutes); you only need to reconnect if a platform says so.</p>
    ${bannerHtml}
    ${PLATFORMS.map(card).join("")}
  `;

  // ---------- actions ----------
  const busy = (btn, text) => { btn.disabled = true; btn.dataset.old = btn.textContent; btn.textContent = text; };
  const idle = (btn) => { btn.disabled = false; btn.textContent = btn.dataset.old || btn.textContent; };

  root.querySelectorAll("[data-connect]").forEach((btn) => {
    btn.onclick = async () => {
      const p = PLATFORMS.find((x) => x.id === btn.dataset.connect);
      busy(btn, "Opening…");
      try {
        const { data, error } = await supabase.functions.invoke(p.auth);
        if (error || !data?.url) throw new Error("no url");
        window.location.href = data.url;
      } catch (_) {
        idle(btn);
        alert(`Could not start the ${p.name} connection. Please try again.`);
      }
    };
  });

  root.querySelectorAll("[data-refresh]").forEach((btn) => {
    btn.onclick = async () => {
      const p = PLATFORMS.find((x) => x.id === btn.dataset.refresh);
      busy(btn, "Refreshing…");
      const { error } = await supabase.functions.invoke(p.refresh);
      if (error) {
        idle(btn);
        alert(`${p.name} refresh failed. If this keeps happening, use Reconnect.`);
        return;
      }
      window.location.reload();
    };
  });
});
