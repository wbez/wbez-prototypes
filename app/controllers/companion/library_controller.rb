# frozen_string_literal: true

module Companion
  class LibraryController < BaseController
    def show
      @active_tab = "library"
      @podcasts = DiscoverController::PODCASTS
    end
  end
end
