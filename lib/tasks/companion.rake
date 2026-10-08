# frozen_string_literal: true

namespace :companion do
  desc "Prepare local inputs for the Listening Companion prototype (audio remux, /audio link, feed snapshot)"
  task setup: :environment do
    require "open-uri"

    recordings = Broadcast::RECORDINGS
    abort "Put the recordings in #{recordings.relative_path_from(Rails.root)}/ first." unless recordings.directory?

    # Raw .aac has no duration or seek index, so browsers misreport its length.
    # Remuxing to .m4a fixes that without re-encoding.
    recordings.glob("*.aac").each do |source|
      target = source.sub_ext(".m4a")
      next if target.exist?

      puts "Remuxing #{source.basename}"
      system("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", source.to_s,
             "-c", "copy", "-bsf:a", "aac_adtstoasc", "-movflags", "+faststart", target.to_s) or
        abort "ffmpeg failed on #{source.basename}. Is ffmpeg installed?"
    end

    link = Rails.public_path.join("audio")
    unless link.exist?
      File.symlink("../wbez-recordings", link)
      puts "Linked public/audio"
    end

    if SunTimes.snapshot_path.nil?
      path = SunTimes::SNAPSHOTS.join("suntimes-#{Date.current.iso8601}.xml")
      FileUtils.mkdir_p(path.dirname)
      path.write(URI.open("https://chicago.suntimes.com/rss/index.xml").read)
      puts "Saved #{path.relative_path_from(Rails.root)}"
    end

    puts "Ready. Start bin/dev and open /companion"
  end
end
