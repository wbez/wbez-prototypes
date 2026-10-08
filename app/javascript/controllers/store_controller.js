import { Controller } from "@hotwired/stimulus"
import { state, airingAt, clock12, esc, on, toast, store, icon, queueItem, artHTML, queueRowsHTML } from "companion"

// Queue, saved moments, alerts and follows. Keeps them in localStorage and
// redraws every place they show up: the mini player badge, the queue card,
// bells, queue buttons, follow buttons and the Library lists.
const ACTS = ["queue", "unqueue", "clearqueue", "notify", "follow", "autodl", "saveline", "unsave"]

export default class extends Controller {
  static targets = ["badge", "badgeCount"]

  connect() {
    this.onClick = (event) => this.click(event)
    this.redraw = () => this.render()
    document.addEventListener("click", this.onClick)
    document.addEventListener("turbo:load", this.redraw)
    document.addEventListener("turbo:frame-load", this.redraw)
    this.offs = [on("store", this.redraw), on("state", this.redraw)]
    this.render()
  }

  disconnect() {
    document.removeEventListener("click", this.onClick)
    document.removeEventListener("turbo:load", this.redraw)
    document.removeEventListener("turbo:frame-load", this.redraw)
    this.offs.forEach((off) => off())
  }

  click(event) {
    const el = event.target.closest("[data-act]")
    if (!el || !ACTS.includes(el.dataset.act)) return
    const { t, i, id, name, text } = el.dataset
    switch (el.dataset.act) {
      case "queue": this.toggleQueue(Number(t)); break
      case "unqueue": this.removeAt("queue", Number(i)); break
      case "clearqueue": store.set("queue", []); toast("Queue cleared"); break
      case "notify": this.toggleAlert(id, name); break
      case "follow": toast(store.toggle("follows", name) ? `Following ${name}` : `Unfollowed ${name}`); break
      case "autodl": store.toggle("autodl", name); break
      case "saveline": this.save(Number(t), text); break
      case "unsave": this.removeAt("saved", Number(i)); break
    }
  }

  toggleQueue(t) {
    if (!airingAt(t).replay) return toast("Not available for replay")
    const queue = store.get("queue")
    const index = queue.findIndex((item) => item.t === t)
    if (index >= 0) {
      queue.splice(index, 1)
      toast("Removed from queue")
    } else {
      queue.push(queueItem(t))
      toast(this.waiting ? "Added to queue. Plays after you leave live" : "Added to queue")
    }
    store.set("queue", queue)
  }

  // One tap, show-level only: notify me when this show goes live.
  toggleAlert(id, name) {
    toast(store.toggle("alerts", id) ? `We'll notify you when ${name} goes live` : `Alert off for ${name}`)
  }

  save(t, text) {
    const airing = airingAt(t)
    const saved = store.get("saved").filter((item) => item.t !== t)
    saved.push({ t, text, name: airing.name, short: airing.short, color: airing.color, replay: airing.replay })
    store.set("saved", saved)
    toast("Saved to Library")
  }

  removeAt(name, index) {
    const list = store.get(name)
    list.splice(index, 1)
    store.set(name, list)
  }

  // The queue never interrupts live; it waits.
  get waiting() {
    return state.started && state.atLive && state.playing
  }

  render() {
    const queue = store.get("queue")
    const alerts = store.get("alerts")
    const follows = store.get("follows")

    this.badgeTarget.hidden = queue.length === 0
    this.badgeCountTarget.textContent = queue.length
    this.badgeTarget.setAttribute("aria-label", `Queue, ${queue.length} item${queue.length === 1 ? "" : "s"}`)

    document.querySelectorAll("[data-queue-toggle]").forEach((el) => {
      const queued = queue.some((item) => item.t === Number(el.dataset.t))
      el.classList.toggle("is-on", queued)
      el.setAttribute("aria-pressed", queued)
      if (el.hasAttribute("data-queue-label")) el.textContent = queued ? "Queued" : "Add to queue"
    })

    document.querySelectorAll("[data-bell]").forEach((el) => {
      const active = alerts.includes(el.dataset.id)
      el.classList.toggle("is-on", active)
      el.setAttribute("aria-pressed", active)
      if (el.hasAttribute("data-bell-label")) el.querySelector("span").textContent = active ? "We'll notify you" : "Notify me when live"
    })

    document.querySelectorAll("[data-follow]").forEach((el) => {
      const following = follows.includes(el.dataset.name)
      el.classList.toggle("is-on", following)
      el.setAttribute("aria-pressed", following)
      el.textContent = following ? "Following" : "Follow"
    })

    document.querySelectorAll("[data-queue-card]").forEach((el) => this.renderQueueCard(el, queue))
    document.querySelectorAll("[data-saved-list]").forEach((el) => this.renderSaved(el))
    document.querySelectorAll("[data-follow-list]").forEach((el) => this.renderFollows(el, follows))
  }

  renderQueueCard(el, queue) {
    const limit = Number(el.dataset.limit)
    let html = ""
    if (!queue.length) {
      html = el.dataset.empty ? `<p class="cp-small cp-pad">${esc(el.dataset.empty)}</p>` : ""
    } else {
      const more = limit && queue.length > limit
      html = `<section class="cp-qcard" aria-label="Your queue">
        <div class="cp-qcard__head"><b>Your queue</b><span class="cp-tiny">${queue.length} item${queue.length === 1 ? "" : "s"}</span>
          <button type="button" class="cp-pillbtn" data-act="playqueue">${icon("play")}Play</button></div>
        ${this.waiting ? '<p class="cp-tiny">Waiting while you listen live</p>' : ""}
        ${queueRowsHTML(limit)}
        <div class="cp-qcard__foot">${more
          ? `<button type="button" class="cp-link" data-act="openqueue">See all ${queue.length}</button>`
          : '<button type="button" class="cp-small" data-act="clearqueue">Clear</button>'}</div>
      </section>`
    }
    if (el.innerHTML !== html) el.innerHTML = html
  }

  renderSaved(el) {
    const saved = store.get("saved")
    const html = saved.length
      ? saved.map((item, i) => ({ item, i })).reverse().map(({ item, i }) => `<div class="cp-listrow">
          ${artHTML(item)}
          <div class="cp-grow"><div class="cp-saved__text">“${esc(item.text)}”</div><div class="cp-tiny">${esc(item.name)}, ${clock12(item.t)}</div></div>
          ${item.replay ? `<button type="button" class="cp-miniplay" data-act="seekopen" data-t="${item.t}" aria-label="Play from here">${icon("play")}</button>` : ""}
          <button type="button" class="cp-qbtn" data-act="unsave" data-i="${i}" aria-label="Remove saved moment">${icon("times")}</button>
        </div>`).join("")
      : `<p class="cp-small">${esc(el.dataset.empty)}</p>`
    if (el.innerHTML !== html) el.innerHTML = html
  }

  renderFollows(el, follows) {
    const autodl = store.get("autodl")
    const podcasts = JSON.parse(el.dataset.podcasts).filter((p) => follows.includes(p.name))
    const html = podcasts.length
      ? podcasts.map((p) => {
          const on = autodl.includes(p.name)
          const initials = p.name.split(" ").map((word) => word[0]).join("").slice(0, 3)
          return `<div class="cp-listrow">
            ${artHTML({ short: initials, color: p.color })}
            <div class="cp-grow"><b>${esc(p.name)}</b><div class="cp-tiny">${esc(p.order)}</div></div>
            <span class="cp-tiny">Auto-download</span>
            <button type="button" class="cp-switch ${on ? "is-on" : ""}" data-act="autodl" data-name="${esc(p.name)}" role="switch" aria-checked="${on}" aria-label="Auto-download ${esc(p.name)}"></button>
          </div>`
        }).join("")
      : `<p class="cp-small">${esc(el.dataset.empty)}</p>`
    if (el.innerHTML !== html) el.innerHTML = html
  }
}
