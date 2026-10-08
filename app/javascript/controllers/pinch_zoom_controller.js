import { Controller } from "@hotwired/stimulus"
import { state, ui, airingAt, toast } from "companion"

// Listen variant B: semantic zoom over the day.
//
//   0 Titles      time, show, status
//   1 Notes       notes, segments, story chips
//   2 Transcript  the whole day as one transcript
//
// Pinch on touch, pinch on a trackpad (wheel + ctrlKey) or press + and −.
// The view scales while you pinch and changes level on release past a
// threshold. The show under your fingers stays where it is. The level control,
// tapping a title and the Transcript link do the same without a gesture.
const LEVELS = ["Titles", "Notes", "Transcript"]
const ZOOM_IN = 1.12
const ZOOM_OUT = 0.89
const HINT_KEY = "cp.zoomHintSeen"
const HOLD_MS = 5000 // keep the anchored show in place while transcripts above it load

export default class extends Controller {
  static targets = ["level", "wrap", "hint"]

  connect() {
    this.screen = document.getElementById("cp-screen")
    this.level = ui.zoom
    this.pinch = null
    this.wheelTotal = 0
    this.apply()
    this.hintTarget.hidden = this.hintSeen

    const distance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
    this.listeners = [
      [this.screen, "touchstart", (event) => {
        if (!this.active || event.touches.length !== 2) return
        this.pinch = { from: distance(event.touches), y: (event.touches[0].clientY + event.touches[1].clientY) / 2, scale: 1 }
      }, { passive: true }],
      [this.screen, "touchmove", (event) => {
        if (!this.pinch || event.touches.length !== 2) return
        event.preventDefault()
        this.pinch.scale = distance(event.touches) / this.pinch.from
        this.preview(this.pinch.scale, this.pinch.y)
      }, { passive: false }],
      [this.screen, "touchend", (event) => this.endPinch(event)],
      [this.screen, "touchcancel", (event) => this.endPinch(event)],
      [this.screen, "wheel", (event) => {
        // A trackpad pinch arrives as wheel events with ctrlKey set.
        if (!event.ctrlKey || !this.active) return
        event.preventDefault()
        this.wheelTotal += event.deltaY
        const scale = Math.exp(-this.wheelTotal / 90)
        const y = event.clientY
        this.preview(scale, y)
        clearTimeout(this.wheelTimer)
        this.wheelTimer = setTimeout(() => {
          this.wheelTotal = 0
          this.commit(scale, y)
        }, 170)
      }, { passive: false }],
      // Stop iOS Safari from zooming the page instead.
      [document, "gesturestart", (event) => { if (this.active) event.preventDefault() }, { passive: false }],
      [document, "gesturechange", (event) => { if (this.active) event.preventDefault() }, { passive: false }],
      [document, "keydown", (event) => {
        if (!this.active || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA/.test(event.target.tagName)) return
        if (event.key === "+" || event.key === "=") { event.preventDefault(); this.setLevel(this.level + 1) }
        else if (event.key === "-" || event.key === "_") { event.preventDefault(); this.setLevel(this.level - 1) }
      }],
      [this.element, "turbo:frame-load", () => this.holdAnchor()]
    ]
    this.listeners.forEach(([target, type, handler, options]) => target.addEventListener(type, handler, options))
  }

  disconnect() {
    this.listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options))
    clearTimeout(this.wheelTimer)
  }

  // Gestures are for the Listen page itself, not while a sheet covers it.
  get active() {
    return !document.querySelector(".cp-player.is-on, .cp-sheet.is-on")
  }

  get hintSeen() {
    try { return localStorage.getItem(HINT_KEY) === "1" } catch { return true }
  }

  // ---- Actions -----------------------------------------------------------

  pick(event) {
    this.setLevel(Number(event.currentTarget.dataset.level))
  }

  // Tap a title: its notes.
  open(event) {
    this.setLevel(1, null, event.currentTarget.dataset.show)
  }

  // "Transcript" link on a notes card.
  deep(event) {
    this.setLevel(2, null, event.currentTarget.dataset.show)
  }

  dismissHint() {
    this.hintTarget.hidden = true
    try { localStorage.setItem(HINT_KEY, "1") } catch { /* storage unavailable */ }
  }

  // ---- Pinch feedback ----------------------------------------------------

  preview(scale, y) {
    const wrap = this.wrapTarget
    const amount = scale > 1 ? 1 + Math.min(scale - 1, 0.7) * 0.3 : 1 - Math.min(1 - scale, 0.5) * 0.3
    const atEdge = (scale > 1 && this.level === 2) || (scale < 1 && this.level === 0)
    wrap.style.transition = "none"
    wrap.style.transformOrigin = `50% ${y - wrap.getBoundingClientRect().top}px`
    wrap.style.transform = `scale(${amount})`
    wrap.style.opacity = atEdge ? "1" : String(1 - Math.min(Math.abs(Math.log(scale)), 0.5) * 0.5)
  }

  endPinch(event) {
    if (!this.pinch || event.touches.length >= 2) return
    const { scale, y } = this.pinch
    this.pinch = null
    this.commit(scale, y)
  }

  commit(scale, y) {
    const wrap = this.wrapTarget
    wrap.style.transition = "transform .2s, opacity .2s"
    wrap.style.transform = ""
    wrap.style.opacity = ""
    if (scale > ZOOM_IN) this.setLevel(this.level + 1, y)
    else if (scale < ZOOM_OUT) this.setLevel(this.level - 1, y)
  }

  // ---- Levels ------------------------------------------------------------

  blocks(level = this.level) {
    return [...this.element.querySelectorAll(`.cp-zlevel--${level} .cp-zshow`)]
  }

  // Change level, keeping one show anchored: the one named, or the one at
  // height y (the pinch), or the one in the middle of the screen.
  setLevel(level, y = null, showId = null) {
    level = Math.min(Math.max(level, 0), 2)
    if (level === this.level) {
      toast(level === 2 ? "Already at the transcript" : "Already showing titles only")
      return
    }
    const screen = this.screen.getBoundingClientRect()
    y ??= screen.top + screen.height / 2

    const blocks = this.blocks()
    let anchor = showId ? blocks.find((block) => block.dataset.show === showId) : null
    anchor ||= blocks.find((block) => {
      const box = block.getBoundingClientRect()
      return box.top <= y && box.bottom >= y
    })
    anchor ||= blocks.reduce((best, block) => {
      const box = block.getBoundingClientRect()
      const distance = Math.min(Math.abs(box.top - y), Math.abs(box.bottom - y))
      return !best || distance < best.distance ? { block, distance } : best
    }, null)?.block
    const id = anchor?.dataset.show
    const offset = anchor ? anchor.getBoundingClientRect().top - screen.top : 0

    const zoomingIn = level > this.level
    this.level = level
    ui.zoom = level
    this.apply()
    if (!this.hintTarget.hidden) this.dismissHint()

    const wrap = this.wrapTarget
    const animation = zoomingIn ? "is-zooming-in" : "is-zooming-out"
    wrap.classList.add(animation)
    setTimeout(() => wrap.classList.remove(animation), 320)

    const target = this.blocks().find((block) => block.dataset.show === id)
    this.anchor = null
    if (target) {
      let top = offset
      if (zoomingIn) top = Math.min(offset, screen.height * 0.3)
      if (level === 0) top = Math.max(140, Math.min(offset, screen.height * 0.6))
      this.anchor = {
        target,
        top: Math.max(0, top),
        // Zooming into the live show's transcript lands on the now line.
        toNow: level === 2 && id === airingAt(state.now).id,
        until: performance.now() + HOLD_MS
      }
      this.holdAnchor()
    }
    toast(LEVELS[level])
  }

  // Transcripts load one show at a time and change the page's height, so this
  // runs again after each one until the hold expires.
  holdAnchor() {
    const anchor = this.anchor
    if (!anchor || performance.now() > anchor.until) return
    const screen = this.screen.getBoundingClientRect()
    const line = anchor.toNow ? anchor.target.querySelector(".cp-nowline:not([hidden])") : null
    if (line) {
      this.screen.scrollTop += line.getBoundingClientRect().top - screen.top - screen.height * 0.62
      this.anchor = null
    } else {
      this.screen.scrollTop += anchor.target.getBoundingClientRect().top - screen.top - anchor.top
    }
  }

  apply() {
    this.element.dataset.level = this.level
    this.levelTargets.forEach((button) => {
      const active = Number(button.dataset.level) === this.level
      button.classList.toggle("is-on", active)
      button.setAttribute("aria-pressed", active)
    })
  }
}
