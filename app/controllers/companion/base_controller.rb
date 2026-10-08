# frozen_string_literal: true

# Listening Companion prototype. Every page shares one broadcast day and the
# phone-style layout with the persistent player.
module Companion
  class BaseController < ApplicationController
    layout "companion"
    helper CompanionHelper

    before_action :set_day
    helper_method :static_export?

    private

    # True while `bin/rails companion:export` renders the pages to static files.
    def static_export?
      request.headers["X-Companion-Export"].present?
    end

    def set_day
      @day = Broadcast.day(params[:day])
    end

    # Keeps links on the sample day when that is the one being viewed.
    def default_url_options
      super.merge({ day: params[:day].presence }.compact)
    end
  end
end
