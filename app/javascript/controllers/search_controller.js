import { Controller } from "@hotwired/stimulus"
import { state, clock12, esc, emit, icon, artHTML } from "companion"

// "What was that?" Searches transcript lines as you type and shows each hit as
// a moment you can play from, queue or save. It runs in the browser, against
// every line of the day, and only finds what has aired by the demo clock's
// "now".
const LIMIT = 40
let index = null // fetched once per page load

export default class extends Controller {
  static targets = ["input", "results"]
  static values = { indexUrl: String }

  async connect() {
    this.inputTarget.value = new URLSearchParams(location.search).get("q") || ""
    this.inputTarget.setSelectionRange(this.inputTarget.value.length, this.inputTarget.value.length)
    this.empty = this.resultsTarget.innerHTML
    if (!index) {
      try {
        index = await (await fetch(this.indexUrlValue)).json()
      } catch {
        this.resultsTarget.innerHTML = '<p class="cp-empty">Search isn\'t available right now.</p>'
        return
      }
    }
    this.search()
  }

  disconnect() {
    clearTimeout(this.timer)
  }

  queue() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.search(), 150)
  }

  submit(event) {
    event.preventDefault()
    this.search()
  }

  search() {
    if (!index) return
    const query = this.inputTarget.value.trim()
    if (!query) {
      this.resultsTarget.innerHTML = this.empty
      return
    }
    const needle = query.toLowerCase()
    const now = state.now
    const hits = []
    // Lines are in air order; walk backwards for the most recent first.
    for (let i = index.lines.length - 1; i >= 0 && hits.length < LIMIT; i--) {
      const line = index.lines[i]
      if (line[0] <= now && line[1].toLowerCase().includes(needle)) hits.push(i)
    }
    this.resultsTarget.innerHTML = hits.length ? this.resultsHTML(hits, query, now) : `<p class="cp-empty">Nothing on air so far matched “${esc(query)}”.<br>Try a different word.</p>`
    // Lets the store mark anything already queued.
    emit("store", { name: "search" })
  }

  resultsHTML(hits, query, now) {
    const count = `${hits.length}${hits.length === LIMIT ? "+" : ""} moment${hits.length === 1 ? "" : "s"}`
    return `<p class="cp-tiny cp-results__count">${count} on air before ${clock12(now)}${hits.length > 1 ? ", most recent first" : ""}</p>
      ${hits.map((i) => this.resultHTML(i, query, now)).join("")}
      <p class="cp-txnote">Transcripts are machine-generated and may contain errors.</p>`
  }

  resultHTML(i, query, now) {
    const [t, text, airingIndex, segment] = index.lines[i]
    const airing = index.airings[airingIndex]
    const pattern = new RegExp(esc(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig")
    const quote = esc(text).replace(pattern, (match) => `<mark>${match}</mark>`)
    const actions = airing.replay
      ? `<div class="cp-result__acts">
          <button type="button" class="cp-result__play" data-act="seekopen" data-t="${t}"><span class="cp-miniplay" aria-hidden="true">${icon("play")}</span>Play from here</button>
          <span class="cp-result__more">
            <button type="button" class="cp-small" data-act="queue" data-t="${t}" data-queue-toggle data-queue-label aria-pressed="false">Add to queue</button>
            <button type="button" class="cp-small" data-act="saveline" data-t="${t}" data-text="${esc(text)}">Save</button>
          </span>
        </div>`
      : `<details class="cp-result__read">
          <summary><span class="cp-tiny">Not available for replay</span><span class="cp-result__toggle">Read transcript</span></summary>
          ${this.segmentLines(i, now).map((j) => `<p class="${j === i ? "is-hit" : ""}">${esc(index.lines[j][1])}</p>`).join("")}
        </details>`
    return `<article class="cp-result${airing.replay ? "" : " cp-result--blocked"}">
      <div class="cp-result__head">${artHTML(airing)}<div><b>${esc(airing.name)}</b><div class="cp-tiny">${esc(segment)}, ${clock12(t)}</div></div></div>
      <p class="cp-result__quote">“${quote}”</p>
      ${actions}
    </article>`
  }

  // The aired lines of the segment around line i, for shows that can be read but not replayed.
  segmentLines(i, now) {
    const same = (j) => index.lines[j] && index.lines[j][2] === index.lines[i][2] && index.lines[j][3] === index.lines[i][3]
    let first = i
    let last = i
    while (same(first - 1)) first--
    while (same(last + 1) && index.lines[last + 1][0] <= now) last++
    return Array.from({ length: last - first + 1 }, (_, k) => first + k)
  }
}
