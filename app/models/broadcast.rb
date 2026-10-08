# frozen_string_literal: true

# Loads a broadcast day for the Listening Companion prototype from the
# recordings in wbez-recordings/ and the show list in data/shows.yml.
# Plain Ruby objects, cached in memory. No database.
#
# All times are seconds since local midnight of the day's first airing, and run
# past 86,400 when the day crosses midnight.
class Broadcast
  RECORDINGS = Rails.root.join("wbez-recordings")
  CONFIG = Rails.root.join("data/shows.yml")
  DAY_SECONDS = 86_400
  DEFAULT_DAY = "stream"

  BREAK_TITLE = /underwriting|station (break|information|identification|support)|\bsupport\b|promotion|sponsor|news identification/i
  NEWS_MIN_SECONDS = 150
  LINE_MAX_CHARS = 260
  LINE_TARGET_CHARS = 120
  SENTENCE_END = /[.?!]/
  TRAILING_PUNCTUATION = /[.?!,"”’)]/

  Line = Struct.new(:start, :end, :text, keyword_init: true)

  Card = Struct.new(:story, :at, keyword_init: true)

  Segment = Struct.new(:id, :start, :end, :title, :summary, :kind, :lines, :cards, keyword_init: true) do
    def listed? = kind != :break
    def text = lines.map(&:text).join(" ")
  end

  Airing = Struct.new(:id, :name, :short, :color, :start, :end, :audio_path, :replayable,
                      :notes, :rundown, :segments, keyword_init: true) do
    def upcoming? = audio_path.nil?
    def listed_segments = segments.select(&:listed?)
    def lines = segments.flat_map(&:lines)
    def cards = segments.flat_map(&:cards).sort_by(&:at)
    def segment_at(time) = segments.reverse_each.find { |s| s.start <= time } || segments.first
  end

  class Day
    attr_reader :key, :label, :date_label, :airings, :search_word

    def initialize(key:, label:, date_label:, airings:, search_word: nil)
      @search_word = search_word
      @key = key
      @label = label
      @date_label = date_label
      @airings = airings
    end

    def recorded = airings.reject(&:upcoming?)
    def find_airing(id) = airings.find { |a| a.id == id.to_s }
    def airing_at(time) = airings.find { |a| time >= a.start && time < a.end }
    def segments = recorded.flat_map(&:segments)

    # The recording ends here; the demo clock stops just short of it.
    def audio_end = recorded.last.end

    # About 40 minutes into the latest hour of audio.
    def default_now = [recorded.last.start + 2400, audio_end - 60].min

    # "HH:MM" on this day's timeline, rolling past midnight when needed.
    def parse_clock(value)
      match = value.to_s.match(/\A(\d{1,2}):(\d{2})\z/) or return nil
      seconds = match[1].to_i * 3600 + match[2].to_i * 60
      seconds += DAY_SECONDS if seconds < airings.first.start - 3600
      seconds.clamp(airings.first.start, audio_end - 10)
    end

    # What the client needs to run the clock and the player.
    def as_client_json
      {
        key: key,
        defaultNow: default_now,
        audioEnd: audio_end,
        searchWord: search_word,
        cards: recorded.select(&:replayable).flat_map(&:cards).map(&:at).sort,
        airings: airings.map do |a|
          {
            id: a.id, name: a.name, short: a.short, color: a.color,
            start: a.start, end: a.end, replay: a.replayable, audio: a.audio_path,
            rundown: a.rundown,
            segments: a.segments.map { |s| { id: s.id, t: s.start, e: s.end, title: s.title, listed: s.listed? } }
          }
        end
      }
    end
  end

  class << self
    def day(key = DEFAULT_DAY)
      key = key.to_s.presence || DEFAULT_DAY
      @days ||= {}
      @days[[key, CONFIG.mtime, related_mtime]] ||= new(key).load
    end

    def day_keys = YAML.load_file(CONFIG).keys

    private

    def related_mtime = RelatedStories::CONFIG.exist? ? RelatedStories::CONFIG.mtime : nil
  end

  def initialize(key)
    @key = key
    @config = YAML.load_file(CONFIG).fetch(key) { raise ArgumentError, "No broadcast day named #{key.inspect} in data/shows.yml" }
    @offset = @config.fetch("utc_offset", -5) * 3600
  end

  def load
    airings = build_recorded
    airings += build_upcoming(after: airings.last.start)
    day = Day.new(key: @key, label: @config["label"], date_label: @config["date_label"], airings: airings,
                  search_word: @config["search_word"])
    RelatedStories.new(day).attach!
    day
  end

  private

  def build_recorded
    entries = @config.fetch("airings")
    starts = entries.map { |entry| local_start(entry) }
    base = starts.first.to_date
    previous = 0

    airings = entries.each_with_index.map do |entry, index|
      start = if entry["start"]
        clock_seconds(entry["start"], after: previous)
      else
        ((starts[index] - base.to_time(:utc)).to_i)
      end
      previous = start
      build_airing(entry, index, start)
    end

    # A recording that runs a few seconds into the next hour gives way to it.
    airings.each_cons(2) { |a, b| a.end = b.start if a.end > b.start }
    airings
  end

  def build_airing(entry, index, start)
    data = JSON.parse(RECORDINGS.join("#{entry["file"]}.json").read)
    chapters = data.fetch("chapters")
    names = [entry["name"], *entry["aliases"]].map { |n| normalize(n) }
    id = "a#{index}"

    segments = []
    program_chapters = []
    chapters.each do |chapter|
      if names.any? { |n| normalize(chapter["title"]).include?(n) }
        program_chapters << chapter
        chapter["subchapters"].each { |sub| segments << segment_from(sub, start, kind_for(sub, :program)) }
      elsif chapter["end_time"] - chapter["start_time"] >= NEWS_MIN_SECONDS
        chapter["subchapters"].each { |sub| segments << segment_from(sub, start, kind_for(sub, :news)) }
      else
        segments << break_segment(chapter, start)
      end
    end
    segments.sort_by!(&:start)
    segments.each_with_index { |segment, i| segment.id = "#{id}-#{i}" }

    duration = chapters.last["end_time"].ceil
    Airing.new(
      id: id, name: entry["name"], short: entry["short"], color: entry["color"],
      start: start, end: start + duration,
      audio_path: "/audio/#{entry["file"]}.#{entry.fetch("ext", "m4a")}",
      replayable: entry.fetch("replayable", true),
      notes: notes_from(program_chapters), rundown: nil, segments: segments
    )
  end

  def build_upcoming(after:)
    Array(@config["upcoming"]).each_with_index.map do |entry, index|
      start = clock_seconds(entry["start"], after: after)
      finish = clock_seconds(entry["end"], after: start)
      Airing.new(
        id: "u#{index}", name: entry["name"], short: entry["short"], color: entry["color"],
        start: start, end: finish, audio_path: nil, replayable: true,
        notes: nil, rundown: entry["rundown"], segments: []
      )
    end
  end

  def segment_from(sub, offset, kind)
    Segment.new(
      start: (offset + sub["start_time"]).round(1), end: (offset + sub["end_time"]).round(1),
      title: kind == :break ? "Station break" : sub["title"], summary: sub["summary"], kind: kind,
      lines: lines_from(sub["transcript"], offset), cards: []
    )
  end

  def break_segment(chapter, offset)
    lines = chapter["subchapters"].flat_map { |sub| lines_from(sub["transcript"], offset) }
    Segment.new(
      start: (offset + chapter["start_time"]).round(1), end: (offset + chapter["end_time"]).round(1),
      title: "Station break", summary: chapter["summary"], kind: :break,
      lines: lines.sort_by(&:start), cards: []
    )
  end

  def kind_for(sub, default) = sub["title"].match?(BREAK_TITLE) ? :break : default

  # One line per utterance; long utterances are split at sentence ends using
  # the word timings.
  def lines_from(transcript, offset)
    text = transcript["text"]
    words = transcript["words"]
    transcript["utterances"].sort_by { |u| u["start_time"] }.flat_map do |utterance|
      spoken = words.select do |w|
        w["speaker_id"] == utterance["speaker_id"] &&
          w["start_time"] >= utterance["start_time"] - 0.01 && w["start_time"] <= utterance["end_time"] + 0.01
      end

      if utterance["text"].length <= LINE_MAX_CHARS || spoken.empty?
        [line(offset, utterance["start_time"], utterance["end_time"], utterance["text"])]
      else
        split_sentences(text, spoken, offset)
      end
    end
  end

  def split_sentences(text, words, offset)
    lines = []
    chunk = []
    words.each do |word|
      chunk << word
      finish = word["text_end"]
      finish += 1 while text[finish]&.match?(TRAILING_PUNCTUATION)
      length = finish - chunk.first["text_start"]
      sentence_end = text[finish - 1]&.match?(SENTENCE_END)
      next unless (sentence_end && length >= LINE_TARGET_CHARS) || word.equal?(words.last)

      lines << line(offset, chunk.first["start_time"], word["end_time"], text[chunk.first["text_start"]...finish])
      chunk = []
    end
    lines
  end

  def line(offset, start, finish, text)
    Line.new(start: (offset + start).round(2), end: (offset + finish).round(2), text: text.strip)
  end

  # The summaries of the three longest stretches of the programme, in air order.
  def notes_from(chapters)
    chapters.max_by(3) { |c| c["end_time"] - c["start_time"] }
            .sort_by { |c| c["start_time"] }
            .map { |c| c["summary"] }.join(" ")
  end

  def local_start(entry)
    match = entry["file"].match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/)
    return Time.utc(2000, 1, 1) unless match

    Time.utc(*match.captures.map(&:to_i)) + @offset
  end

  # "HH:MM" as seconds on the day's timeline, rolled past midnight if needed.
  def clock_seconds(value, after:)
    hours, minutes = value.split(":").map(&:to_i)
    seconds = hours * 3600 + minutes * 60
    seconds += DAY_SECONDS while seconds < after
    seconds
  end

  def normalize(value) = value.to_s.downcase.gsub(/[^a-z0-9]+/, " ").strip
end
