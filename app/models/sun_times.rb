# frozen_string_literal: true

# Chicago Sun-Times stories from the saved feed snapshot in data/rss/.
# Only the headline, image and a short excerpt are shown; the full text is kept
# for matching and never displayed.
class SunTimes
  SNAPSHOTS = Rails.root.join("data/rss")
  # Spanish-language La Voz items and non-news columns are left out.
  SKIPPED_SECTIONS = %w[la-voz horoscopes dear-abby letters-to-the-editor].freeze
  EXCERPT_CHARS = 200

  Story = Struct.new(:title, :url, :published_at, :image_url, :excerpt, :text, :section, :sample, keyword_init: true) do
    def sample? = sample == true
  end

  class << self
    def stories
      path = snapshot_path
      return [] unless path

      @stories ||= {}
      @stories[[path, path.mtime]] ||= parse(path)
    end

    def snapshot_path = SNAPSHOTS.glob("suntimes-*.xml").max

    private

    def parse(path)
      doc = Nokogiri::XML(path.read)
      doc.remove_namespaces!
      doc.xpath("//entry").filter_map { |entry| story_from(entry) }
    end

    def story_from(entry)
      url = entry.at("link")&.[]("href").to_s
      section = URI(url).path.split("/")[1].to_s
      return if SKIPPED_SECTIONS.include?(section)

      # The lead image is a real element; the body is escaped HTML text beside it.
      content = entry.at("content")
      body = Nokogiri::HTML.fragment(content.xpath("text()").text)
      paragraphs = body.css("p").map { |p| p.text.squish }.reject(&:empty?)

      Story.new(
        title: entry.at("title").text.squish,
        url: url,
        published_at: Time.zone.parse(entry.at("published").text),
        image_url: content.at("img")&.[]("src"),
        excerpt: paragraphs.first.to_s.truncate(EXCERPT_CHARS, separator: " "),
        text: paragraphs.join(" "),
        section: section,
        sample: false
      )
    rescue URI::InvalidURIError
      nil
    end
  end
end
