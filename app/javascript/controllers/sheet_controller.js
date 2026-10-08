import { Controller } from "@hotwired/stimulus"

// Bottom sheets (the Donate placeholder). Opened by any button with
// data-act="sheet-open" data-sheet="<name>".
export default class extends Controller {
  static targets = ["sheet", "scrim"]

  connect() {
    this.onClick = (event) => {
      const el = event.target.closest("[data-act]")
      if (el?.dataset.act === "sheet-open") this.open(el.dataset.sheet, el)
      else if (el?.dataset.act === "sheet-close") this.close()
    }
    this.onKey = (event) => {
      if (event.key === "Escape" && this.current) this.close()
    }
    document.addEventListener("click", this.onClick)
    document.addEventListener("keydown", this.onKey)
  }

  disconnect() {
    document.removeEventListener("click", this.onClick)
    document.removeEventListener("keydown", this.onKey)
  }

  open(name, opener) {
    const sheet = this.sheetTargets.find((el) => el.id === `cp-sheet-${name}`)
    if (!sheet) return
    this.current = sheet
    this.opener = opener
    sheet.inert = false
    sheet.classList.add("is-on")
    this.scrimTarget.classList.add("is-on")
    sheet.querySelector("button, a")?.focus()
  }

  close() {
    if (!this.current) return
    this.current.classList.remove("is-on")
    this.current.inert = true
    this.scrimTarget.classList.remove("is-on")
    this.current = null
    if (this.opener?.isConnected) this.opener.focus()
  }
}
