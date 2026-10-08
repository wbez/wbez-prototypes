import { Controller } from "@hotwired/stimulus"
import { state, SPEEDS, clockMin, clockMax, resetClock, emit, on } from "companion"

// Runs the demo clock. The audio is a recording, so "now" is simulated (see
// resetClock in companion.js for where it starts). Everything else reacts to
// the "tick" event.
const TICK_MS = 250

export default class extends Controller {
  connect() {
    // Arriving by Turbo from a page outside the prototype: start the clock now.
    if (!state.now) resetClock(new URLSearchParams(location.search))
    this.last = performance.now()
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.off = on("clock-set", (event) => this.set(event.detail))
  }

  disconnect() {
    clearInterval(this.timer)
    this.off()
  }

  tick() {
    const time = performance.now()
    const elapsed = (time - this.last) / 1000
    this.last = time
    state.now = Math.min(state.now + elapsed * state.speed, clockMax())
    emit("tick")
  }

  set({ now, speed, reset }) {
    if (reset) resetClock()
    if (SPEEDS.includes(speed)) state.speed = speed
    if (typeof now === "number") state.now = Math.min(Math.max(now, clockMin()), clockMax())
    emit("tick")
  }
}
