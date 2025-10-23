/* DevDetective v3 - script.js
   Put in same folder as index.html & style.css
*/
const API_ROOT = 'https://api.github.com/users/';
const el = id => document.getElementById(id);

// elements
const input = el('usernameInput');
const searchBtn = el('searchBtn');
const voiceBtn = el('voiceBtn');
const modal = el('modal');
const modalPanel = el('modalPanel');

let lastProfile = null;
let pinned = JSON.parse(localStorage.getItem('devdetective_pinned') || '[]');
let history = JSON.parse(localStorage.getItem('devdetective_history') || '[]');
let leaderboard = JSON.parse(localStorage.getItem('devdetective_lb') || '[]');

let langChart = null;
let map = null;

// init
renderHistory();
renderLeaderboard();

// events
searchBtn.addEventListener('click', () => startSearch(input.value.trim()));
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') startSearch(input.value.trim()); });

// voice search
voiceBtn.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert('Voice not supported'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.start();
    r.onresult = (ev) => { const txt = ev.results[0][0].transcript.trim(); input.value = txt.replace(/\s+/g, ''); startSearch(input.value); }
});

// keyboard shortcut
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); input.focus(); } });

// modal close
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

/* MAIN SEARCH FLOW */
async function startSearch(username) {
    if (!username) return;
    showTyping(true);
    try {
        const profile = await fetch(API_ROOT + username).then(r => r.json());
        if (profile.message === 'Not Found') { alert('User not found'); showTyping(false); return; }
        lastProfile = profile;
        saveHistory(username);
        await enrichAndRender(profile);
        showTyping(false);
    } catch (err) { console.error(err); showTyping(false); alert('Error fetching user'); }
}

function showTyping(on) {
    document.querySelectorAll('.dot').forEach(d => d.style.display = on ? 'inline-block' : 'none');
}

/* ENRICH WITH REPOS & LANGS */
async function enrichAndRender(profile) {
    const repos = await fetch(profile.repos_url + '?per_page=100').then(r => r.json());
    profile._repos = Array.isArray(repos) ? repos : [];
    // languages
    const langCount = {};
    profile._repos.forEach(r => { if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1; });
    profile._langCount = langCount;
    renderProfile(profile);
    renderRepos(profile._repos);
    renderAnalytics(profile);
    renderMap(profile);
    renderTimeline(profile);
    generateLeaderboardEntry(profile);
}

/* RENDER PROFILE */
function renderProfile(p) {
    el('avatarImg').src = p.avatar_url;
    el('fullName').innerText = p.name || p.login;
    el('userLink').innerText = '@' + p.login; el('userLink').href = p.html_url;
    el('joined').innerText = p.created_at ? 'Joined ' + new Date(p.created_at).toDateString() : 'Joined —';
    el('bio').innerText = p.bio || 'This profile has no bio.';
    el('statRepos').innerText = p.public_repos;
    el('statFollowers').innerText = p.followers;
    el('statFollowing').innerText = p.following;
    el('lastSeen').innerText = new Date(p.updated_at || p.created_at).toLocaleString();
    el('mainBadge').innerText = computeMainBadge(p);

    // languages pills
    const langWrap = el('languages'); langWrap.innerHTML = '';
    const langs = Object.entries(p._langCount).sort((a, b) => b[1] - a[1]);
    langs.slice(0, 6).forEach(([lang, c]) => { const s = document.createElement('div'); s.className = 'pill'; s.innerText = `${lang} (${c})`; langWrap.appendChild(s); });
}

/* compute main badge */
function computeMainBadge(p) {
    if (p.followers > 500) return '🌟 Popular Dev';
    if (p.public_repos > 50) return '🧠 Open Source Wizard';
    if (p.public_repos < 5) return '🆕 Newbie';
    return '💻 Dev';
}

/* RENDER REPOS */
function renderRepos(repos) {
    const list = el('reposList'); list.innerHTML = '';
    repos.slice(0, 20).forEach(r => {
        const div = document.createElement('div'); div.className = 'repo';
        div.innerHTML = `<div><strong>${r.name}</strong><div class="small muted">${r.description || ''}</div></div>
      <div style="text-align:right"><div class="small muted">⭐ ${r.stargazers_count}</div><a href='${r.html_url}' target='_blank' class='small'>Open</a></div>`;
        list.appendChild(div);
    });
    // openRepos button
    el('openReposBtn').onclick = () => {
        if (!lastProfile) return;
        const html = `<h3>Top repos for ${lastProfile.login}</h3>${lastProfile._repos.slice(0, 20).map(r =>
            `<div style='padding:6px;border-bottom:1px solid #eee'><a href='${r.html_url}' target='_blank'>${r.name}</a> — ⭐ ${r.stargazers_count}<div class='small muted'>${r.description||''}</div></div>`
        ).join('')}`;
        openModal(html);
    };
}

/* HISTORY & LEADERBOARD */
function saveHistory(username) {
    history = [username].concat(history.filter(u => u !== username)).slice(0, 8);
    localStorage.setItem('devdetective_history', JSON.stringify(history));
    renderHistory();
}
function renderHistory() {
    const h = el('history'); h.innerHTML = '';
    history.forEach(u => { const b = document.createElement('div'); b.className = 'pill'; b.innerText = u; b.onclick = () => startSearch(u); h.appendChild(b); });
}

function generateLeaderboardEntry(p) {
    leaderboard = leaderboard.filter(x => x.login !== p.login);
    leaderboard.unshift({ login: p.login, followers: p.followers, repos: p.public_repos, avatar: p.avatar_url });
    leaderboard = leaderboard.slice(0, 10);
    localStorage.setItem('devdetective_lb', JSON.stringify(leaderboard));
    renderLeaderboard();
}
function renderLeaderboard() {
    const box = el('leaderboard'); box.innerHTML = '';
    leaderboard.forEach((u, idx) => {
        const d = document.createElement('div'); d.className = 'row';
        d.style.alignItems = 'center'; d.style.justifyContent = 'space-between';
        d.style.padding = '6px 0';
        d.innerHTML = `<div style='display:flex;gap:8px;align-items:center'><img src='${u.avatar}' style='width:28px;height:28px;border-radius:6px'/> 
      <div><strong>${u.login}</strong><div class='small muted'>${u.followers} followers</div></div></div><div class='small muted'>#${idx+1}</div>`;
        box.appendChild(d);
    });
}

/* ANALYTICS & CHART */
function renderAnalytics(p) {
    const langs = p._langCount;
    const labels = Object.keys(langs);
    const data = Object.values(langs);
    if (!langChart) {
        const ctx = document.getElementById('langChart').getContext('2d');
        langChart = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data }] }, options: { plugins: { legend: { position: 'bottom' } } } });
    } else {
        langChart.data.labels = labels; langChart.data.datasets[0].data = data; langChart.update();
    }
    const avg = p._repos.length ? Math.round(p._repos.reduce((s, r) => s + r.stargazers_count, 0) / p._repos.length) : 0;
    el('avgStars').innerText = avg;
    const top = p._repos.slice().sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
    el('topRepo').innerText = top ? top.name : '—';
    const score = Math.round((p.followers * 0.3 + p.public_repos * 2 + (avg) * 1.5));
    el('devScore').innerText = score;
    const now = Date.now(); const recent = p._repos.filter(r => (now - new Date(r.updated_at)) / 86400000 < 14).length;
    el('streak').innerText = recent + ' updates (14d)';
    el('insightSummary').innerText = generateSummary(p, avg);
}

/* simple rule-based AI summary */
async function generateSummary(p, avgStars) {
    const prompt = `Summarize this GitHub profile: ${p.name || p.login}, main language ${Object.keys(p._langCount)[0]}. 
  ${p.followers} followers, ${p.public_repos} repos, average stars ${avgStars}. Write in 1 sentence.`;
    try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer YOUR_OPENAI_API_KEY"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 40
            })
        }).then(r => r.json());
        return r.choices?.[0]?.message?.content || "AI summary unavailable.";
    } catch (e) { console.warn(e); return "AI summary unavailable."; }
}

/* MAP (Nominatim geocoding + Leaflet) */
function renderMap(p) {
    try {
        if (!map) { map = L.map('map', { attributionControl: false }).setView([20, 0], 2); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); }
        const loc = p.location; if (!loc) { map.setView([20, 0], 2); return; }
        fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(loc)).then(r => r.json()).then(data => {
            if (data && data[0]) {
                const lat = data[0].lat, lon = data[0].lon;
                map.setView([lat, lon], 5);
                L.marker([lat, lon]).addTo(map).bindPopup(p.login + ' — ' + (p.location || '')).openPopup();
            }
        }).catch(e => console.warn(e));
    } catch (e) { console.warn(e); }
}

/* TIMELINE (recent repo updates) */
function renderTimeline(p) {
    const t = el('timeline'); t.innerHTML = '';
    const items = p._repos.slice(0, 8).map(r => ({ title: r.name, when: new Date(r.updated_at).toLocaleString(), desc: r.description || '' }));
    items.forEach(it => {
        const d = document.createElement('div'); d.className = 'small muted'; d.style.padding = '8px 0';
        d.innerHTML = `<strong>${it.title}</strong> — <span class='small muted'>${it.when}</span><div class='small muted'>${it.desc}</div>`;
        t.appendChild(d);
    });
}

/* MODAL helpers */
function openModal(html) { modal.classList.add('show'); modalPanel.innerHTML = html; }
function closeModal() { modal.classList.remove('show'); }

/* PINS */
el('pinBtn').addEventListener('click', () => {
    if (!lastProfile) return;
    if (!pinned.includes(lastProfile.login)) pinned.push(lastProfile.login);
    localStorage.setItem('devdetective_pinned', JSON.stringify(pinned));
    alert('Pinned ' + lastProfile.login);
});

/* DOWNLOAD JSON */
el('downloadJsonBtn').addEventListener('click', () => {
    if (!lastProfile) return;
    const data = JSON.stringify(lastProfile, null, 2); const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = lastProfile.login + '.json'; a.click(); URL.revokeObjectURL(url);
});

/* EXPORT DEV CARD (canvas to PNG) */
el('exportCardBtn').addEventListener('click', () => {
    if (!lastProfile) return;
    const c = document.createElement('canvas'); c.width = 1000; c.height = 520; const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f1724'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px monospace'; ctx.fillText(lastProfile.name || lastProfile.login, 160, 80);
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function () {
        ctx.drawImage(img, 40, 40, 100, 100);
        ctx.font = '16px monospace'; ctx.fillText('@' + lastProfile.login, 160, 120); ctx.font = '14px monospace';
        wrapText(ctx, lastProfile.bio || '', 160, 160, 760, 20);
        const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = lastProfile.login + '_card.png'; a.click();
    };
    img.src = lastProfile.avatar_url;
});

/* small text wrap helper */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) { ctx.fillText(line, x, y); line = words[n] + ' '; y += lineHeight; } else { line = testLine; }
    }
    ctx.fillText(line, x, y);
}

/* RESUME (open printable HTML) */
el('resumeBtn').addEventListener('click', () => {
    if (!lastProfile) return;
    const win = window.open('', '_blank');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Resume - ${lastProfile.name || lastProfile.login}</title>
  <style>body{font-family:monospace;padding:24px}h1{margin:0}</style></head><body>
  <h1>${lastProfile.name || lastProfile.login}</h1><p>${lastProfile.bio || ''}</p><p>Followers: ${lastProfile.followers} | Repos: ${lastProfile.public_repos}</p>
  <h3>Top repos</h3><ul>${lastProfile._repos.slice(0, 6).map(r => '<li>' + r.name + ' — ⭐' + r.stargazers_count + '</li>').join('')}</ul></body></html>`;
    win.document.write(html); win.document.close(); win.print();
});

/* BADGES */
el('badgeBtn').addEventListener('click', () => {
    if (!lastProfile) return;
    const badges = computeBadges(lastProfile); alert('Badges: ' + (badges.length ? badges.join(', ') : 'None'));
});
function computeBadges(p) {
    const out = [];
    if (p.public_repos > 30) out.push('Open Source Wizard');
    if (p.followers > 200) out.push('Popular');
    if (p.followers > 50 && p.public_repos > 10) out.push('Influencer');
    if ((p._repos || []).some(r => r.stargazers_count > 50)) out.push('Starred Repo');
    if (Object.keys(p._langCount).length > 3) out.push('Polyglot');
    return out;
}

/* COMMENTS (localStorage) */
let comments = JSON.parse(localStorage.getItem('devdetective_comments') || '{}');
el('commentToggle').addEventListener('click', () => {
    if (!lastProfile) return; const k = lastProfile.login; const c = comments[k] || [];
    openModal(`<h3>Comments for ${k}</h3><div id='cmtList'>${c.map(x => `<div style='padding:8px;border-bottom:1px solid #eee'>${x}</div>`).join('')}</div>
    <textarea id='cmtText' style='width:100%;height:80px'></textarea><div style='display:flex;gap:8px;margin-top:8px'><button id='addCmt'>Add</button><button id='closeC'>Close</button></div>`);
    document.getElementById('addCmt').onclick = () => { const t = document.getElementById('cmtText').value.trim(); if (!t) return; comments[k] = comments[k] || []; comments[k].unshift(t); localStorage.setItem('devdetective_comments', JSON.stringify(comments)); modal.classList.remove('show'); alert('Comment added'); };
    document.getElementById('closeC').onclick = () => modal.classList.remove('show');
});

/* COMPARE */
el('compareOpenBtn').addEventListener('click', () => {
    openModal(`<h3>Compare Developers</h3><input id='c1' placeholder='user1' style='padding:8px;margin-right:6px' /><input id='c2' placeholder='user2' style='padding:8px' />
    <div style='margin-top:8px'><button id='doCompare'>Compare</button></div><div id='cmpRes'></div>`);
    document.getElementById('doCompare').onclick = async () => {
        const u1 = document.getElementById('c1').value.trim(), u2 = document.getElementById('c2').value.trim();
        if (!u1 || !u2) return;
        const a = await fetch(API_ROOT + u1).then(r => r.json()); const b = await fetch(API_ROOT + u2).then(r => r.json());
        const html = `<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'><div><h4>${a.login}</h4><div>Followers: ${a.followers}</div><div>Repos: ${a.public_repos}</div></div>
      <div><h4>${b.login}</h4><div>Followers: ${b.followers}</div><div>Repos: ${b.public_repos}</div></div></div>
      <div style='margin-top:8px'><strong>Winner:</strong> ${ (a.followers + a.public_repos * 2) > (b.followers + b.public_repos * 2) ? a.login : b.login }</div>`;
        document.getElementById('cmpRes').innerHTML = html;
    };
});

/* THEME APPLY (mood) */
el('themeApplyBtn').addEventListener('click', () => { if (!lastProfile) return; const mainLang = Object.keys(lastProfile._langCount)[0] || 'Unknown'; applyMoodTheme(mainLang); });
function applyMoodTheme(lang) {
    if (['JavaScript', 'TypeScript'].includes(lang)) { document.documentElement.style.setProperty('--accent', '#f7df1e'); document.body.style.background = 'linear-gradient(180deg,#fff7d9,#fefae0)'; }
    else if (['Python'].includes(lang)) { document.documentElement.style.setProperty('--accent', '#306998'); document.body.style.background = 'linear-gradient(180deg,#eaf6ff,#e9f2ff)'; }
    else { document.documentElement.style.setProperty('--accent', '#0079ff'); document.body.style.background = 'linear-gradient(180deg,#eaf0ff,#f6f8ff)'; }
}
function openModal(html) { modal.classList.add('show'); modalPanel.innerHTML = html; }
startSearch('sudheerrrrit');
window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("loader").classList.add("hide");
    }, 2500);
});

