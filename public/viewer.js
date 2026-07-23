const _ioCache = new Map();
function _getIO(scrollRoot) {
  if (_ioCache.has(scrollRoot)) return _ioCache.get(scrollRoot);
  const io = new IntersectionObserver(entries => {
    for (const {isIntersecting, target} of entries) {
      if (!isIntersecting) continue;
      target.src = target.dataset.src;
      delete target.dataset.src;
      io.unobserve(target);
    }
  }, {root: scrollRoot, rootMargin: '300px'});
  _ioCache.set(scrollRoot, io);
  return io;
}
function observeLazy(queryRoot, scrollRoot) {
  const io = _getIO(scrollRoot);
  queryRoot.querySelectorAll('[data-src]').forEach(el => io.observe(el));
}

const ME = 'Jasper Lepardo';
let total = 0, searchQ = '', currentTab = 'chat';
let galType = 'photos', galOff = 0, galItems = [];
const LIMIT = 80, GLIMIT = 60;

const $ = id => document.getElementById(id);

// --- API ---
async function api(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// --- helpers ---
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
const encPath = uri => uri.split('/').map(encodeURIComponent).join('/');

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString([],{weekday:'short',year:'numeric',month:'long',day:'numeric'});
}

// --- message rendering ---
const R2 = 'https://pub-bcf374add91945839b65e3ee37ef410d.r2.dev';
function r2(uri) { return `${R2}/${encPath(uri)}`; }
function renderMedia(m) {
  const parts = [];
  if (m.photos)      for (const p of m.photos)      parts.push(`<img data-src="${r2(p.uri)}" onclick="lb('${r2(p.uri)}','photo')" onerror="this.remove()">`);
  if (m.videos)      for (const v of m.videos)      parts.push(`<video data-src="${r2(v.uri)}" controls preload="none"></video>`);
  if (m.audio_files) for (const a of m.audio_files) parts.push(`<audio data-src="${r2(a.uri)}" controls preload="none"></audio>`);
  if (m.gifs)        for (const g of m.gifs)        parts.push(`<img data-src="${r2(g.uri)}" onclick="lb('${r2(g.uri)}','gif')" onerror="this.remove()">`);
  if (m.sticker)     parts.push(`<div class="msg-stk"><img data-src="${r2(m.sticker.uri)}" onerror="this.remove()"></div>`);
  if (m.files)       for (const f of m.files) {
    const name = f.uri.split('/').pop();
    parts.push(`<div class="msg-flink">📎 <a href="${r2(f.uri)}" target="_blank">${esc(name)}</a></div>`);
  }
  if (m.share?.link) parts.push(`<div class="msg-shr">🔗 <a href="${esc(m.share.link)}" target="_blank" rel="noopener">${esc(m.share.link.slice(0,80))}${m.share.link.length>80?'…':''}</a></div>`);
  if (m.call_duration != null) {
    const ds = m.call_duration ? `${Math.floor(m.call_duration/60)}m ${m.call_duration%60}s` : '';
    parts.push(`<div class="msg-call">📞 ${m.missed ? 'Missed call' : `Call${ds?' · '+ds:''}`}</div>`);
  }
  if (m.reactions?.length) {
    const c = {};
    for (const r of m.reactions) c[r.reaction] = (c[r.reaction]||0)+1;
    parts.push('<div class="msg-rea">'+Object.entries(c).map(([r,n])=>r+(n>1?' '+n:'')).join(' ')+'</div>');
  }
  return parts.join('');
}

function renderMsgBody(m) {
  const med = renderMedia(m);
  const txt = m.is_unsent
    ? '<div class="msg-unsent">Message removed</div>'
    : (m.content ? `<div class="msg-text">${esc(m.content)}</div>` : '');
  return `<span id="msg-${m._id}" style="display:none"></span>` + txt + med;
}

let lastDate = null, lastSender = null, lastTs = 0;

function renderMessages(messages) {
  const blocks = [];
  for (const m of messages) {
    const d = fmtDate(m.timestamp_ms);
    const newDate = d !== lastDate;
    const grouped = !newDate
      && m.sender_name === lastSender
      && (m.timestamp_ms - lastTs) < 5 * 60 * 1000;
    if (newDate) lastDate = d;
    lastSender = m.sender_name;
    lastTs = m.timestamp_ms;
    if (grouped && blocks.length) {
      blocks[blocks.length - 1].msgs.push(m);
    } else {
      blocks.push({ date: d, newDate, sender: m.sender_name, mine: m.sender_name === ME, msgs: [m] });
    }
  }

  return blocks.map(b => {
    const sep = b.newDate ? `<div class="dsep"><span>${b.date}</span></div>` : '';
    const initial = (b.sender || '?')[0].toUpperCase();
    const ts = fmtTime(b.msgs[0].timestamp_ms);
    const body = b.msgs.map(renderMsgBody).join('');
    const ids = b.msgs.map(m => m._id).join(',');
    return `${sep}<div class="msg-group" data-id="${b.msgs[0]._id}" data-ids="${ids}" data-ts="${b.msgs[0].timestamp_ms}" data-ts-end="${b.msgs[b.msgs.length-1].timestamp_ms}">
      <div class="avatar ${b.mine?'me':'them'}">${initial}</div>
      <div class="msg-content">
        <div class="msg-header">
          <span class="msg-sender${b.mine?' me':''}">${esc(b.sender)}</span>
          <span class="msg-ts">${ts}</span>
        </div>
        ${body}
      </div>
      <input type="checkbox" class="msg-check">
    </div>`;
  }).join('');
}

// --- chat loading ---
let lowerOffset = 0, upperOffset = 0;
let hasMore = false;
const MAX_DOM = LIMIT * 2;
const LOAD_THRESHOLD = 500;

function _cullMsgGroups(container, fromBottom, n) {
  let removed = 0;
  while (removed < n) {
    const el = fromBottom ? container.lastElementChild : container.firstElementChild;
    if (!el) break;
    if (el.classList.contains('msg-group')) { selectedMsgs.delete(el.dataset.id); removed++; }
    container.removeChild(el);
  }
  updateSelBar();
}

function cullBottom() {
  const excess = $('msgs').querySelectorAll('.msg-group').length - MAX_DOM;
  if (excess <= 0) return;
  _cullMsgGroups($('msgs'), true, excess);
  upperOffset -= excess;
}

function cullTop() {
  const excess = $('msgs').querySelectorAll('.msg-group').length - MAX_DOM;
  if (excess <= 0) return;
  const chatEl = $('chat');
  const prevH = chatEl.scrollHeight, prevTop = chatEl.scrollTop;
  _cullMsgGroups($('msgs'), false, excess);
  lowerOffset += excess;
  chatEl.scrollTop = prevTop - (prevH - chatEl.scrollHeight);
}

async function loadMessages(append = false, prepend = false) {
  const fetchOffset = prepend ? lowerOffset : (append ? upperOffset : lowerOffset);
  const params = new URLSearchParams({offset: fetchOffset, limit: LIMIT, asc: 1});
  if (searchQ) { params.delete('asc'); params.set('offset', 0); params.set('search', searchQ); }
  const data = await api('/api/messages?' + params);
  total = data.total;
  hasMore = !!(data.has_more && !searchQ);
  $('count').textContent = total.toLocaleString() + ' messages';

  const container = $('msgs');
  const count = data.messages.length;

  if (prepend) {
    const saved = [lastDate, lastSender, lastTs];
    lastDate = null; lastSender = null; lastTs = 0;
    const html = renderMessages(data.messages);
    [lastDate, lastSender, lastTs] = saved;
    const chatEl = $('chat');
    const prevH = chatEl.scrollHeight, prevTop = chatEl.scrollTop;
    container.insertAdjacentHTML('afterbegin', html);
    observeLazy(container, chatEl);
    chatEl.scrollTop = prevTop + (chatEl.scrollHeight - prevH);
    cullBottom();
  } else if (append) {
    container.insertAdjacentHTML('beforeend', renderMessages(data.messages));
    observeLazy(container, $('chat'));
    upperOffset += count;
    cullTop();
  } else {
    lastDate = null; lastSender = null; lastTs = 0;
    container.innerHTML = renderMessages(data.messages);
    observeLazy(container, $('chat'));
    upperOffset = lowerOffset + count;
    $('chat').scrollTop = 0;
  }
  updateStickyDate();
}

async function loadOlder() {
  if (lowerOffset === 0) return;
  lowerOffset = Math.max(0, lowerOffset - LIMIT);
  await loadMessages(false, true);
}

async function loadNewer() {
  await loadMessages(true);
}

async function jumpToEnd() {
  lowerOffset = Math.max(0, total - LIMIT);
  upperOffset = lowerOffset;
  searchQ = '';
  $('search').value = '';
  lastDate = null;
  await loadMessages(false);
  $('chat').scrollTop = $('chat').scrollHeight;
}

// --- gallery ---
function renderGalleryItems(items) {
  const grid = $('gallery').querySelector('.ggrid');
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'gitem';
    div.dataset.ts = item.ts;
    if (item.msgId) div.dataset.msgId = item.msgId;
    if (galType === 'photos') {
      div.innerHTML = `<img data-src="${r2(item.uri)}" onerror="this.closest('.gitem').remove()">`;
      div.onclick = () => lb(r2(item.uri), 'photo', new Date(item.ts).toLocaleDateString()+' · '+esc(item.sender));
    } else {
      div.innerHTML = `<video data-src="${r2(item.uri)}" preload="none"></video>`;
      div.onclick = () => lb(r2(item.uri), 'video', new Date(item.ts).toLocaleDateString()+' · '+esc(item.sender));
    }
    grid.appendChild(div);
  }
}

let galLoading = false, galHasMore = true, _galIO = null;

function _attachGalSentinel() {
  if (_galIO) _galIO.disconnect();
  const sentinel = document.createElement('div');
  sentinel.id = 'gal-sentinel';
  $('gallery').appendChild(sentinel);
  _galIO = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) loadGallery(false);
  }, {root: $('gallery'), rootMargin: '300px'});
  _galIO.observe(sentinel);
}

async function loadGallery(reset = false) {
  if (reset) {
    galOff = 0; galItems = []; galHasMore = true;
    $('gallery').innerHTML = '<div class="ggrid"></div>';
    _attachGalSentinel();
  }
  if (!galHasMore || galLoading) return;
  galLoading = true;
  try {
    const data = await api(`/api/attachments?type=${galType}&offset=${galOff}&limit=${GLIMIT}`);
    galItems.push(...data.items);
    renderGalleryItems(data.items);
    observeLazy($('gallery'), $('gallery'));
    galHasMore = data.has_more;
    galOff += GLIMIT;
  } finally {
    galLoading = false;
  }
}

// --- files & audio ---
async function loadFiles() {
  const [fd, ad] = await Promise.all([
    api('/api/attachments?type=files&offset=0&limit=500'),
    api('/api/attachments?type=audio&offset=0&limit=500'),
  ]);
  const all = [
    ...fd.items.map(i=>({...i,kind:'file'})),
    ...ad.items.map(i=>({...i,kind:'audio'})),
  ].sort((a,b)=>b.ts-a.ts);

  if (!all.length) { $('fview').innerHTML = '<p style="padding:20px;color:#65676b">No files found.</p>'; return; }
  $('fview').innerHTML = all.map(item=>{
    const name = item.uri.split('/').pop();
    const icon = item.kind==='audio' ? '🎵' : (name.match(/\.pdf$/i)?'📄':name.match(/\.(jpg|jpeg|png|gif|webp)$/i)?'🖼':'📎');
    return `<div class="fitem">
      <div class="fico">${icon}</div>
      <div class="fmeta">
        <div class="fname"><a href="${r2(item.uri)}" target="_blank">${esc(name)}</a></div>
        <div class="fdate">${new Date(item.ts).toLocaleDateString()} · ${esc(item.sender)}</div>
      </div>
    </div>`;
  }).join('');
}

// --- lightbox ---
function lb(src, type, caption='') {
  const inner = $('lbinner');
  if (type === 'video') {
    inner.innerHTML = `<video src="${src}" controls autoplay style="max-width:92vw;max-height:88vh;border-radius:4px"></video>`;
  } else {
    inner.innerHTML = `<img src="${src}" alt="">`;
  }
  $('lbcap').textContent = caption;
  $('lb').classList.add('on');
}
function closeLb() { $('lb').classList.remove('on'); $('lbinner').innerHTML = ''; }

// --- tabs ---
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  currentTab = t.dataset.tab;
  $('chat').style.display    = 'none';
  $('gallery').style.display = 'none';
  $('fview').style.display   = 'none';
  $('sticky-date').style.opacity = '0';
  if (currentTab==='chat')   { $('chat').style.display='flex'; $('chat').style.flexDirection='column'; updateStickyDate(); }
  if (currentTab==='photos') { $('gallery').style.display='block'; galType='photos'; loadGallery(true); }
  if (currentTab==='videos') { $('gallery').style.display='block'; galType='videos'; loadGallery(true); }
  if (currentTab==='files')  { $('fview').style.display='block'; loadFiles(); }
}));

// --- search ---
let stimer;
$('search').addEventListener('input', e => {
  clearTimeout(stimer);
  stimer = setTimeout(async ()=>{
    searchQ = e.target.value.trim();
    lowerOffset = 0; upperOffset = 0;
    lastDate = null;
    $('searching').style.display = searchQ ? '' : 'none';
    await loadMessages(false);
    $('searching').style.display = 'none';
  }, 350);
});

// --- date jump ---
$('date-jump').addEventListener('change', async e => {
  const date = e.target.value;
  if (!date) return;
  const data = await api('/api/jump?date=' + date);
  if (data.index != null) {
    lowerOffset = Math.max(0, data.index - Math.floor(LIMIT/2));
    upperOffset = lowerOffset;
    searchQ = '';
    $('search').value = '';
    lastDate = null;
    await loadMessages(false);
  }
});

// --- notes ---
let allNotes = [], activeNoteIdx = null;

const TAG_COLORS = {
  'milestone':'#1d4ed8','religion':'#6d28d9','jealousy':'#c2410c',
  'conflict':'#b91c1c','pattern':'#9d174d','foreshadowing':'#854d0e',
  'travel':'#15803d','money':'#b45309','friendship':'#0f766e',
  'social':'#0369a1','work':'#475569','wedding-planning':'#be185d',
  'first-contact':'#1e40af','first-date':'#1e40af','getting-to-know':'#166534'
};

const TAG_LABELS = {
  'milestone':'Milestone','religion':'Religion','jealousy':'Jealousy',
  'conflict':'Conflict','pattern':'Pattern','foreshadowing':'Foreshadowing',
  'travel':'Travel','money':'Money','friendship':'Friendship','social':'Social',
  'work':'Work','wedding-planning':'Wedding','first-contact':'First Contact',
  'first-date':'First Date','getting-to-know':'Getting to Know'
};

function hasTime(iso) { return iso && iso.includes('T'); }

function fmtIso(iso) {
  if (!iso) return '';
  const dateStr = iso.split('T')[0];
  const d = new Date(dateStr + 'T00:00:00');
  const datePart = d.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'});
  if (!hasTime(iso)) return datePart;
  const [h, m] = iso.split('T')[1].split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return datePart + ' · ' + h12 + ':' + String(m).padStart(2,'0') + ' ' + ampm;
}

function fmtDateRange(start, end) {
  if (start === end) return fmtIso(start);
  const sd = start.split('T')[0], ed = end ? end.split('T')[0] : sd;
  if (sd === ed) {
    const d = new Date(sd + 'T00:00:00').toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'});
    if (!hasTime(start) && !hasTime(end)) return d;
    const fmtT = iso => { const [h,m] = iso.split('T')[1].split(':').map(Number); const ap = h>=12?'PM':'AM'; return (h%12||12)+':'+String(m).padStart(2,'0')+' '+ap; };
    const t1 = hasTime(start) ? fmtT(start) : '';
    const t2 = hasTime(end)   ? fmtT(end)   : '';
    return d + (t1||t2 ? ' · ' + [t1,t2].filter(Boolean).join(' – ') : '');
  }
  const s = new Date(sd+'T00:00:00'), e = new Date(ed+'T00:00:00');
  if (s.getMonth()===e.getMonth() && s.getFullYear()===e.getFullYear()) {
    return s.toLocaleDateString([],{month:'short',day:'numeric'}) + ' – ' + e.toLocaleDateString([],{day:'numeric',year:'numeric'});
  }
  return fmtIso(start) + ' – ' + fmtIso(end);
}

function renderNotes(notes) {
  const body = $('notes-body');
  if (!notes.length) { body.innerHTML = '<p style="padding:16px;color:#65676b;font-size:13px">No notes match.</p>'; return; }
  body.innerHTML = notes.map((n, i) => {
    const accentColor = TAG_COLORS[n.tags[0]] || '#e4e6ea';
    const tagText = n.tags.map(t => TAG_LABELS[t] || t).join(' · ');
    const bodyHtml = esc(n.body).replace(/\n/g, '<br>');
    const dateRange = fmtDateRange(n.start, n.end);
    const firstMsgId = (n.msgIds || '').split(',').filter(Boolean)[0] || '';
    const jumpBtn = firstMsgId
      ? `<button class="jump-btn" data-msgid="${firstMsgId}">→ Message</button>`
      : `<button class="jump-btn" data-start="${n.start}" data-end="${n.end || n.start}">→ Chat</button>`;
    const editor = n.updatedBy?.email || n.createdBy?.email || '';
    return `<div class="note-card" data-idx="${i}" data-id="${n.id}" data-start="${n.start}" data-end="${n.end || ''}" data-msgid="${firstMsgId}" style="border-left-color:${accentColor}">
      <div class="note-date">
        <span>${dateRange}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${editor ? `<span style="font-size:10px;color:#aaa">${esc(editor.split('@')[0])}</span>` : ''}
          <button class="note-edit-btn" data-id="${n.id}">✏</button>
          ${jumpBtn}
        </div>
      </div>
      <div class="note-tags">${tagText}</div>
      <div class="note-title">${esc(n.title)}</div>
      <div class="note-body">${bodyHtml}</div>
    </div>`;
  }).join('');
}

// event delegation
document.addEventListener('click', async function(e) {
  const group = e.target.closest('.msg-group');
  if (group && !e.target.closest('a,button,audio,video,img')) {
    const check = group.querySelector('.msg-check');
    check.checked = !check.checked;
    if (check.checked) {
      selectedMsgs.set(group.dataset.id, {ts: +group.dataset.ts, tsEnd: +(group.dataset.tsEnd || group.dataset.ts)});
      group.classList.add('selected');
    } else {
      selectedMsgs.delete(group.dataset.id);
      group.classList.remove('selected');
    }
    updateSelBar();
    return;
  }
  const jumpBtn = e.target.closest('.jump-btn');
  if (jumpBtn) {
    e.stopPropagation();
    if (jumpBtn.dataset.msgid) await jumpToMessage(0, jumpBtn.dataset.msgid);
    else await jumpToDate(jumpBtn.dataset.start);
    return;
  }
  const editBtn = e.target.closest('.note-edit-btn');
  if (editBtn) {
    e.stopPropagation();
    const note = allNotes.find(n => String(n.id) === editBtn.dataset.id);
    if (note) openNoteModal(note);
    return;
  }
  const card = e.target.closest('.note-card');
  if (card) {
    document.querySelectorAll('.note-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    if (card.dataset.msgid) await jumpToMessage(0, card.dataset.msgid);
    else await jumpToDate(card.dataset.start);
  }
});

async function jumpToDate(date) {
  if (currentTab !== 'chat') document.querySelector('.tab[data-tab="chat"]').click();
  $('chat').style.display = 'flex';
  $('chat').style.flexDirection = 'column';
  const data = await api('/api/jump?date=' + date);
  if (data.index == null) return;
  lowerOffset = Math.max(0, data.index - Math.floor(LIMIT / 2));
  upperOffset = lowerOffset;
  searchQ = ''; $('search').value = ''; lastDate = null; lastSender = null; lastTs = 0;
  await loadMessages(false);
}

async function jumpToMessage(ts, msgId = null) {
  if (currentTab !== 'chat') document.querySelector('.tab[data-tab="chat"]').click();
  $('chat').style.display = 'flex';
  $('chat').style.flexDirection = 'column';
  const url = msgId ? `/api/jump?msgId=${msgId}` : `/api/jump?date=${new Date(ts).toISOString()}`;
  const data = await api(url);
  if (data.index == null) return;
  lowerOffset = Math.max(0, data.index - Math.floor(LIMIT / 2));
  upperOffset = lowerOffset;
  searchQ = ''; $('search').value = ''; lastDate = null; lastSender = null; lastTs = 0;
  await loadMessages(false);
  const anchor = msgId ? document.getElementById('msg-' + msgId) : null;
  const target = anchor ? anchor.closest('.msg-group') : null;
  if (!target) return;
  target.scrollIntoView({block: 'center'});
  target.style.background = '#fff3cd';
  setTimeout(() => { target.style.transition = 'background 1s'; target.style.background = ''; }, 800);
  setTimeout(() => { target.style.transition = ''; }, 1800);
}

function filterNotes(q) {
  const lq = q.toLowerCase();
  const filtered = allNotes.filter(n =>
    !lq || n.tags.some(t => t.includes(lq)) || n.title.toLowerCase().includes(lq) || n.body.toLowerCase().includes(lq)
  );
  renderNotes(filtered);
}

// --- message selection ---
const selectedMsgs = new Map();

function updateSelBar() {
  const n = selectedMsgs.size;
  if (!n) { $('sel-bar').style.display = 'none'; return; }
  $('sel-bar').style.display = 'flex';
  $('sel-count').textContent = n + ' message' + (n > 1 ? 's' : '') + ' selected';
}

function clearSelection() {
  selectedMsgs.clear();
  document.querySelectorAll('.msg-group.selected').forEach(g => {
    g.classList.remove('selected');
    const cb = g.querySelector('.msg-check');
    if (cb) cb.checked = false;
  });
  updateSelBar();
}

let _noteFromMsgIds = [];

function openNoteFromSelection() {
  _noteFromMsgIds = [...selectedMsgs.keys()];
  const vals = [...selectedMsgs.values()];
  const pad = n => String(n).padStart(2,'0');
  const toLocal = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const firstTs = Math.min(...vals.map(v => v.ts));
  const lastTs  = Math.max(...vals.map(v => v.tsEnd));
  openNoteModal(null);
  $('nf-start').value = toLocal(firstTs);
  $('nf-end').value   = toLocal(lastTs);
}

// --- note modal ---
const ALL_TAGS = [
  'milestone','religion','jealousy','conflict','pattern','foreshadowing',
  'travel','money','friendship','social','work','wedding-planning',
  'first-contact','first-date','getting-to-know'
];

let _editingId = null;

function openNoteModal(note) {
  _editingId = note ? note.id : null;
  if (note) _noteFromMsgIds = (note.msgIds || '').split(',').filter(Boolean);
  $('note-dlg-h').textContent = note ? 'Edit Note' : 'New Note';
  if (_noteFromMsgIds.length) {
    $('nf-msgs-row').style.display = '';
    $('nf-msgs').textContent = _noteFromMsgIds.length + ' message' + (_noteFromMsgIds.length > 1 ? 's' : '') + ' linked';
  } else {
    $('nf-msgs-row').style.display = 'none';
  }
  $('nf-start').value  = note ? (note.start || '') : '';
  $('nf-end').value    = note ? (note.end   || '') : '';
  $('nf-title').value  = note ? (note.title || '') : '';
  $('nf-body').value   = note ? (note.body  || '') : '';
  const activeTags = note ? (note.tags || []) : [];
  $('nf-tags').innerHTML = ALL_TAGS.map(t =>
    `<span class="tag-chip${activeTags.includes(t)?' on':''}" data-tag="${t}">${t}</span>`
  ).join('');
  $('nf-tags').querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('on'));
  });
  $('nf-delete').style.visibility = note ? 'visible' : 'hidden';
  $('note-modal').classList.add('on');
  $('nf-title').focus();
}

function closeNoteModal() {
  $('note-modal').classList.remove('on');
  _editingId = null;
}

async function saveNote() {
  const btn = $('nf-save');
  btn.disabled = true;
  const payload = {
    start: $('nf-start').value.trim(),
    end:   $('nf-end').value.trim() || null,
    title: $('nf-title').value.trim(),
    body:  $('nf-body').value.trim(),
    tags:  [...$('nf-tags').querySelectorAll('.tag-chip.on')].map(c => c.dataset.tag),
    msgIds: _noteFromMsgIds.length ? _noteFromMsgIds.join(',') : null,
  };
  try {
    if (_editingId) {
      await fetch(`/api/notes/${_editingId}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    } else {
      await fetch('/api/notes', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    }
    closeNoteModal();
    clearSelection();
    _noteFromMsgIds = [];
    allNotes = (await api('/api/notes?limit=500&sort=start&depth=1')).docs || [];
    filterNotes($('notes-filter').value);
  } catch(err) {
    alert('Save failed: ' + err);
  } finally {
    btn.disabled = false;
  }
}

async function deleteNote() {
  if (!_editingId || !confirm('Delete this note?')) return;
  try {
    await fetch(`/api/notes/${_editingId}`, {method:'DELETE'});
    closeNoteModal();
    allNotes = (await api('/api/notes?limit=500&sort=start&depth=1')).docs || [];
    filterNotes($('notes-filter').value);
  } catch(err) {
    alert('Delete failed: ' + err);
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeNoteModal();
    closeCtxMenu();
  }
});

// --- context menu ---
let _ctxNote = null, _ctxGalTs = null, _ctxGalMsgId = null;

function closeCtxMenu() { $('ctx-menu').classList.remove('on'); _ctxNote = null; _ctxGalTs = null; _ctxGalMsgId = null; }

function _showCtxMenu(x, y) {
  const menu = $('ctx-menu');
  menu.classList.add('on');
  menu.style.left = Math.min(x, window.innerWidth  - menu.offsetWidth  - 8) + 'px';
  menu.style.top  = Math.min(y, window.innerHeight - menu.offsetHeight - 8) + 'px';
}

document.addEventListener('contextmenu', e => {
  const gitem = e.target.closest('.gitem');
  if (gitem) {
    e.preventDefault();
    _ctxGalTs    = gitem.dataset.ts;
    _ctxGalMsgId = gitem.dataset.msgId || null;
    _ctxNote     = null;
    $('ctx-edit').style.display = 'none';
    $('ctx-goto').style.display = '';
    _showCtxMenu(e.clientX, e.clientY);
    return;
  }
  const card = e.target.closest('.note-card');
  if (card) {
    e.preventDefault();
    _ctxNote = allNotes.find(n => String(n.id) === card.dataset.id);
    if (!_ctxNote) return;
    _ctxGalTs = null;
    $('ctx-edit').style.display = '';
    $('ctx-goto').style.display = 'none';
    _showCtxMenu(e.clientX, e.clientY);
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#ctx-menu')) closeCtxMenu();
}, true);

// --- resizable notes panel ---
(function() {
  const resizer = $('resizer');
  const pane = $('notes-pane');
  let startX, startW;
  resizer.addEventListener('mousedown', e => {
    startX = e.clientX;
    startW = pane.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });
  document.addEventListener('mousemove', e => {
    if (!resizer.classList.contains('dragging')) return;
    const delta = startX - e.clientX;
    const newW = Math.max(220, Math.min(window.innerWidth * 0.6, startW + delta));
    pane.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', () => {
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
})();

// --- sticky date ---
function updateStickyDate() {
  if (currentTab !== 'chat') return;
  const chatEl = $('chat');
  const chatTop = chatEl.getBoundingClientRect().top;
  const seps = $('msgs').querySelectorAll('.dsep');
  let current = null;
  for (const sep of seps) {
    if (sep.getBoundingClientRect().top <= chatTop + 2) {
      current = sep.textContent.trim();
    } else {
      break;
    }
  }
  const el = $('sticky-date');
  if (current) {
    el.querySelector('span').textContent = current;
    el.style.opacity = '1';
  } else {
    el.style.opacity = '0';
  }
}

// --- device ID ---
const _deviceId = (() => {
  let id = localStorage.getItem('deviceId');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id); }
  return id;
})();

// --- anchor / bookmark ---
function getAnchor() {
  const chatRect = $('chat').getBoundingClientRect();
  for (const g of $('msgs').querySelectorAll('.msg-group')) {
    const rect = g.getBoundingClientRect();
    if (rect.bottom > chatRect.top) {
      return { msgId: g.dataset.id, offset: Math.max(0, rect.top - chatRect.top) };
    }
  }
  return null;
}

let _bkLast = 0;
function maybeSaveBookmark() {
  const now = Date.now();
  if (now - _bkLast < 300) return;
  _bkLast = now;
  const anchor = getAnchor();
  if (anchor) fetch('/api/bookmark', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...anchor, deviceId: _deviceId})}).catch(()=>{});
}

// --- infinite scroll ---
let loading = false;
$('chat').addEventListener('scroll', () => {
  updateStickyDate();
  if (currentTab === 'chat' && !searchQ) maybeSaveBookmark();
  if (loading || searchQ || currentTab !== 'chat') return;
  const el = $('chat');
  if (el.scrollTop < LOAD_THRESHOLD && lowerOffset > 0) {
    loading = true;
    loadOlder().finally(() => { loading = false; });
  }
  if (el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMore) {
    loading = true;
    loadNewer().finally(() => { loading = false; });
  }
});

// --- init ---
async function initChat() {
  let startIdx = 0, anchorMsgId = null, anchorOffset = 0;
  try {
    const bk = await api('/api/bookmark?deviceId=' + _deviceId);
    if (bk.msgId) {
      anchorMsgId = bk.msgId;
      anchorOffset = bk.offset ?? 0;
      const jd = await api('/api/jump?msgId=' + bk.msgId);
      if (jd.index != null) startIdx = jd.index;
    }
  } catch(e) {}
  lowerOffset = Math.max(0, startIdx - Math.floor(LIMIT / 2));
  upperOffset = lowerOffset;
  lastDate = null; lastSender = null; lastTs = 0;
  try {
    await loadMessages(false);
  } catch(e) {
    console.error('loadMessages failed:', e);
  }
  if (anchorMsgId) {
    const anchor = document.getElementById('msg-' + anchorMsgId)?.closest('.msg-group');
    if (anchor) {
      const chatEl = $('chat');
      chatEl.scrollTop = 0;
      const chatRect = chatEl.getBoundingClientRect();
      chatEl.scrollTop = anchor.getBoundingClientRect().top - chatRect.top - anchorOffset;
    }
  }
  $('chat').style.visibility = '';
  const el = $('chat');
  if (el.scrollTop + el.clientHeight > el.scrollHeight - LOAD_THRESHOLD && hasMore) {
    loading = true;
    loadNewer().finally(() => { loading = false; });
  }
}

// --- wire up UI event listeners (replaces inline onclick handlers) ---
function initUI() {
  $('lb').addEventListener('click', e => { if (e.target === $('lb')) closeLb(); });
  $('lbclose').addEventListener('click', closeLb);
  $('ctx-edit').addEventListener('click', () => { const n = _ctxNote; closeCtxMenu(); if (n) openNoteModal(n); });
  $('ctx-goto').addEventListener('click', () => { const ts = _ctxGalTs, msgId = _ctxGalMsgId; closeCtxMenu(); if (ts) jumpToMessage(+ts, msgId); });
  $('sel-note-btn').addEventListener('click', openNoteFromSelection);
  $('sel-clear-btn').addEventListener('click', clearSelection);
  $('notes-filter').addEventListener('input', e => filterNotes(e.target.value));
  $('notes-new-btn').addEventListener('click', () => openNoteModal(null));
  $('note-modal-bg').addEventListener('click', closeNoteModal);
  $('nf-delete').addEventListener('click', deleteNote);
  $('nf-cancel').addEventListener('click', closeNoteModal);
  $('nf-save').addEventListener('click', saveNote);
}

initUI();
initChat();
api('/api/notes?limit=500&sort=start&depth=1').then(data => { allNotes = data.docs || data; renderNotes(allNotes); });
