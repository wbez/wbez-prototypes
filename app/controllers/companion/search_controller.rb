# frozen_string_literal: true

module Companion
  class SearchController < BaseController
    def index
      @active_tab = "listen"
      @query = params[:q].to_s.strip
      # Only what has aired by the demo clock's "now" is searchable.
      @at = params[:at].present? ? params[:at].to_f.clamp(@day.airings.first.start, @day.audio_end) : @day.default_now
      @results = @day.search(@query, before: @at)
    end
  end
end
