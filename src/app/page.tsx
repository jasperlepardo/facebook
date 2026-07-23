'use client'
import Script from 'next/script'
import './viewer.css'

export default function Page() {
  return (
    <div id="viewer-root">
      <div id="hdr">
        {/* <h1>💬 Jasper &amp; Ciara</h1> */}
        <input type="date" id="date-jump" min="2016-07-14" max="2024-05-09" title="Jump to date" />
        <input type="search" id="search" placeholder="Search messages…" />
        {/* <span id="count"></span> */}
        <span id="current-user" style={{fontSize:'12px',opacity:0.75}}></span>
      </div>

      <div id="tabs">
        <div className="tab on" data-tab="chat">Chat</div>
        <div className="tab" data-tab="photos">Photos (4,955)</div>
        <div className="tab" data-tab="videos">Videos (155)</div>
        <div className="tab" data-tab="files">Files &amp; Audio</div>
      </div>

      <div id="view">
        <div id="chat-pane">
          <div id="sticky-date"><span></span></div>
          <div id="sel-bar">
            <span id="sel-count"></span>
            <button id="sel-note-btn">📝 Note</button>
            <button id="sel-clear-btn">✕</button>
          </div>
          <div id="chat" style={{visibility:'hidden'}}>
            <div id="searching">Searching…</div>
            <div id="msgs"></div>
            <div id="loadbtn" style={{display:'none'}}></div>
          </div>
          <div id="gallery"></div>
          <div id="fview"></div>
        </div>
        <div id="resizer"></div>
        <div id="notes-pane">
          <div id="notes-hdr">
            <span>📝 Analysis Notes</span>
            <input id="notes-filter" placeholder="Filter tags…" />
            <button id="notes-new-btn">+ New</button>
          </div>
          <div id="notes-body"></div>
        </div>
      </div>

      <div id="ctx-menu">
        <div className="ctx-item" id="ctx-edit">Edit Note</div>
        <div className="ctx-item" id="ctx-goto" style={{display:'none'}}>Go to message</div>
      </div>

      <div id="note-modal">
        <div id="note-modal-bg"></div>
        <div id="note-dlg">
          <h2 id="note-dlg-h">Edit Note</h2>
          <div className="nf" id="nf-msgs-row" style={{display:'none'}}>
            <label>Linked messages</label>
            <div id="nf-msgs"></div>
          </div>
          <div className="nf"><label>Start</label><input id="nf-start" placeholder="2016-07-14 or 2016-07-14T13:06" /></div>
          <div className="nf"><label>End (optional)</label><input id="nf-end" placeholder="2016-07-14 or 2016-07-14T23:59" /></div>
          <div className="nf"><label>Tags</label><div className="tag-chips" id="nf-tags"></div></div>
          <div className="nf"><label>Title</label><input id="nf-title" /></div>
          <div className="nf"><label>Body</label><textarea id="nf-body"></textarea></div>
          <div id="nf-footer">
            <button id="nf-delete">Delete</button>
            <div className="nf-right">
              <button id="nf-cancel">Cancel</button>
              <button id="nf-save">Save</button>
            </div>
          </div>
        </div>
      </div>

      <div id="lb">
        <span id="lbclose">✕</span>
        <div id="lbinner"></div>
        <div id="lbcap"></div>
      </div>

      <Script src="/viewer.js" strategy="afterInteractive" />
    </div>
  )
}
