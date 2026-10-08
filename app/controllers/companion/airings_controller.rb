# frozen_string_literal: true

module Companion
  class AiringsController < BaseController
    # The transcript of one airing, loaded into a Turbo Frame by the player
    # (with its notes) and by Listen variant B at the transcript zoom level.
    def transcript
      @airing = @day.find_airing(params[:id]) or return head(:not_found)
      @pane = params[:pane] == "player" ? "player" : "page"
      @frame_id = request.headers["Turbo-Frame"].presence || "transcript-#{@airing.id}"
      render layout: false
    end
  end
end
