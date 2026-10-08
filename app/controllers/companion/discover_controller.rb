# frozen_string_literal: true

module Companion
  class DiscoverController < BaseController
    # Stub data: podcasts are not part of the recordings.
    PODCASTS = [
      { name: "In the Loop", color: "#7a4fa0", kind: "Daily", order: "Newest first" },
      { name: "The Rundown", color: "#5f8a2a", kind: "Daily, 1 min", order: "Newest first" },
      { name: "16 Shots", color: "#333333", kind: "Series, 9 episodes", order: "Starts at episode 1" },
      { name: "Motive", color: "#8a2a45", kind: "Series, multiple seasons", order: "Starts at episode 1" },
      { name: "Becoming Bovino", color: "#4b5a3a", kind: "Series", order: "Starts at episode 1" },
      { name: "Curious City", color: "#2f6c8f", kind: "Weekly", order: "Newest first" },
      { name: "Say More", color: "#c0462e", kind: "Daily", order: "Newest first" },
      { name: "Art of Power", color: "#7b4bb0", kind: "Weekly", order: "Newest first" }
    ].freeze

    def index
      @active_tab = "discover"
      @podcasts = PODCASTS
    end
  end
end
