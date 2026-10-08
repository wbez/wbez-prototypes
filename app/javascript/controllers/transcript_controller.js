import { Controller } from "@hotwired/stimulus"
import { state, hm, on } from "companion"

// One show's transcript. Every line is rendered with its start time; lines
// appear as the demo clock passes them. In the player it follows playback:
// the current line is highlighted and kept in view until you scroll, which
// detaches it and shows a Resume pill. Tapping a line seeks there (the player
// handles the tap).
export default class extends Controller {
  static targets = ["scroller", "empty", "now", "note", "resume", "resumeLabel", "notesEmpty"]
  static values = { mode: String, start: Number, end: Number, replay: Boolean }

  connect() {
    this.items = [...this.element.querySelectorAll("[data-start]")].map((el) => ({ el, start: Number(el.dataset.start), shown: null }))
    this.lines = this.items.filter((item) => item.el.hasAttribute("data-line"))
    this.following = true
    this.current = null
    this.detach = () => {
      if (this.inPlayer && this.following) {
        this.following = false
        this.updateResume()
      }
    }
    this.scrollerTarget.addEventListener("wheel", this.detach, { passive: true })
    this.scrollerTarget.addEventListener("touchmove", this.detach, { passive: true })
    this.offs = [on("tick", () => this.update()), on("state", () => this.update(true)), on("follow", () => this.resume())]
    this.update(true)
  }

  disconnect() {
    this.offs.forEach((off) => off())
  }

  get inPlayer() {
    return this.modeValue === "player"
  }

  update(force = false) {
    const now = state.now
    const second = Math.floor(now)
    if (second !== this.second || force) {
      this.second = second
      this.reveal(now)
    }
    this.highlight()
    this.updateResume()
  }

  reveal(now) {
    this.items.forEach((item) => {
      const shown = item.start <= now
      if (shown === item.shown) return
      item.shown = shown
      item.el.hidden = !shown
    })
    const live = now >= this.startValue && now < this.endValue
    this.emptyTarget.hidden = this.lines.some((line) => line.shown)
    if (this.hasNotesEmptyTarget) this.notesEmptyTarget.hidden = !!this.element.querySelector("[data-note-card]:not([hidden])")

    // On the Listen page the live show's transcript ends at the now line.
    this.nowTarget.hidden = this.inPlayer || !live
    if (!this.nowTarget.hidden) this.nowTarget.querySelector(".cp-nowline__lab").textContent = `${hm(now)} now, live`

    const note = live
      ? "Transcript is generated live and may contain errors."
      : this.replayValue
        ? "Transcript is machine-generated. Tap any line to play from there."
        : "Transcript is machine-generated."
    if (this.noteTarget.textContent !== note) this.noteTarget.textContent = note
  }

  highlight() {
    const t = state.playhead + 0.05
    let current = null
    if (state.started && t >= this.startValue && t < this.endValue) {
      // The last line that has started.
      let low = 0
      let high = this.lines.length - 1
      while (low <= high) {
        const middle = (low + high) >> 1
        if (this.lines[middle].start <= t) {
          current = this.lines[middle]
          low = middle + 1
        } else {
          high = middle - 1
        }
      }
    }
    if (current === this.current) return
    this.current?.el.classList.remove("is-cur")
    this.current?.el.removeAttribute("aria-current")
    this.current = current
    current?.el.classList.add("is-cur")
    current?.el.setAttribute("aria-current", "true")
    if (this.inPlayer && this.following) this.scrollToCurrent()
  }

  scrollToCurrent() {
    if (!this.current) return
    const scroller = this.scrollerTarget
    scroller.scrollTop = Math.max(0, this.current.el.offsetTop - scroller.clientHeight * 0.35)
  }

  resume() {
    this.following = true
    this.scrollToCurrent()
    this.updateResume()
  }

  updateResume() {
    if (!this.inPlayer) return
    this.resumeTarget.hidden = this.following || !state.started || !this.current
    const label = state.atLive ? "Back to the live line" : `Resume at ${hm(state.playhead)}`
    if (this.resumeLabelTarget.textContent !== label) this.resumeLabelTarget.textContent = label
  }
}
