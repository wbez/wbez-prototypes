import { Controller } from "@hotwired/stimulus"
import { state, day, airingAt, clock12, emit, on, toast, store } from "companion"

// Desktop-only panel beside the phone: clock readout, speed, the A/B switch
// and shortcuts into each journey on the demo checklist.
const VARIANT_KEY = "cp.listen"

export default class extends Controller {
  static targets = ["clock", "speed", "variant"]

  connect() {
    this.off = on("tick", () => this.render())
    this.onLoad = () => this.rememberVariant()
    document.addEventListener("turbo:load", this.onLoad)
    this.rememberVariant()
    this.render()
  }

  disconnect() {
    this.off()
    document.removeEventListener("turbo:load", this.onLoad)
  }

  render() {
    const text = clock12(state.now, true)
    if (this.clockTarget.textContent !== text) this.clockTarget.textContent = text
    this.speedTargets.forEach((button) => {
      const active = Number(button.dataset.speed) === state.speed
      button.classList.toggle("is-on", active)
      button.setAttribute("aria-pressed", active)
    })
  }

  // ?listen=a|b picks the Listen variant. The server keeps it in a cookie;
  // it is mirrored here so the panel can show which one is on.
  rememberVariant() {
    const requested = new URLSearchParams(location.search).get("listen")
    const rendered = document.querySelector("[data-variant]")?.dataset.variant
    let current = "a"
    try {
      if (requested === "a" || requested === "b") localStorage.setItem(VARIANT_KEY, requested)
      const stored = localStorage.getItem(VARIANT_KEY)
      // A static export has no server to remember the choice, so the Listen
      // tab always points at A. Send people who picked B back to it.
      if (this.isStatic && rendered && stored && stored !== rendered) {
        const other = this.variantTargets.find((link) => link.dataset.variant === stored)
        if (other) return window.Turbo.visit(other.href, { action: "replace" })
      }
      if (rendered && !stored) localStorage.setItem(VARIANT_KEY, rendered)
      current = rendered || stored || "a"
    } catch {
      current = rendered || "a"
    }
    this.variantTargets.forEach((link) => link.classList.toggle("is-on", link.dataset.variant === current))
  }

  // Choosing a variant in the panel.
  pickVariant(event) {
    try {
      localStorage.setItem(VARIANT_KEY, event.currentTarget.dataset.variant)
    } catch {
      // storage unavailable: the link still works
    }
  }

  get isStatic() {
    return this.element.hasAttribute("data-static")
  }

  speed(event) {
    emit("clock-set", { speed: Number(event.currentTarget.dataset.speed) })
  }

  // Two minutes before the top of the hour, to watch the handoff.
  jump() {
    const target = airingAt(state.now).end - 120
    if (target <= state.now) return toast("Already in the last two minutes")
    emit("clock-set", { now: target })
    toast(`Clock moved to ${clock12(target)}`)
  }

  reset() {
    emit("clock-set", { reset: true })
    emit("reset")
    store.clear()
    toast(`Reset to ${clock12(day().defaultNow)}`)
  }

  journey(event) {
    const { journey, path } = event.currentTarget.dataset
    const run = () => this[`${journey}Journey`]?.()
    if (journey === "search") return this.visit(`${path}?q=${encodeURIComponent(day().searchWord || "")}&at=${state.now.toFixed(1)}`, run)
    path ? this.visit(path, run) : run()
  }

  visit(path, then) {
    if (location.pathname + location.search === path) return then()
    document.addEventListener("turbo:load", then, { once: true })
    window.Turbo.visit(path)
  }

  liveJourney() {
    toast("Tap play on the live card")
  }

  searchJourney() {
    toast("Play from a line, or save it")
  }

  timeshiftJourney() {
    emit("player-do", { act: "liveopen" })
    toast("Try pause or skip back")
  }

  // Open the most recent finished show that can be replayed.
  catchupJourney() {
    const earlier = day().airings.filter((a) => a.audio && a.replay && a.end <= state.now).pop()
    if (!earlier) return toast("Nothing has finished airing yet")
    emit("expand", { id: earlier.id })
    toast("Add a few segments to your queue, then play one")
  }

  // Start a few seconds before the latest story card so it appears as you listen.
  deeperJourney() {
    const card = (day().cards || []).filter((t) => t < state.now - 30).pop()
    if (card === undefined) return toast("No Sun-Times stories matched this broadcast. Try Sample content.")
    emit("player-do", { act: "seekopen", t: card - 8 })
    toast("A story card appears in a few seconds")
  }

  notifyJourney() {
    const screen = document.getElementById("cp-screen")
    screen.scrollTop = screen.scrollHeight
    toast("Tap a bell on an upcoming show")
  }

  zoomJourney() {
    toast("Pinch, or use the level control")
  }
}
