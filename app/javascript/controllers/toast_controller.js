import { Controller } from "@hotwired/stimulus"
import { on } from "companion"

// Short confirmations, announced politely to screen readers.
export default class extends Controller {
  static targets = ["message"]

  connect() {
    this.off = on("toast", (event) => this.show(event.detail.message))
  }

  disconnect() {
    this.off()
  }

  show(message) {
    this.messageTarget.textContent = message
    this.messageTarget.classList.add("is-on")
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.messageTarget.classList.remove("is-on"), 2200)
  }
}
