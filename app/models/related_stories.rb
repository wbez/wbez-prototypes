# frozen_string_literal: true

# Attaches Sun-Times stories to the segments of a broadcast day.
#
# A story is suggested for a segment when names that are distinctive to that
# segment also appear, capitalised, in the story: either two separate names
# with one in the headline, or a full phrase that the headline echoes.
# Weak matches show nothing.
# data/related.yml can pin or block stories per segment, and supplies sample
# stories for the demo day.
class RelatedStories
  CONFIG = Rails.root.join("data/related.yml")
  PER_SEGMENT = 2
  MIN_SCORE = 6
  MIN_NAMES = 2
  # Points per matched name: a full phrase counts for more than a single word,
  # and a headline mention for more than one in the body.
  PHRASE_POINTS = { title: 6, body: 3 }.freeze
  WORD_POINTS = { title: 3, body: 1 }.freeze
  SUPPORT_POINTS_MAX = 2
  # A term found in more segments or stories than this says little about either.
  MAX_SEGMENT_SHARE = 0.04
  MAX_STORY_SHARE = 0.2

  STOPWORDS = %w[
    about after again also another around because been before being between both could does doing
    down during each even every first from going have having here into just know like made make many
    more most much never only other over people really right said same says should since some still
    such than that their them then there these they thing things think this those through time today
    very want well were what when where which while will with would year years your
  ].to_set.freeze

  # Capitalised words that are not useful as names.
  COMMON_NAMES = %w[
    Chicago Illinois America American Americans WBEZ NPR BBC Monday Tuesday Wednesday Thursday Friday
    Saturday Sunday January February March April June July August September October November December
    The And But Well Yeah Okay Thank Thanks President
  ].to_set.freeze

  def initialize(day, stories: SunTimes.stories)
    @day = day
    @stories = stories
    @config = (CONFIG.exist? ? YAML.load_file(CONFIG) : {}).fetch(day.key, {}) || {}
  end

  def attach!
    @day.recorded.each { |airing| attach_matches(airing) }
    attach_samples
    @day
  end

  # Scores for the debug page: every segment's best candidates, kept or not.
  def candidates(segment)
    scored(segment).first(3)
  end

  private

  def attach_matches(airing)
    used = Set.new
    pairs = airing.listed_segments.flat_map do |segment|
      scored(segment).map { |match| match.merge(segment: segment) }
    end

    pairs.sort_by { |pair| -pair[:score] }.each do |pair|
      segment = pair[:segment]
      next if pair[:score] < MIN_SCORE || used.include?(pair[:story].url)
      next if segment.cards.size >= PER_SEGMENT || blocked?(segment, pair[:story])

      used << pair[:story].url
      segment.cards << Broadcast::Card.new(story: pair[:story], at: anchor(segment, pair[:terms]))
    end

    airing.listed_segments.each do |segment|
      pinned(segment).each do |story|
        next if used.include?(story.url)

        used << story.url
        segment.cards.unshift(Broadcast::Card.new(story: story, at: anchor(segment, [])))
      end
      segment.cards.sort_by!(&:at)
    end
  end

  def scored(segment)
    names = distinctive_names(segment)
    words = distinctive_words(segment)
    return [] if names.empty?

    @stories.filter_map do |story|
      hits = names.select { |name| story_mentions?(story, name) }
      phrases = hits.select { |name| name.include?(" ") }
      singles = hits - phrases
      # A word that is only part of a matched phrase is not a second name.
      separate = singles.reject { |word| phrases.any? { |phrase| phrase.split.include?(word) } }
      in_title = hits.select { |name| story.title.match?(word_pattern(name)) }
      next if in_title.empty?
      next unless phrases.size + separate.size >= MIN_NAMES || phrases.any?

      score = hits.sum do |name|
        points = name.include?(" ") ? PHRASE_POINTS : WORD_POINTS
        in_title.include?(name) ? points[:title] : points[:body]
      end
      support = words.count { |word| "#{story.title} #{story.text}".downcase.include?(word) } * 0.25
      score += [support, SUPPORT_POINTS_MAX].min
      { story: story, score: score.round(1), terms: hits }
    end.sort_by { |match| -match[:score] }
  end

  # Capitalised names and phrases said in this segment and in few others.
  def distinctive_names(segment)
    names_in(segment).select { |name| rare_in_day?(name, :names) && rare_in_stories?(name) }
  end

  def distinctive_words(segment)
    words_in(segment).select { |word| rare_in_day?(word, :words) && rare_in_stories?(word) }
  end

  def names_in(segment)
    @names ||= {}
    @names[segment.id] ||= segment.lines.flat_map do |line|
      line.text.split(/(?<=[.?!])\s+/).flat_map do |sentence|
        sentence.scan(/\b[A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)*/).filter_map do |phrase|
          parts = phrase.split.reject { |part| COMMON_NAMES.include?(part) }
          next if parts.empty?
          # A lone capitalised word at the start of a sentence is usually not a name.
          next if parts.size == 1 && (sentence.start_with?(phrase) || parts.first.length < 4)

          # Keep the full phrase and its longer words, so "Obama Presidential
          # Center" can meet a headline that only says "Obama".
          [parts.join(" "), *(parts.select { |part| part.length >= 5 } if parts.size > 1)]
        end
      end
    end.flatten.uniq
  end

  def words_in(segment)
    @words ||= {}
    @words[segment.id] ||= segment.text.downcase.scan(/[a-z']{5,}/).reject { |w| STOPWORDS.include?(w) }.uniq
  end

  def rare_in_day?(term, kind)
    @segment_counts ||= {}
    counts = @segment_counts[kind] ||= @day.segments.select(&:listed?).each_with_object(Hash.new(0)) do |segment, tally|
      (kind == :names ? names_in(segment) : words_in(segment)).each { |t| tally[t] += 1 }
    end
    counts[term] <= [3, (@day.segments.size * MAX_SEGMENT_SHARE).ceil].max
  end

  def rare_in_stories?(term)
    @story_counts ||= Hash.new do |hash, key|
      hash[key] = @stories.count { |story| story_mentions?(story, key) }
    end
    @story_counts[term] <= [2, (@stories.size * MAX_STORY_SHARE).ceil].max
  end

  def story_mentions?(story, term)
    @haystacks ||= {}
    haystack = @haystacks[story.url] ||= "#{story.title} #{story.text}"
    haystack.match?(word_pattern(term))
  end

  def word_pattern(term)
    @patterns ||= {}
    @patterns[term] ||= /\b#{Regexp.escape(term)}\b/
  end

  # The first line in the segment that mentions a matched term.
  def anchor(segment, terms)
    line = segment.lines.find { |l| terms.any? { |term| l.text.match?(word_pattern(term)) } }
    (line || segment.lines[1] || segment.lines.first)&.start || segment.start
  end

  def pinned(segment)
    urls = Array((@config["pin"] || {})[clock(segment.start)])
    @stories.select { |story| urls.include?(story.url) }
  end

  def blocked?(segment, story)
    blocked = Array((@config["block"] || {})[clock(segment.start)])
    blocked.include?("all") || blocked.include?(story.url)
  end

  def attach_samples
    Array(@config["samples"]).each do |sample|
      airings = @day.recorded.select { |a| sample["show"].nil? || a.name == sample["show"] }
      segment = airings.flat_map(&:listed_segments).find { |s| s.title == sample["segment"] && s.cards.none? { |c| c.story.sample? } }
      next unless segment

      story = SunTimes::Story.new(
        title: sample["title"], url: "https://chicago.suntimes.com/", published_at: nil, image_url: nil,
        excerpt: "Placeholder story for the demo. Not a real Sun-Times article.", text: "", section: "sample", sample: true
      )
      phrase = sample["phrase"].to_s.downcase
      line = segment.lines.find { |l| l.text.downcase.include?(phrase) } if phrase.present?
      segment.cards << Broadcast::Card.new(story: story, at: (line || segment.lines[1] || segment.lines.first).start)
      segment.cards.sort_by!(&:at)
    end
  end

  def clock(seconds)
    seconds = seconds.to_i % Broadcast::DAY_SECONDS
    format("%02d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60)
  end
end
