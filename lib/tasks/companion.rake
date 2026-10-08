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

namespace :companion do
  desc "Export the recorded stream as static files for S3: bin/rails 'companion:export[prefix]'"
  task :export, [:prefix] => :environment do |_task, args|
    prefix = (args[:prefix] || "wbez-listening-companion").delete_prefix("/").delete_suffix("/")
    base = "/#{prefix}"
    out = Rails.root.join("tmp/companion-export", prefix)
    FileUtils.rm_rf(out)
    FileUtils.mkdir_p(out)

    day = Broadcast.day
    pages = {
      "/companion" => "index.html",
      "/companion?listen=b" => "b.html",
      "/companion/schedule" => "schedule.html",
      "/companion/discover" => "discover.html",
      "/companion/library" => "library.html",
      "/companion/search" => "search.html",
      "/companion/search-index" => "search-index.json"
    }
    day.recorded.each do |airing|
      %w[page player].each { |pane| pages["/companion/airings/#{airing.id}/#{pane}.html"] = "airings/#{airing.id}/#{pane}.html" }
    end

    # The app's absolute paths, moved under the prefix. Pages become .html
    # files because the bucket doesn't resolve directory indexes.
    rewrites = [
      [%r{/companion/search-index(?=["'])}, "#{base}/search-index.json"],
      [%r{/companion/airings/}, "#{base}/airings/"],
      [%r{/companion/(schedule|discover|library|search)(?=["'?])}, "#{base}/\\1.html"],
      [%r{/companion\?listen=b(?=["'])}, "#{base}/b.html"],
      [%r{/companion(\?listen=a)?(?=["'])}, "#{base}/index.html"],
      [%r{(?<=["'])/(assets|audio)/}, "#{base}/\\1/"]
    ]

    # Development marks every partial with an HTML comment; leave those out.
    ActionView::Base.annotate_rendered_view_with_filenames = false

    # The app only answers modern browsers (allow_browser), so the export poses as one.
    browser = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

    pages.each do |path, file|
      env = Rack::MockRequest.env_for("http://localhost#{path}", "HTTP_HOST" => "localhost", "HTTP_USER_AGENT" => browser,
                                                                 "HTTP_X_COMPANION_EXPORT" => "1")
      status, _headers, response = Rails.application.call(env)
      body = +""
      response.each { |chunk| body << chunk }
      response.close if response.respond_to?(:close)
      abort "#{path} returned #{status}" unless status == 200

      rewrites.each { |pattern, replacement| body.gsub!(pattern, replacement) }
      leftover = body[%r{.{40}["']/companion.{40}}m]
      abort "#{file} still links to /companion: #{leftover}" if leftover

      target = out.join(file)
      FileUtils.mkdir_p(target.dirname)
      target.write(body)
    end

    # Compiled CSS, JavaScript and images, with the same fingerprints the pages use.
    Rake::Task["assets:precompile"].invoke
    FileUtils.mv(Rails.public_path.join("assets"), out.join("assets"))

    referenced = out.glob("*.html").flat_map { |page| page.read.scan(%r{#{Regexp.escape(base)}/(assets/[^"'?#]+)}).flatten }.uniq
    missing = referenced.reject { |asset| out.join(asset).exist? }
    abort "Missing assets: #{missing.join(', ')}" if missing.any?

    audio = day.recorded.map { |airing| File.basename(airing.audio_path) }
    size = audio.sum { |name| Broadcast::RECORDINGS.join(name).size } / 1_000_000
    bucket = "s3://suntimes-graphics-staging/#{prefix}"
    includes = audio.map { |name| "--include #{name.shellescape}" }.join(" ")

    puts <<~TEXT

      Exported #{pages.size} pages to #{out.relative_path_from(Rails.root)}/
      Audio is not copied: #{audio.size} files, #{size} MB, uploaded straight from wbez-recordings/.

      Preview locally:
        ruby -run -e httpd tmp/companion-export -p 4000   # then open http://localhost:4000#{base}/index.html

      Deploy:
        aws s3 sync #{out.relative_path_from(Rails.root)}/ #{bucket}/ --profile suntimes --exclude "assets/*" --cache-control "no-cache"
        aws s3 sync #{out.relative_path_from(Rails.root)}/assets/ #{bucket}/assets/ --profile suntimes --cache-control "public, max-age=31536000"
        aws s3 sync wbez-recordings/ #{bucket}/audio/ --profile suntimes --exclude "*" #{includes} --content-type audio/mp4 --cache-control "public, max-age=86400"

      URL: https://graphics-stage.suntimes.com#{base}/index.html
    TEXT
  end
end
