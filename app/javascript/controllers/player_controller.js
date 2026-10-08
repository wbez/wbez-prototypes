import { Controller } from "@hotwired/stimulus"
import { state, day, airingAt, segAt, clock12, hm, hourLabel, dur, esc, emit, on, toast, store, icon, artHTML, queueRowsHTML } from "companion"

// Owns the <audio> element, the mini player and the Now Playing sheet.
//
// Three states:
//   live         playhead follows the demo clock
//   behind live  paused or skipped back within the live show
//   replay       playing an earlier show
//
// "Live" is the recording seeked to the clock's "now". The queue plays through
// on replay and never interrupts live.
const ACTS = ["live", "live-toggle", "liveopen", "toggle", "open", "close", "seek", "seekopen", "line", "skip", "bar",
  "ptab", "clip", "savecur", "playq", "playqueue", "openqueue"]
const LIVE_EDGE = 1 // seconds from "now" that still count as live
const DRIFT_LIMIT = 3 // resync live audio when it drifts this far at 1×
const FAST_DRIFT_LIMIT = 20 // above 1× the clock outruns the audio; skip ahead in steps

export default class extends Controller {
  static targets = ["audio", "mini", "miniArt", "miniTitle", "miniSub", "sheet", "art", "title", "segment", "pill", "tab",
    "body", "frame", "next", "barStart", "barEnd", "livePill", "backLive", "bar", "aired", "fill", "edge", "knob",
    "position", "nowLabel", "forward", "previous", "upcoming"]
  static values = { transcriptUrl: String }

  connect() {
    this.tab ||= "transcript"
    this.onClick = (event) => this.click(event)
    this.onKey = (event) => this.key(event)
    this.onEnded = () => this.ended()
    document.addEventListener("click", this.onClick)
    document.addEventListener("keydown", this.onKey)
    this.audioTarget.addEventListener("ended", this.onEnded)
    this.offs = [
      on("tick", () => this.tick()),
      on("store", () => this.render(true)),
      on("reset", () => this.reset()),
      on("player-do", (event) => this.perform(event.detail.act, event.detail))
    ]
    this.render(true)
  }

  disconnect() {
    document.removeEventListener("click", this.onClick)
    document.removeEventListener("keydown", this.onKey)
    this.audioTarget.removeEventListener("ended", this.onEnded)
    this.offs.forEach((off) => off())
  }

  // ---- Input -------------------------------------------------------------

  click(event) {
    const el = event.target.closest("[data-act]")
    if (!el || !ACTS.includes(el.dataset.act)) return
    const detail = { t: Number(el.dataset.t), d: Number(el.dataset.d), i: Number(el.dataset.i), id: el.dataset.id }
    if (el.dataset.act === "bar") {
      const box = el.getBoundingClientRect()
      detail.fraction = (event.clientX - box.left) / box.width
    }
    this.opener = el
    this.perform(el.dataset.act, detail)
  }

  key(event) {
    if (event.key === "Escape" && this.isOpen && !document.querySelector(".cp-sheet.is-on")) this.close()
    if (event.target === this.barTarget && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault()
      this.skip(event.key === "ArrowLeft" ? -10 : 10)
    }
  }

  perform(act, { t, d, i, id, fraction } = {}) {
    switch (act) {
      case "live": this.goLive(); break
      case "liveopen": this.goLive(); this.open(); break
      case "live-toggle": state.started && state.playing && state.atLive ? this.toggle() : this.goLive(); break
      case "toggle": this.toggle(); break
      case "open": this.open(); break
      case "close": this.close(); break
      // Tapping the segment that is on air right now means "go live".
      case "seek": segAt(state.now)?.t === t ? this.goLive() : this.seek(t); break
      case "seekopen": if (this.seek(t)) this.open(); break
      case "line": this.seek(t); break
      case "skip": this.skip(d); break
      case "bar": this.seekFraction(fraction); break
      case "ptab": this.showTab(id); break
      case "clip": toast("Clip link copied (prototype)"); break
      case "savecur": this.saveCurrent(); break
      case "playq": this.playFromQueue(i); break
      case "playqueue": this.playFromQueue(0); break
      case "openqueue": this.showTab("next"); this.open(); break
    }
  }

  // ---- Playback ----------------------------------------------------------

  goLive() {
    const airing = airingAt(state.now)
    Object.assign(state, { started: true, atLive: true, playhead: state.now })
    this.lastSeg = null
    this.load(airing, state.now - airing.start)
    this.play()
    this.changed()
  }

  // Returns false when the target can't be played.
  seek(t) {
    if (!Number.isFinite(t)) return false
    if (t >= state.now - LIVE_EDGE) {
      this.goLive()
      return true
    }
    const airing = airingAt(t)
    if (!airing.replay) {
      toast("Not available for replay")
      return false
    }
    Object.assign(state, { started: true, atLive: false, playhead: t })
    this.lastSeg = segAt(t)?.id
    this.load(airing, t - airing.start)
    this.play()
    this.changed()
    return true
  }

  toggle() {
    if (!state.started) return this.goLive()
    if (state.playing) {
      this.audioTarget.pause()
      state.playing = false
      // Pausing on live puts you behind live.
      state.atLive = false
    } else if (!airingAt(state.playhead).replay) {
      // A show that can't be replayed can't be timeshifted either.
      return this.goLive()
    } else {
      this.play()
    }
    this.changed()
  }

  skip(seconds) {
    if (!state.started) Object.assign(state, { started: true, playhead: state.now })
    this.seek(state.playhead + seconds)
  }

  seekFraction(fraction) {
    const airing = airingAt(state.started ? state.playhead : state.now)
    this.seek(airing.start + Math.min(Math.max(fraction, 0), 1) * (airing.end - airing.start))
  }

  playFromQueue(index) {
    const queue = store.get("queue")
    const [item] = queue.splice(index, 1)
    if (!item) return
    store.set("queue", queue)
    if (this.seek(item.t)) toast(`From your queue: ${item.title}`)
  }

  load(airing, offset) {
    const audio = this.audioTarget
    offset = Math.max(0, offset)
    if (this.loaded === airing.id) {
      audio.currentTime = offset
      return
    }
    this.loaded = airing.id
    this.pendingSeek = offset
    audio.src = `${airing.audio}#t=${offset.toFixed(1)}`
    audio.addEventListener("loadedmetadata", () => {
      if (this.pendingSeek === null) return
      if (Math.abs(audio.currentTime - this.pendingSeek) > 1) audio.currentTime = this.pendingSeek
      this.pendingSeek = null
    }, { once: true })
  }

  play() {
    state.playing = true
    this.audioTarget.play()?.catch((error) => {
      // A new source interrupts the previous play() call; that isn't a failure.
      if (error.name === "AbortError") return
      state.playing = false
      toast(error.name === "NotAllowedError" ? "Tap play to start the audio" : "Couldn't play this audio")
      this.changed()
    })
  }

  get audioTime() {
    return this.pendingSeek ?? this.audioTarget.currentTime
  }

  tick() {
    if (state.started && state.playing) state.atLive ? this.followClock() : this.followAudio()
    this.render()
  }

  followClock() {
    state.playhead = state.now
    const airing = airingAt(state.now)
    const offset = state.now - airing.start
    if (this.loaded !== airing.id) {
      // The hour handed off to the next show.
      this.load(airing, offset)
      this.play()
    } else if (this.pendingSeek === null && Math.abs(this.audioTime - offset) > (state.speed > 1 ? FAST_DRIFT_LIMIT : DRIFT_LIMIT)) {
      this.audioTarget.currentTime = offset
    }
  }

  followAudio() {
    const airing = day().airings.find((a) => a.id === this.loaded)
    state.playhead = airing.start + this.audioTime
    if (state.playhead >= state.now - LIVE_EDGE / 2) {
      Object.assign(state, { atLive: true, playhead: state.now })
      return
    }
    const seg = segAt(state.playhead)?.id
    if (seg !== this.lastSeg) {
      this.lastSeg = seg
      // A segment just ended on replay: the queue takes over.
      if (store.get("queue").length) return this.playFromQueue(0)
    }
    if (state.playhead >= airing.end - 0.3) this.ended()
  }

  // The show being replayed ran out: carry on with the next one that can be
  // replayed, or go live.
  ended() {
    if (!state.started || state.atLive) return
    const airings = day().airings
    const next = airings.slice(airings.findIndex((a) => a.id === this.loaded) + 1).find((a) => a.audio && a.replay)
    if (next && next.start < state.now - LIVE_EDGE) this.seek(next.start)
    else this.goLive()
  }

  reset() {
    this.audioTarget.pause()
    this.audioTarget.removeAttribute("src")
    this.audioTarget.load()
    this.loaded = null
    this.pendingSeek = null
    Object.assign(state, { started: false, playing: false, atLive: true, playhead: state.now })
    this.close()
    this.changed()
  }

  saveCurrent() {
    const t = state.started ? state.playhead : state.now
    const airing = airingAt(t)
    const line = this.sheetTarget.querySelector(".cp-line.is-cur .cp-line__text")
    const saved = store.get("saved").filter((item) => Math.abs(item.t - t) > 2)
    saved.push({
      t, text: line ? line.textContent.trim() : segAt(t)?.title || airing.name,
      name: airing.name, short: airing.short, color: airing.color, replay: airing.replay
    })
    store.set("saved", saved)
    toast("Saved to Library")
  }

  // ---- Now Playing sheet -------------------------------------------------

  get isOpen() {
    return this.sheetTarget.classList.contains("is-on")
  }

  open() {
    if (this.isOpen) return
    this.returnFocus = this.opener?.isConnected ? this.opener : null
    this.sheetTarget.inert = false
    this.sheetTarget.classList.add("is-on")
    this.render(true)
    this.sheetTarget.querySelector("[data-act='close']").focus({ preventScroll: true })
    emit("follow")
  }

  close() {
    if (!this.isOpen) return
    this.sheetTarget.classList.remove("is-on")
    this.sheetTarget.inert = true
    this.returnFocus?.focus({ preventScroll: true })
  }

  showTab(id) {
    this.tab = id
    this.render(true)
    emit("follow")
  }

  // ---- Rendering ---------------------------------------------------------

  changed() {
    this.render(true)
  }

  status() {
    if (!state.started || state.atLive) return "Live"
    return airingAt(state.playhead) === airingAt(state.now)
      ? `${dur(state.now - state.playhead)} behind live`
      : `Replay, ${clock12(state.playhead)}`
  }

  render(force = false) {
    const t = state.started ? state.playhead : state.now
    const airing = airingAt(t)
    const seg = segAt(t)

    const root = document.documentElement
    root.classList.toggle("cp-started", state.started)
    root.classList.toggle("cp-playing", state.playing)
    root.classList.toggle("cp-at-live", state.atLive)

    const key = [state.started, state.playing, state.atLive, airing.id, seg?.id].join("|")
    if (key !== this.stateKey || force) {
      this.stateKey = key
      document.querySelectorAll("[data-play-label]").forEach((el) => el.setAttribute("aria-label", state.playing ? "Pause" : "Play"))
      document.querySelectorAll("[data-live-label]").forEach((el) =>
        el.setAttribute("aria-label", state.playing && state.atLive ? "Pause" : "Play live"))
      emit("state")
    }

    this.renderMini(airing, seg)
    if (this.isOpen) this.renderSheet(airing, seg, force)
  }

  renderMini(airing, seg) {
    this.miniTarget.hidden = !state.started
    if (!state.started) return
    const sub = `${this.status()}, ${seg ? seg.title : airing.name}`
    if (this.miniTitleTarget.textContent !== airing.name) {
      this.miniTitleTarget.textContent = airing.name
      this.miniArtTarget.textContent = airing.short
      this.miniArtTarget.style.background = airing.color
    }
    if (this.miniSubTarget.textContent !== sub) {
      this.miniSubTarget.textContent = sub
      this.miniSubTarget.classList.toggle("is-live", state.atLive)
    }
  }

  renderSheet(airing, seg, force) {
    const atLive = state.atLive || !state.started
    const status = this.status()

    const infoKey = [airing.id, seg?.id, status, this.tab].join("|")
    if (infoKey !== this.infoKey || force) {
      this.infoKey = infoKey
      this.artTarget.textContent = airing.short
      this.artTarget.style.background = airing.color
      this.titleTarget.textContent = airing.name
      this.segmentTarget.textContent = seg ? seg.title : "Starting soon"
      this.pillTarget.textContent = status
      this.pillTarget.className = `cp-pill ${atLive ? "cp-pill--dot" : status.startsWith("Replay") ? "cp-pill--replay" : "cp-pill--ghost"}`
      this.tabTargets.forEach((tab) => {
        tab.classList.toggle("is-on", tab.dataset.id === this.tab)
        tab.setAttribute("aria-selected", tab.dataset.id === this.tab)
      })
      this.bodyTarget.dataset.tab = this.tab
      this.renderFooter(airing)
    }

    // The transcript and notes for the show being played load into a frame.
    if (this.frameAiring !== airing.id) {
      this.frameAiring = airing.id
      this.frameTarget.src = this.transcriptUrlValue.replace("__ID__", airing.id)
    }

    this.renderBar(airing, atLive)
    this.renderNext(force)
  }

  // The bar spans the show's hour. Grey is what has aired, black is where you
  // are, and the red edge marks live when you're behind it.
  renderBar(airing, atLive) {
    const span = airing.end - airing.start
    const t = state.started ? state.playhead : state.now
    const played = Math.min(Math.max((t - airing.start) / span, 0), 1)
    const liveHere = state.now >= airing.start && state.now < airing.end
    const aired = liveHere ? (state.now - airing.start) / span : 1

    this.barStartTarget.textContent = clock12(airing.start)
    this.barEndTarget.textContent = clock12(airing.end)
    this.livePillTarget.hidden = !atLive
    this.backLiveTarget.hidden = atLive
    this.airedTarget.style.width = `${aired * 100}%`
    this.fillTarget.style.width = `${played * 100}%`
    this.knobTarget.style.left = `${played * 100}%`
    this.knobTarget.classList.toggle("is-live", atLive)
    this.edgeTarget.hidden = !liveHere || atLive
    this.edgeTarget.style.left = `${aired * 100}%`
    this.positionTarget.textContent = atLive ? "" : clock12(t, true)
    this.nowLabelTarget.textContent = atLive ? `Now ${hm(state.now)}` : ""
    this.forwardTarget.disabled = atLive
    this.barTarget.setAttribute("aria-valuenow", Math.round(played * 100))
    this.barTarget.setAttribute("aria-valuetext", atLive ? `Live, ${clock12(state.now)}` : clock12(t))
  }

  renderFooter(airing) {
    const airings = day().airings
    const index = airings.indexOf(airing)
    const previous = airings[index - 1]
    const next = airings[index + 1]
    this.previousTarget.hidden = !previous
    if (previous) {
      this.previousTarget.dataset.t = previous.start
      this.previousTarget.innerHTML = `<span class="cp-tiny">Previous</span><span class="${previous.replay ? "" : "cp-faint"}">${esc(previous.name)}</span>`
    }
    this.upcomingTarget.hidden = !next
    if (next) this.upcomingTarget.innerHTML = `<span class="cp-tiny">Up next</span><span>${esc(next.name)} at ${hourLabel(next.start)}</span>`
  }

  // Up next: your queue, then what is coming up live.
  renderNext(force) {
    if (this.tab !== "next") return
    const queue = store.get("queue")
    const alerts = store.get("alerts")
    const live = airingAt(state.now)
    const nextSeg = live.segments.find((s) => s.listed && s.t > state.now)
    const key = [JSON.stringify(queue), alerts.join(), state.atLive, live.id, nextSeg?.id].join("|")
    if (key === this.nextKey && !force) return
    this.nextKey = key

    let html = `<div class="cp-next__head"><b>Your queue</b>${queue.length ? '<button type="button" class="cp-small" data-act="clearqueue">Clear</button>' : ""}</div>`
    if (!queue.length) {
      html += '<p class="cp-small">Empty. Add segments from Listen, Schedule or Search with the queue button.</p>'
    } else {
      if (state.atLive && state.started) {
        html += '<p class="cp-small">You\'re live, so your queue waits. <button type="button" class="cp-link" data-act="playqueue">Play queue now</button></p>'
      }
      html += queueRowsHTML()
    }

    html += '<div class="cp-next__head cp-next__head--live"><b>Coming up live</b></div>'
    if (nextSeg) {
      html += `<div class="cp-listrow"><div class="cp-grow"><div>${esc(nextSeg.title)}</div><div class="cp-tiny">${esc(live.name)}, about ${clock12(nextSeg.t)}</div></div></div>`
    }
    day().airings.filter((a) => a.start > state.now).slice(0, 2).forEach((a) => {
      const on = alerts.includes(a.id)
      html += `<div class="cp-listrow">${artHTML(a)}<div class="cp-grow"><b>${esc(a.name)}</b><div class="cp-tiny">${hourLabel(a.start)}${a.rundown ? ", " + esc(a.rundown) : ", rundown not yet posted"}</div></div>
        <button type="button" class="cp-bell ${on ? "is-on" : ""}" data-act="notify" data-id="${a.id}" data-name="${esc(a.name)}" data-bell aria-pressed="${on}" aria-label="Notify me when ${esc(a.name)} goes live">${icon("bell")}</button></div>`
    })
    this.nextTarget.innerHTML = html
  }
}
