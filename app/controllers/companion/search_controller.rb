# frozen_string_literal: true

module Companion
  # Search runs in the browser (see search_controller.js) so that it only finds
  # what has aired by the demo clock's "now", and so the prototype also works
  # as a static export. This serves the page and the transcript lines it searches.
  class SearchController < BaseController
    def index
      @active_tab = "listen"
    end

    def lines
      airings = @day.recorded
      render json: {
        airings: airings.map { |a| { id: a.id, name: a.name, short: a.short, color: a.color, replay: a.replayable } },
        # [start, text, airing index, segment title]
        lines: airings.each_with_index.flat_map do |airing, index|
          airing.segments.flat_map { |segment| segment.lines.map { |line| [line.start, line.text, index, segment.title] } }
        end
      }
    end
  end
end
