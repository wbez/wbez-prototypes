import { Controller } from "@hotwired/stimulus"
import { state, ui, day, airingAt, segAt, hm, on } from "companion"

// Keeps a page in step with the demo clock. The server renders every show and
// segment with data-start (and data-end); this controller works out whether
// each has aired, is live or is still to come, and shows the matching pieces:
//
//   data-state on [data-start]   past | live | next | future
//   [data-when="..."] inside it  shown when the state matches ("aired" = past or live)
//   [data-reveal]                hidden until its time has passed
//   [data-countdown]             "Starts in N min"
//   [data-nowline-host]          gets the red "now" line after its live segment
//
// It also expands and collapses shows (Listen variant A) and marks the
// segment being replayed.
export default class extends Controller {
  connect() {
    this.scan()
    this.onFrame = () => {
      this.scan()
      this.update(true)
    }
    this.element.addEventListener("turbo:frame-load", this.onFrame)
    this.offs = [
      on("tick", () => this.update()),
      on("state", () => this.markPlaying()),
      on("expand", (event) => this.expand(event.detail.id))
    ]
    ui.expanded ||= new Set([airingAt(state.now).id])
    this.applyExpanded()
    this.update(true)
    this.markPlaying()
  }

  disconnect() {
    this.element.removeEventListener("turbo:frame-load", this.onFrame)
    this.offs.forEach((off) => off())
  }

  scan() {
    this.items = [...this.element.querySelectorAll("[data-start]")]
      // Transcripts keep their own time (see transcript_controller).
      .filter((el) => !el.closest(".cp-airing"))
      .map((el) => ({
        el,
        start: Number(el.dataset.start),
        end: el.dataset.end ? Number(el.dataset.end) : Infinity,
        seg: el.hasAttribute("data-seg"),
        reveal: el.hasAttribute("data-reveal"),
        whens: [...el.querySelectorAll("[data-when]")].filter((when) => when.closest("[data-start]") === el),
        state: null
      }))
    this.hosts = [...this.element.querySelectorAll("[data-nowline-host]")]
  }

  update(force = false) {
    const now = state.now
    const second = Math.floor(now)
    if (second === this.second && !force) return
    this.second = second

    const liveSeg = segAt(now, true)
    this.items.forEach((item) => {
      if (item.reveal) {
        item.el.hidden = now < item.start
        return
      }
      const value = item.seg ? this.segState(item, now, liveSeg) : now < item.start ? "future" : now < item.end ? "live" : "past"
      if (value === item.state && !force) return
      item.state = value
      item.el.dataset.state = value
      if (item.seg) item.el.hidden = value === "future"
      item.whens.forEach((when) => { when.hidden = !this.matches(when.dataset.when, value) })
    })

    this.element.querySelectorAll("[data-countdown]").forEach((el) => {
      const minutes = Math.ceil((Number(el.dataset.countdown) - now) / 60)
      const text = minutes > 60 ? el.dataset.far : `${el.hasAttribute("data-countdown-short") ? "in" : "Starts in"} ${Math.max(minutes, 1)} min`
      if (el.textContent !== text) el.textContent = text
    })

    this.renderLiveCard(now)
    this.placeNowLines(now)
  }

  // Within the live show, the last segment that has started is live and the
  // one after it is "next". Anything later stays hidden.
  segState(item, now, liveSeg) {
    if (now >= item.start) return liveSeg && item.el.dataset.segId === liveSeg.id ? "live" : "past"
    const next = airingAt(now).segments.find((seg) => seg.listed && seg.t > now)
    return next && item.el.dataset.segId === next.id ? "next" : "future"
  }

  matches(when, value) {
    return when.split(" ").some((token) => token === value || (token === "aired" && (value === "past" || value === "live")))
  }

  renderLiveCard(now) {
    const card = this.element.querySelector("[data-live-card]")
    if (!card) return
    const airing = airingAt(now)
    const seg = segAt(now)
    const name = card.querySelector("[data-live-name]")
    const title = card.querySelector("[data-live-seg]")
    if (name.textContent !== airing.name) name.textContent = airing.name
    const text = seg ? seg.title : "Show starting"
    if (title.textContent !== text) title.textContent = text
  }

  placeNowLines(now) {
    const label = `${hm(now)} now`
    this.hosts.forEach((host) => {
      const live = host.querySelector('[data-seg][data-state="live"]')
      let line = host.querySelector(":scope > .cp-nowline")
      if (!live) return line?.remove()
      if (!line) {
        line = document.createElement("div")
        line.className = "cp-nowline"
        line.innerHTML = '<span class="cp-nowline__dot"></span><span class="cp-nowline__lab"></span>'
      }
      if (live.nextElementSibling !== line) live.after(line)
      const lab = line.querySelector(".cp-nowline__lab")
      if (lab.textContent !== label) lab.textContent = label
      line.setAttribute("aria-label", `Now, ${label}`)
    })
  }

  markPlaying() {
    const playing = state.started && !state.atLive ? segAt(state.playhead, true)?.id : null
    this.element.querySelectorAll("[data-seg-id]").forEach((el) => el.classList.toggle("is-playing", el.dataset.segId === playing))
  }

  // ---- Variant A: expand a show into its segments -------------------------

  toggle(event) {
    const id = event.currentTarget.closest("[data-show]").dataset.show
    ui.expanded.has(id) ? ui.expanded.delete(id) : ui.expanded.add(id)
    this.applyExpanded()
  }

  expand(id) {
    ui.expanded.add(id)
    this.applyExpanded()
    this.element.querySelector(`.cp-show[data-show="${id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  applyExpanded() {
    this.element.querySelectorAll(".cp-show[data-show]").forEach((show) => {
      const open = ui.expanded.has(show.dataset.show)
      show.classList.toggle("is-open", open)
      show.querySelector(".cp-showrow[aria-expanded]")?.setAttribute("aria-expanded", open)
    })
  }
}
