# frozen_string_literal: true

module Companion
  class ListenController < BaseController
    VARIANTS = %w[a b].freeze

    def show
      @active_tab = "listen"
      @variant = variant
    end

    private

    # ?listen=a|b switches the Listen variant and is remembered in a cookie
    # (the client mirrors it in localStorage).
    def variant
      requested = params[:listen].to_s.downcase
      if VARIANTS.include?(requested)
        cookies[:listen_variant] = { value: requested, expires: 1.year }
        requested
      else
        VARIANTS.include?(cookies[:listen_variant]) ? cookies[:listen_variant] : "a"
      end
    end
  end
end
