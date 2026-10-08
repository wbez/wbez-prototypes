# frozen_string_literal: true

module Companion
  class ScheduleController < BaseController
    def index
      @active_tab = "listen"
    end
  end
end
