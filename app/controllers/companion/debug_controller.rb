# frozen_string_literal: true

module Companion
  # Lists what the loaders produced: airings, segments, line counts and the
  # stories matched to each segment.
  class DebugController < BaseController
    def show
      @active_tab = "listen"
      @matcher = RelatedStories.new(@day)
      render layout: "application"
    end
  end
end
