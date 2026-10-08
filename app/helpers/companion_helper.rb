# frozen_string_literal: true

# Display helpers for the Listening Companion prototype.
module CompanionHelper
  # Icons the Ferris set doesn't have. Stroke icons, sized by CSS.
  COMPANION_ICONS = {
    "chevron" => '<path d="M6 9l6 6 6-6"/>',
    "back" => '<path d="M15 5l-7 7 7 7"/>',
    "bell" => '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    "out" => '<path d="M8 16L17 7M9 7h8v8"/>',
    "share" => '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
    "save" => '<path d="M7 4h10v16l-5-4-5 4z"/>',
    "listen" => '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    "discover" => '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    "library" => '<path d="M5 4v16M10 4v16M15 5l4 15"/>',
    "queue" => '<path d="M4 6h12M4 11h12M4 16h7M17 14v6M14 17h6"/>',
    "queued" => '<path d="M4 6h12M4 11h12M4 16h7M14 17.5l2 2 4-4.5"/>',
    "zoom" => '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M10.5 8v5M8 10.5h5"/>',
    "pinch" => '<path d="M5 5l5 5M5 5h4M5 5v4M19 19l-5-5M19 19h-4M19 19v-4"/>',
    "info" => '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.5"/>'
  }.freeze

  def companion_icon(name, classes: nil)
    body = COMPANION_ICONS.fetch(name.to_s)
    tag.svg(body.html_safe, class: ["cp-icon", "cp-icon--#{name}", classes].compact.join(" "),
                            viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
                            "stroke-width": 2, "aria-hidden": true, focusable: false)
  end

  # "7:14 PM" for a time on the broadcast day's timeline.
  def companion_clock(seconds, with_seconds: false)
    seconds = seconds.to_i % Broadcast::DAY_SECONDS
    hour = seconds / 3600
    text = "#{(hour % 12).zero? ? 12 : hour % 12}:#{format('%02d', seconds / 60 % 60)}"
    text += ":#{format('%02d', seconds % 60)}" if with_seconds
    "#{text} #{hour < 12 ? 'AM' : 'PM'}"
  end

  # "7:14", for tight spots next to segment titles.
  def companion_hm(seconds) = companion_clock(seconds).split.first

  # "7 PM", or "5:31 PM" when the show didn't start on the hour.
  def companion_hour(seconds)
    label = companion_clock(seconds)
    label.sub(":00", "")
  end

  def companion_art(airing, classes: nil)
    tag.div(airing.short, class: ["cp-art", classes].compact.join(" "), style: "background: #{airing.color}", "aria-hidden": true)
  end

  def companion_tabs
    [
      { id: "listen", label: "Listen", href: companion_listen_path },
      { id: "discover", label: "Discover", href: companion_discover_path },
      { id: "library", label: "Library", href: companion_library_path }
    ]
  end
end
