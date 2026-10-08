import { Controller } from "@hotwired/stimulus"
import { state } from "companion"

// Searches as you type. The demo clock's "now" goes along with each search,
// so only what has aired so far can be found.
export default class extends Controller {
  static targets = ["input", "at"]

  connect() {
    this.stamp()
    const input = this.inputTarget
    input.setSelectionRange(input.value.length, input.value.length)
  }

  disconnect() {
    clearTimeout(this.timer)
  }

  queue() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.element.requestSubmit(), 250)
  }

  stamp() {
    this.atTarget.value = state.now.toFixed(1)
  }
}
