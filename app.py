#!/usr/bin/env python3
"""Facebook Messenger conversation viewer — Jasper & Ciara Fei"""

import json
import os
import urllib.request
import urllib.error
from datetime import datetime
from flask import Flask, request, jsonify, Response
from pymongo import MongoClient, ASCENDING
from bson import ObjectId

app = Flask(__name__)

PAYLOAD_BASE = os.environ.get("PAYLOAD_BASE", "http://localhost:3001")
PAYLOAD_NOTES_URL = f"{PAYLOAD_BASE}/api/notes?limit=500&sort=start&depth=0"

# Credentials for Payload write proxy — set via env vars or edit here directly.
PAYLOAD_EMAIL    = os.environ.get("PAYLOAD_EMAIL", "jsprlprd@gmail.com")
PAYLOAD_PASSWORD = os.environ.get("PAYLOAD_PASSWORD", "JLDesign@0593")

_payload_token = None


def _payload_login():
    global _payload_token
    body = json.dumps({"email": PAYLOAD_EMAIL, "password": PAYLOAD_PASSWORD}).encode()
    req = urllib.request.Request(
        f"{PAYLOAD_BASE}/api/users/login",
        data=body, headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        _payload_token = json.loads(r.read()).get("token")


def payload_request(method, path, body=None):
    """Authenticated request to Payload; re-logins once on 401."""
    global _payload_token
    if not _payload_token:
        _payload_login()

    def _do():
        headers = {"Content-Type": "application/json", "Authorization": f"JWT {_payload_token}"}
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"{PAYLOAD_BASE}/api{path}", data=data, headers=headers, method=method)
        return urllib.request.urlopen(req, timeout=5)

    try:
        with _do() as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        if e.code == 401:
            _payload_login()
            with _do() as r:
                return json.loads(r.read()), r.status
        raise


def fetch_notes():
    """Fetch notes from Payload CMS."""
    try:
        with urllib.request.urlopen(PAYLOAD_NOTES_URL, timeout=3) as resp:
            data = json.loads(resp.read())
        docs = data.get("docs", [])
        return [{k: v for k, v in d.items() if k in ("id", "start", "end", "tags", "title", "body")} for d in docs]
    except Exception:
        return []

MONGODB_URI = os.environ.get(
    "MONGODB_URI",
    "mongodb+srv://jsprlprd_db_user:eQ5igx90btLzSAcB@cluster0.pyqf6ob.mongodb.net/ciara-notes?retryWrites=true&w=majority&appName=Cluster0"
)

_mongo = MongoClient(MONGODB_URI)
_msgs  = _mongo["ciara-notes"]["messages"]
MSG_TOTAL = _msgs.estimated_document_count()


def _clean(doc):
    """Convert ObjectId _id to string for JSON serialization."""
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jasper &amp; Ciara</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#fff;height:100vh;display:flex;flex-direction:column;overflow:hidden}

/* header */
#hdr{background:#0866ff;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 2px 6px rgba(0,0,0,.25);z-index:10;flex-shrink:0}
#hdr h1{font-size:17px;font-weight:700;flex:1}
#search{padding:7px 14px;border-radius:20px;border:none;background:rgba(255,255,255,.2);color:#fff;width:200px;font-size:13px;outline:none}
#search::placeholder{color:rgba(255,255,255,.65)}
#search:focus{background:rgba(255,255,255,.3)}
#date-jump{padding:6px 10px;border-radius:8px;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:12px;outline:none;cursor:pointer}
#date-jump::-webkit-calendar-picker-indicator{filter:invert(1)}
#count{font-size:12px;color:rgba(255,255,255,.75);white-space:nowrap}

/* tabs */
#tabs{background:#fff;display:flex;border-bottom:2px solid #e4e6ea;flex-shrink:0}
.tab{padding:10px 22px;cursor:pointer;font-size:13px;font-weight:600;color:#65676b;border-bottom:3px solid transparent;margin-bottom:-2px;user-select:none}
.tab.on{color:#0866ff;border-bottom-color:#0866ff}
.tab:hover{background:#f0f2f5}

/* main area */
#view{flex:1;overflow:hidden;display:flex;flex-direction:row;min-height:0}
#chat-pane{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}

/* --- chat --- */
#chat{flex:1;overflow-y:auto;padding:8px 0 16px;display:flex;flex-direction:column;min-height:0;scroll-behavior:smooth;overflow-anchor:none}

/* --- resize handle --- */
#resizer{width:5px;background:#e4e6ea;cursor:col-resize;flex-shrink:0;transition:background .15s}
#resizer:hover,#resizer.dragging{background:#0866ff}

/* --- notes panel --- */
#notes-pane{width:50%;min-width:220px;display:flex;flex-direction:column;background:#fff;flex-shrink:0}
#notes-hdr{padding:10px 14px;border-bottom:1px solid #e4e6ea;font-size:13px;font-weight:700;color:#050505;display:flex;align-items:center;gap:8px;flex-shrink:0}
#notes-hdr span{flex:1}
#notes-filter{padding:4px 8px;font-size:12px;border:1px solid #ddd;border-radius:12px;outline:none;width:120px}
#notes-body{flex:1;overflow-y:auto;padding:12px 10px}
.note-card{border-left:3px solid #e4e6ea;padding:6px 10px;margin-bottom:14px;cursor:pointer;transition:background .1s,border-color .1s}
.note-card:hover{background:#f8f8f8}
.note-card.active{background:#f0f7ff;border-left-color:#0866ff}
.note-date{font-size:11px;color:#888;display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.note-date .jump-btn{font-size:11px;color:#0866ff;background:none;border:none;cursor:pointer;padding:0;opacity:.7}
.note-date .jump-btn:hover{opacity:1;text-decoration:underline}
.note-tags{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.note-title{font-size:13px;font-weight:700;color:#1d1c1d;margin-bottom:4px}
.note-body{font-size:12px;color:#555;line-height:1.55}
.note-edit-btn{font-size:11px;color:#aaa;background:none;border:none;cursor:pointer;padding:0 2px;opacity:0;transition:opacity .1s;flex-shrink:0}
.note-card:hover .note-edit-btn{opacity:1}
.note-edit-btn:hover{color:#0866ff}
/* context menu */
#ctx-menu{position:fixed;display:none;background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.18);padding:4px 0;min-width:130px;z-index:300;font-size:13px}
#ctx-menu.on{display:block}
.ctx-item{padding:6px 14px;cursor:pointer;color:#1d1c1d;user-select:none}
.ctx-item:hover{background:#f0f2f5}
/* --- note modal --- */
#note-modal{display:none;position:fixed;inset:0;z-index:200;align-items:center;justify-content:center}
#note-modal.on{display:flex}
#note-modal-bg{position:absolute;inset:0;background:rgba(0,0,0,.45)}
#note-dlg{position:relative;background:#fff;border-radius:10px;padding:22px 24px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.3)}
#note-dlg h2{font-size:15px;font-weight:700;color:#050505;margin-bottom:16px}
.nf{margin-bottom:13px}
.nf label{display:block;font-size:11px;font-weight:700;color:#65676b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.nf input,.nf textarea{width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s}
.nf input:focus,.nf textarea:focus{border-color:#0866ff}
#nf-body{min-height:90px;resize:vertical;line-height:1.5}
.tag-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}
.tag-chip{padding:3px 10px;border:1px solid #ddd;border-radius:12px;font-size:11px;cursor:pointer;user-select:none;text-transform:uppercase;letter-spacing:.3px;transition:background .1s,border-color .1s,color .1s}
.tag-chip.on{background:#0866ff;border-color:#0866ff;color:#fff}
#nf-footer{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid #e4e6ea}
#nf-delete{padding:7px 14px;border:1px solid #e53e3e;color:#e53e3e;background:none;border-radius:6px;font-size:13px;cursor:pointer}
#nf-delete:hover{background:#fff5f5}
.nf-right{display:flex;gap:8px}
#nf-cancel{padding:7px 14px;border:1px solid #ddd;background:none;border-radius:6px;font-size:13px;cursor:pointer;color:#65676b}
#nf-save{padding:7px 18px;background:#0866ff;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer}
#nf-save:hover{background:#0757d9}
#nf-save:disabled{opacity:.5;cursor:default}
#oldbtn,#loadbtn{text-align:center;padding:10px 0 6px;display:none}
#oldbtn button,#loadbtn button{background:#fff;border:1px solid #ddd;padding:7px 18px;border-radius:18px;cursor:pointer;font-size:13px;color:#65676b}
#oldbtn button:hover,#loadbtn button:hover{background:#f0f2f5}
#searching{text-align:center;padding:8px;font-size:13px;color:#65676b;display:none}

/* date separator */
.dsep{text-align:center;margin:20px 0 8px;font-size:12px;color:#616061;position:relative}
.dsep::before{content:'';position:absolute;top:50%;left:0;right:0;border-top:1px solid #e8e8e8}
.dsep span{background:#f0f2f5;padding:0 10px;position:relative;font-weight:600}

/* message group — contains all messages from same sender block */
.msg-group{display:flex;padding:8px 20px;gap:12px;align-items:flex-start}
.msg-group:hover{background:#f8f8f8}

/* avatar */
.avatar{width:36px;height:36px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff;margin-top:1px}
.avatar.me{background:#0866ff}
.avatar.them{background:#c026d3}

/* content */
.msg-content{flex:1;min-width:0}
.msg-header{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.msg-sender{font-weight:700;font-size:14px;color:#1d1c1d}
.msg-sender.me{color:#0866ff}
.msg-ts{font-size:11px;color:#999;white-space:nowrap}
/* text & media */
.msg-text{font-size:14px;line-height:1.5;color:#1d1c1d;word-break:break-word}
.msg-unsent{font-size:13px;color:#aaa;font-style:italic}
.msg-content img{max-width:360px;max-height:280px;border-radius:6px;display:block;cursor:pointer;margin-top:4px}
.msg-content img:hover{opacity:.88}
.msg-content video{max-width:360px;border-radius:6px;display:block;margin-top:4px}
.msg-content audio{width:280px;margin:4px 0;display:block}
.msg-stk img{max-width:72px;max-height:72px}
.msg-shr{font-size:13px;color:#555;margin-top:2px}
.msg-shr a{color:#0866ff}
.msg-rea{font-size:13px;margin-top:4px;display:flex;gap:4px;flex-wrap:wrap}
.msg-rea span{background:#f0f2f5;border:1px solid #e4e6ea;border-radius:12px;padding:2px 7px;font-size:12px}
.msg-call{font-size:13px;color:#888;font-style:italic;margin-top:2px}
.msg-flink{font-size:13px;margin-top:2px}
.msg-flink a{color:#0866ff}

/* --- gallery --- */
#gallery{flex:1;overflow-y:auto;padding:12px;display:none}
.ggrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:3px}
.gitem{aspect-ratio:1;overflow:hidden;cursor:pointer;border-radius:3px;background:#e4e6ea;position:relative}
.gitem img,.gitem video{width:100%;height:100%;object-fit:cover;display:block}
.gitem:hover{opacity:.85}
.gmore{text-align:center;padding:14px}
.gmore button{background:#fff;border:1px solid #ddd;padding:7px 18px;border-radius:18px;cursor:pointer;font-size:13px;color:#65676b}

/* --- files --- */
#fview{flex:1;overflow-y:auto;padding:12px;display:none}
.fitem{background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.fico{font-size:22px}
.fmeta{flex:1;min-width:0}
.fname{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fname a{color:#0866ff;text-decoration:none}
.fname a:hover{text-decoration:underline}
.fdate{font-size:12px;color:#65676b;margin-top:2px}

/* lightbox */
#lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999;align-items:center;justify-content:center;flex-direction:column}
#lb.on{display:flex}
#lb img,#lb video{max-width:92vw;max-height:88vh;border-radius:4px;object-fit:contain}
#lbclose{position:absolute;top:14px;right:18px;color:#fff;font-size:28px;cursor:pointer;line-height:1;opacity:.8}
#lbclose:hover{opacity:1}
#lbcap{color:#ccc;font-size:12px;margin-top:8px;text-align:center}
</style>
</head>
<body>

<div id="hdr">
  <h1>💬 Jasper &amp; Ciara</h1>
  <input type="date" id="date-jump" min="2016-07-14" max="2024-05-09" title="Jump to date">
  <input type="search" id="search" placeholder="Search messages…">
  <span id="count"></span>
</div>

<div id="tabs">
  <div class="tab on" data-tab="chat">Chat</div>
  <div class="tab" data-tab="photos">Photos (4,955)</div>
  <div class="tab" data-tab="videos">Videos (155)</div>
  <div class="tab" data-tab="files">Files &amp; Audio</div>
</div>

<div id="view">
  <div id="chat-pane">
    <div id="chat" style="visibility:hidden">
      <div id="searching">Searching…</div>
      <div id="msgs"></div>
      <div id="oldbtn"><button onclick="loadOlder()">Load older messages ⬆</button></div>
      <div id="loadbtn"><button onclick="loadNewer()">Load newer messages ⬇</button></div>
    </div>
    <div id="gallery"></div>
    <div id="fview"></div>
  </div>
  <div id="resizer"></div>
  <div id="notes-pane">
    <div id="notes-hdr">
      <span>📝 Analysis Notes</span>
      <input id="notes-filter" placeholder="Filter tags…" oninput="filterNotes(this.value)">
      <button onclick="openNoteModal(null)" style="font-size:12px;padding:3px 10px;background:#0866ff;color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:600;flex-shrink:0">+ New</button>
    </div>
    <div id="notes-body"></div>
  </div>
</div>

<div id="ctx-menu">
  <div class="ctx-item" id="ctx-edit">Edit Note</div>
</div>

<div id="note-modal">
  <div id="note-modal-bg" onclick="closeNoteModal()"></div>
  <div id="note-dlg">
    <h2 id="note-dlg-h">Edit Note</h2>
    <div class="nf"><label>Start</label><input id="nf-start" placeholder="2016-07-14 or 2016-07-14T13:06"></div>
    <div class="nf"><label>End (optional)</label><input id="nf-end" placeholder="2016-07-14 or 2016-07-14T23:59"></div>
    <div class="nf"><label>Tags</label><div class="tag-chips" id="nf-tags"></div></div>
    <div class="nf"><label>Title</label><input id="nf-title"></div>
    <div class="nf"><label>Body</label><textarea id="nf-body"></textarea></div>
    <div id="nf-footer">
      <button id="nf-delete" onclick="deleteNote()">Delete</button>
      <div class="nf-right">
        <button id="nf-cancel" onclick="closeNoteModal()">Cancel</button>
        <button id="nf-save" onclick="saveNote()">Save</button>
      </div>
    </div>
  </div>
</div>

<div id="lb">
  <span id="lbclose" onclick="closeLb()">✕</span>
  <div id="lbinner"></div>
  <div id="lbcap"></div>
</div>

<script>
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
  if (m.photos)      for (const p of m.photos)      parts.push(`<img src="${r2(p.uri)}" loading="lazy" onclick="lb('${r2(p.uri)}','photo')" onerror="this.remove()">`);
  if (m.videos)      for (const v of m.videos)      parts.push(`<video src="${r2(v.uri)}" controls preload="metadata"></video>`);
  if (m.audio_files) for (const a of m.audio_files) parts.push(`<audio src="${r2(a.uri)}" controls></audio>`);
  if (m.gifs)        for (const g of m.gifs)        parts.push(`<img src="${r2(g.uri)}" loading="lazy" onclick="lb('${r2(g.uri)}','gif')" onerror="this.remove()">`);
  if (m.sticker)     parts.push(`<div class="msg-stk"><img src="${r2(m.sticker.uri)}" loading="lazy" onerror="this.remove()"></div>`);
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
  return txt + med;
}

// Builds groups from messages using global state so append mode continues correctly
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
    return `${sep}<div class="msg-group" data-id="${b.msgs[0]._id}" data-ts="${b.msgs[0].timestamp_ms}">
      <div class="avatar ${b.mine?'me':'them'}">${initial}</div>
      <div class="msg-content">
        <div class="msg-header">
          <span class="msg-sender${b.mine?' me':''}">${esc(b.sender)}</span>
          <span class="msg-ts">${ts}</span>
        </div>
        ${body}
      </div>
    </div>`;
  }).join('');
}

// --- chat loading ---
// lowerOffset = start of loaded range, upperOffset = end of loaded range
let lowerOffset = 0, upperOffset = 0;

async function loadMessages(append = false, prepend = false) {
  const fetchOffset = prepend ? lowerOffset : (append ? upperOffset : lowerOffset);
  const params = new URLSearchParams({offset: fetchOffset, limit: LIMIT, asc: 1});
  if (searchQ) { params.delete('asc'); params.set('offset', 0); params.set('search', searchQ); }
  const data = await api('/api/messages?' + params);
  total = data.total;
  $('count').textContent = total.toLocaleString() + ' messages';
  $('oldbtn').style.display  = (lowerOffset > 0 && !searchQ) ? '' : 'none';
  $('loadbtn').style.display = (data.has_more && !searchQ) ? '' : 'none';

  const container = $('msgs');
  const count = data.messages.length;

  if (prepend) {
    const prevH   = $('chat').scrollHeight;
    const prevTop = $('chat').scrollTop;
    const saved   = [lastDate, lastSender, lastTs];
    lastDate = null; lastSender = null; lastTs = 0;
    const html = renderMessages(data.messages);
    [lastDate, lastSender, lastTs] = saved;
    container.insertAdjacentHTML('afterbegin', html);
    $('chat').scrollTop = prevTop + ($('chat').scrollHeight - prevH);
  } else if (append) {
    container.insertAdjacentHTML('beforeend', renderMessages(data.messages));
    upperOffset += count;
  } else {
    lastDate = null; lastSender = null; lastTs = 0;
    container.innerHTML = renderMessages(data.messages);
    upperOffset = lowerOffset + count;
    $('chat').scrollTop = 0;
  }
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
  const grid = $('gallery').querySelector('.ggrid') || (() => {
    const g = document.createElement('div');
    g.className = 'ggrid';
    $('gallery').insertBefore(g, $('gallery').querySelector('.gmore'));
    return g;
  })();

  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'gitem';
    if (galType === 'photos') {
      div.innerHTML = `<img src="${r2(item.uri)}" loading="lazy" onerror="this.closest('.gitem').remove()">`;
      div.onclick = () => lb(r2(item.uri), 'photo', new Date(item.ts).toLocaleDateString()+' · '+esc(item.sender));
    } else {
      div.innerHTML = `<video src="${r2(item.uri)}" preload="metadata"></video>`;
      div.onclick = () => lb(r2(item.uri), 'video', new Date(item.ts).toLocaleDateString()+' · '+esc(item.sender));
    }
    grid.appendChild(div);
  }
}

async function loadGallery(reset = false) {
  if (reset) { galOff = 0; galItems = []; $('gallery').innerHTML = '<div class="ggrid"></div><div class="gmore"></div>'; }
  const data = await api(`/api/attachments?type=${galType}&offset=${galOff}&limit=${GLIMIT}`);
  galItems.push(...data.items);
  renderGalleryItems(data.items);
  const more = $('gallery').querySelector('.gmore');
  if (data.has_more) {
    more.innerHTML = `<button onclick="loadMoreGal()">Load more</button>`;
  } else {
    more.innerHTML = '';
  }
  galOff += GLIMIT;
}

async function loadMoreGal() { await loadGallery(false); }

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
$('lb').addEventListener('click', e => { if (e.target===$('lb')) closeLb(); });
document.addEventListener('keydown', e => { if (e.key==='Escape') closeLb(); });

// --- tabs ---
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  currentTab = t.dataset.tab;
  $('chat').style.display    = 'none';
  $('gallery').style.display = 'none';
  $('fview').style.display   = 'none';
  if (currentTab==='chat')   { $('chat').style.display='flex'; $('chat').style.flexDirection='column'; }
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
  const sd = start.split('T')[0], ed = end.split('T')[0];
  if (sd === ed) {
    // same day — show date once, then time range
    const d = new Date(sd + 'T00:00:00').toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'});
    if (!hasTime(start) && !hasTime(end)) return d;
    const fmtT = iso => { const [h,m] = iso.split('T')[1].split(':').map(Number); const ap = h>=12?'PM':'AM'; return (h%12||12)+':'+String(m).padStart(2,'0')+' '+ap; };
    const t1 = hasTime(start) ? fmtT(start) : '';
    const t2 = hasTime(end)   ? fmtT(end)   : '';
    return d + (t1||t2 ? ' · ' + [t1,t2].filter(Boolean).join(' – ') : '');
  }
  // different days
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
    return `<div class="note-card" data-idx="${i}" data-id="${n.id}" data-start="${n.start}" data-end="${n.end}" style="border-left-color:${accentColor}">
      <div class="note-date">
        <span>${dateRange}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="note-edit-btn" data-id="${n.id}">✏</button>
          <button class="jump-btn" data-start="${n.start}" data-end="${n.end}">→ Chat</button>
        </div>
      </div>
      <div class="note-tags">${tagText}</div>
      <div class="note-title">${esc(n.title)}</div>
      <div class="note-body">${bodyHtml}</div>
    </div>`;
  }).join('');
}

// event delegation — one listener handles jump, edit, and card click
document.addEventListener('click', async function(e) {
  const jumpBtn = e.target.closest('.jump-btn');
  if (jumpBtn) {
    e.stopPropagation();
    await jumpToDate(jumpBtn.dataset.start);
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
    await jumpToDate(card.dataset.start);
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

function filterNotes(q) {
  const lq = q.toLowerCase();
  const filtered = allNotes.filter(n =>
    !lq || n.tags.some(t => t.includes(lq)) || n.title.toLowerCase().includes(lq) || n.body.toLowerCase().includes(lq)
  );
  renderNotes(filtered);
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
  $('note-dlg-h').textContent = note ? 'Edit Note' : 'New Note';
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
  };
  try {
    if (_editingId) {
      await fetch(`/api/notes/${_editingId}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    } else {
      await fetch('/api/notes', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    }
    closeNoteModal();
    allNotes = await api('/api/notes');
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
    allNotes = await api('/api/notes');
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
let _ctxNote = null;

function closeCtxMenu() { $('ctx-menu').classList.remove('on'); _ctxNote = null; }

document.addEventListener('contextmenu', e => {
  const card = e.target.closest('.note-card');
  if (!card) return;
  e.preventDefault();
  _ctxNote = allNotes.find(n => String(n.id) === card.dataset.id);
  if (!_ctxNote) return;
  const menu = $('ctx-menu');
  menu.style.left = Math.min(e.clientX, window.innerWidth  - menu.offsetWidth  - 8) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8) + 'px';
  menu.classList.add('on');
});

$('ctx-edit').addEventListener('click', () => {
  const note = _ctxNote;
  closeCtxMenu();
  if (note) openNoteModal(note);
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
    const delta = startX - e.clientX;   // dragging left = wider notes
    const newW = Math.max(220, Math.min(window.innerWidth * 0.6, startW + delta));
    pane.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', () => {
    resizer.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
})();


// --- infinite scroll ---
let loading = false;
$('chat').addEventListener('scroll', () => {
  if (loading || searchQ || currentTab !== 'chat') return;
  const el = $('chat');
  if (el.scrollTop < 80 && lowerOffset > 0) {
    loading = true;
    loadOlder().finally(() => { loading = false; });
  }
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
    const btn = $('loadbtn');
    if (btn.style.display === 'none') return;
    loading = true;
    loadNewer().finally(() => { loading = false; });
  }
});

// --- init ---
async function initChat() {
  lowerOffset = 0; upperOffset = 0;
  await loadMessages(false);
  $('chat').style.visibility = '';
}
initChat();
api('/api/notes').then(data => { allNotes = data; renderNotes(data); });
</script>
</body>
</html>
"""



@app.route("/")
def index():
    return Response(HTML, mimetype="text/html")


@app.route("/api/messages")
def api_messages():
    off   = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 80)), 200)
    q     = (request.args.get("search") or "").strip()
    asc   = request.args.get("asc") == "1"

    if q:
        filt  = {"$text": {"$search": q}}
        total = _msgs.count_documents(filt)
        page  = list(_msgs.find(filt, {"score": {"$meta": "textScore"}})
                     .sort([("score", {"$meta": "textScore"}), ("timestamp_ms", ASCENDING)])
                     .skip(off).limit(limit))
        return jsonify({"messages": [_clean(m) for m in page], "total": total, "has_more": off + limit < total})
    elif asc:
        total = MSG_TOTAL
        page  = list(_msgs.find().sort("timestamp_ms", ASCENDING).skip(off).limit(limit))
        return jsonify({"messages": [_clean(m) for m in page], "total": total, "has_more": off + limit < total})
    else:
        total = MSG_TOTAL
        skip  = max(0, total - off - limit)
        page  = list(_msgs.find().sort("timestamp_ms", ASCENDING).skip(skip).limit(limit))
        return jsonify({"messages": [_clean(m) for m in page], "total": total, "has_more": skip > 0})


@app.route("/api/attachments")
def api_attachments():
    atype = request.args.get("type", "photos")
    off   = int(request.args.get("offset", 0))
    limit = min(int(request.args.get("limit", 60)), 200)

    field = {"photos": "photos", "videos": "videos", "files": "files", "audio": "audio_files"}.get(atype, "photos")
    filt  = {field: {"$exists": True, "$not": {"$size": 0}}}
    total = _msgs.count_documents(filt)
    docs  = list(_msgs.find(filt, {field: 1, "timestamp_ms": 1, "sender_name": 1})
                 .sort("timestamp_ms", ASCENDING).skip(off).limit(limit))
    items = []
    for m in docs:
        for att in m.get(field, []):
            if "uri" in att:
                items.append({"uri": att["uri"], "ts": m["timestamp_ms"], "sender": m.get("sender_name", "")})
    return jsonify({"items": items, "total": total, "has_more": off + limit < total})


@app.route("/api/notes")
def api_notes():
    return jsonify(fetch_notes())


@app.route("/api/jump")
def api_jump():
    date_str = request.args.get("date", "")
    try:
        fmt = "%Y-%m-%dT%H:%M" if "T" in date_str else "%Y-%m-%d"
        target_ts = datetime.strptime(date_str, fmt).timestamp() * 1000
        idx = _msgs.count_documents({"timestamp_ms": {"$lt": target_ts}})
        return jsonify({"index": idx})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


def _proxy_write(method, path):
    try:
        data, status = payload_request(method, path, request.json or {})
        return jsonify(data), status
    except urllib.error.HTTPError as e:
        return jsonify({"error": e.reason}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/notes", methods=["POST"])
def api_notes_create():
    return _proxy_write("POST", "/notes")


@app.route("/api/notes/<note_id>", methods=["PATCH"])
def api_notes_update(note_id):
    return _proxy_write("PATCH", f"/notes/{note_id}")


@app.route("/api/notes/<note_id>", methods=["DELETE"])
def api_notes_delete(note_id):
    return _proxy_write("DELETE", f"/notes/{note_id}")


if __name__ == "__main__":
    app.run(port=8080, debug=False)
