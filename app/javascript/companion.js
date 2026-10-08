// Shared state and helpers for the Listening Companion prototype.
// The Stimulus controllers talk to each other through this module and through
// "companion:*" events on window.

let cached = null

// The broadcast day (airings and segments), embedded as JSON in the layout.
// Parsed once: switching days is a full page load.
export function day() {
  cached ||= JSON.parse(document.querySelector("[data-companion-day]").textContent)
  return cached
}

// now and playhead are seconds on the day's timeline (see Broadcast).
export const state = { now: 0, speed: 1, started: false, playing: false, atLive: true, playhead: 0 }

export const SPEEDS = [1, 4, 10]
export const clockMin = () => day().airings[0].start + 1
// The recording runs out here; the clock stops just short of it.
export const clockMax = () => day().audioEnd - 10

// "HH:MM" on the day's timeline, which may run past midnight.
export function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || "")
  if (!match) return null
  let seconds = Number(match[1]) * 3600 + Number(match[2]) * 60
  if (seconds < clockMin() - 3600) seconds += 86400
  return Math.min(Math.max(seconds, clockMin()), clockMax())
}

// The demo clock starts about 40 minutes into the latest hour of audio, or at
// ?at=HH:MM, and runs at ?speed=1|4|10.
export function resetClock(params = null) {
  const speed = Number(params?.get("speed"))
  state.speed = SPEEDS.includes(speed) ? speed : 1
  state.now = parseClock(params?.get("at")) ?? day().defaultNow
}

// Set before any controller connects, so the first render has the right time.
// (This module also loads on pages outside the prototype, where there is no day.)
if (document.querySelector("[data-companion-day]")) resetClock(new URLSearchParams(location.search))

// View state that should survive Turbo visits but not a reload.
export const ui = { expanded: null, zoom: 0 }

export function airingAt(t) {
  const airings = day().airings
  return airings.find((a) => t >= a.start && t < a.end) || (t < airings[0].start ? airings[0] : airings[airings.length - 1])
}

export function segAt(t, listedOnly = false) {
  let found = null
  for (const seg of airingAt(t).segments) {
    if (seg.t > t) break
    if (!listedOnly || seg.listed) found = seg
  }
  return found
}

export function clock12(t, withSeconds = false) {
  t = Math.floor(t)
  const h = Math.floor(t / 3600) % 24
  const m = String(Math.floor(t / 60) % 60).padStart(2, "0")
  const s = withSeconds ? ":" + String(t % 60).padStart(2, "0") : ""
  return `${h % 12 || 12}:${m}${s} ${h < 12 ? "AM" : "PM"}`
}

export const hm = (t) => clock12(t).split(" ")[0]
export const hourLabel = (t) => clock12(t).replace(":00", "")

export function dur(seconds) {
  seconds = Math.max(0, Math.round(seconds))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

export function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`companion:${name}`, { detail }))
}

// Returns a function that removes the listener.
export function on(name, handler) {
  const type = `companion:${name}`
  window.addEventListener(type, handler)
  return () => window.removeEventListener(type, handler)
}

export const toast = (message) => emit("toast", { message })

// Icons are rendered once by the server into <template data-icon> elements.
export function icon(name) {
  return document.querySelector(`template[data-icon="${name}"]`)?.innerHTML || ""
}

// Queue, saved moments, alerts and follows live in localStorage. It's a
// single-user demo, so there are no accounts.
const storageKey = (name) => `cp.${day().key}.${name}`
const NAMES = ["queue", "saved", "alerts", "follows", "autodl"]
const DEFAULTS = { follows: ["In the Loop", "Say More"], autodl: ["16 Shots"] }

export const store = {
  get(name) {
    try {
      const raw = localStorage.getItem(storageKey(name))
      return raw === null ? [...(DEFAULTS[name] || [])] : JSON.parse(raw)
    } catch {
      return []
    }
  },
  set(name, value) {
    try {
      localStorage.setItem(storageKey(name), JSON.stringify(value))
    } catch {
      // Storage can be unavailable (private windows); the page still works.
    }
    emit("store", { name })
  },
  toggle(name, value) {
    const list = this.get(name)
    const index = list.indexOf(value)
    if (index >= 0) list.splice(index, 1)
    else list.push(value)
    this.set(name, list)
    return index < 0
  },
  clear() {
    NAMES.forEach((name) => {
      try {
        localStorage.removeItem(storageKey(name))
      } catch {
        // see set()
      }
    })
    emit("store", { name: "all" })
  }
}

export function queueItem(t) {
  const airing = airingAt(t)
  const seg = segAt(t)
  const fromLine = seg && Math.abs(t - seg.t) > 1
  return {
    t,
    title: seg ? seg.title : airing.name,
    sub: `${airing.name}, ${fromLine ? "from " : ""}${clock12(t)}`,
    short: airing.short,
    color: airing.color
  }
}

export const artHTML = (item, classes = "") =>
  `<span class="cp-art ${classes}" style="background:${esc(item.color)}" aria-hidden="true">${esc(item.short)}</span>`

export function queueRowsHTML(limit = 0) {
  const queue = store.get("queue")
  return (limit ? queue.slice(0, limit) : queue)
    .map(
      (item, i) => `<div class="cp-qrow">
        <span class="cp-qrow__num">${i + 1}</span>${artHTML(item, "cp-art--sm")}
        <button type="button" class="cp-grow" data-act="playq" data-i="${i}" aria-label="Play ${esc(item.title)} now">
          <span class="cp-qrow__t1">${esc(item.title)}</span><span class="cp-qrow__t2">${esc(item.sub)}</span>
        </button>
        <button type="button" class="cp-qbtn" data-act="unqueue" data-i="${i}" aria-label="Remove ${esc(item.title)} from queue">${icon("times")}</button>
      </div>`
    )
    .join("")
}
