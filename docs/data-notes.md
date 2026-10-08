# Data notes (Phase 0)

What is in `wbez-recordings/` and in the Sun-Times feed snapshot, as inspected on 2026-10-08.

## Recordings: what's there

26 files, 408 MB: 11 `.aac`, 1 `.mp3`, 14 `.json`.

| Audio | Local time (CDT) | Length | Main show |
|---|---|---|---|
| `wbez_2026-09-27_22-31-38.aac` | Sun Sep 27, 5:31 PM | 28:31 | How I Built This (joined mid-show) |
| `wbez_2026-09-27_23-00-00.aac` | Sun 6:00 PM | 60:00 | The New Yorker Radio Hour |
| `wbez_2026-09-28_00-00-00.aac` | Sun 7:00 PM | 60:00 | Hidden Brain |
| `wbez_2026-09-28_01-00-00.aac` | Sun 8:00 PM | 60:00 | This American Life |
| `wbez_2026-09-28_02-00-00.aac` | Sun 9:00 PM | 60:00 | Snap Judgment |
| `wbez_2026-09-28_03-00-00.aac` | Sun 10:00 PM | 60:00 | Vocalo Hotline (music) |
| `wbez_2026-09-28_04-00-00.aac` | Sun 11:00 PM | 60:00 | World Cafe (music) |
| `wbez_2026-09-28_05-00-00.aac` | Mon Sep 28, 12:00 AM | 60:00 | BBC Newsday |
| `wbez_2026-09-28_06-00-00.aac` | Mon 1:00 AM | 60:00 | BBC Newsday |
| `wbez_2026-09-28_07-00-00.aac` | Mon 2:00 AM | 60:00 | BBC The History Hour |
| `wbez_2026-09-29_13-00-00.aac` | Tue Sep 29, 8:00 AM | 60:00 | Morning Edition |
| `in_the_loop.mp3` | a Friday, undated | 60:00 | In the Loop (weekly news recap) |

- **The first ten files are one continuous block:** Sunday 5:31 PM to Monday 3:00 AM CDT, 9.5 hours. The 5:31 file runs to 6:00:09, overlapping the 6:00 file by about 9 seconds.
- **The Tuesday 8 AM hour stands alone,** about 29 hours after the block ends.
- **In the Loop has no date in its filename or metadata.** The host says "It's Friday", so it is most likely Friday Sep 25, 2026. It is a 192 kbps MP3; the others are 64 kbps stereo ADTS AAC at 44.1 kHz.

## Pairing

- **Hourly files pair by basename:** `wbez_<date>_<time>.aac` with `wbez_<date>_<time>.json`.
- **`in_the_loop.mp3` pairs with `in_the_loop.json`** (same structure as the hourly JSON) and also with `in_the_loop.alignment.fullshow.clips.json`.
- **`260928_SM.alignment.fullshow.clips.json` has no audio.** It is a Say More episode from Monday Sep 28 ("Should kids play tackle football?"). There is no matching audio file and no hourly JSON for it.

## Timing

- **Filename timestamps are UTC.** Evidence: 282 seconds into `wbez_2026-09-29_13-00-00`, the newsreader says "at 8:04". 13:04 UTC is 8:04 AM CDT.
- **All JSON times are seconds, as floats, relative to the start of that audio file.** They are not wall-clock times. Wall clock = filename timestamp + offset.
- **Word-level timing is present,** to roughly 10 ms.
- **`afinfo` under-reports the AAC durations** (for example 2,920 seconds for a file that decodes to 3,600). ADTS has no duration header, so tools estimate. A full decode with ffmpeg gives 60:00, which matches the JSON. Browsers will have the same problem; see Gaps.

## Hourly JSON structure

```
chapters[]                 6–10 per hour
  title, summary, start_time, end_time
  subchapters[]            17–52 per hour
    title, summary, start_time, end_time
    transcript
      text                 whole subchapter as one string
      utterances[]         start_time, end_time, speaker_id, text
      words[]              word, start_time, end_time, speaker_id, text_start, text_end
      display              { text, time_indices[] } — same text, one [start, end] pair per word
```

- **Totals across the 11 hourly files:** 3,159 utterances, about 92,000 words.
- **Utterances are the natural "line".** Median 5.4 seconds and 86 characters. The longest is 135 seconds and 2,182 characters, so long ones need splitting into sentences using the word timings.
- **Speaker IDs exist** (`speaker_1` to `speaker_8`, reset per file, no names). The plan says not to show them.
- **15 utterances start before the previous one ends** (overlapping speakers). Sort by start time when loading.
- **Summaries are already written** at both chapter and subchapter level, for example "Reports attendance and features at the Obama Presidential Center." These can serve as the generated notes.

## Are shows and segments marked?

Partly. Segments are in good shape; shows need deriving.

- **Subchapters work as segments as they are.** Each has a short title ("Climate Displacement", "Traffic Report"), a one-line summary and start and end times.
- **Chapters are not shows.** A chapter is a contiguous block, and an hour alternates between the programme and station breaks: Hidden Brain, WBEZ Support, Hidden Brain, WBEZ Support.
- **Chapter titles are inconsistent.** Station breaks appear as "WBEZ News", "WBEZ Promotions", "WBEZ Promos", "WBEZ Support", "WBEZ Underwriting", "WBEZ Announcements" and "WBEZ Station Break". One show appears under two names ("World Cafe" and "Conversations from the World Cafe"; "Newsday" and "BBC World Service"). A 43-second promo at 7 PM is titled "Vocalo Hotline".
- **There is no show-level record:** no canonical show name, host, artwork, scheduled start and end, or replay rights.
- **The transcripts are machine-generated and show it:** "BEZ", "WBEC News", "Samoore" for Say More.

## Clip-plan JSON (the two `.alignment.fullshow.clips.json` files)

- **A different schema** (`clip_plan.v1`): one clip per episode with a title, a summary and four `ranges`.
- **Each range is a stretch of the show with the breaks cut out,** carrying its own transcript in the same shape as above. Times are seconds into the full-hour audio.
- **Useful as a podcast-style cut of In the Loop.** The hourly-style `in_the_loop.json` already covers the same audio in more detail.

## Sun-Times feed

Saved once to `data/rss/suntimes-2026-10-08.xml` (665 KB, HTTP 200).

- **It is an Atom feed,** although it is served as `text/html`. It parses cleanly with Nokogiri.
- **55 entries.** Each has `title`, `link` (the `href` attribute), `id`, `published`, `updated`, `author/name` (one to three) and `content`.
- **The lead image is a real `<img>` element** as the first child of `content`, in all 55 entries. The article body follows as escaped HTML text in the same element, so the two need reading differently.
- **Bodies are full text:** 75 to 1,855 words, median 651.
- **Coverage is about 32 hours:** Tue Oct 6, 4:05 PM to Thu Oct 8, 12:01 AM CDT.
- **Four entries are Spanish-language La Voz** (path starts `/la-voz/`). Nothing in the entry marks the language, so filter on the path.
- **Sections skew to sport and crime:** White Sox 11, crime 9, Blackhawks 3, Bears 3, Bulls 2. Also two horoscopes, Dear Abby and a letters page, which should be excluded from matching.

## Date overlap: flagged

**The stories and the audio do not overlap.** The audio is from Sep 25 to Sep 29. The stories are from Oct 6 to Oct 8, nine or more days later.

Topic overlap is thin as well, because most of the audio is national or international programming. Mentions of terms from the feed's headlines, per file:

| Audio | Feed topics mentioned |
|---|---|
| Sunday evening and overnight (10 files) | Almost none: "housing" in passing, one or two stray sports mentions |
| Tue 8 AM Morning Edition | White Sox 3, Cubs 3, Bears 2, Amazon 2, AI 2, Obama, Pritzker, City Council |
| In the Loop | Cubs 9, Bears 8, housing 7, City Council 6, White Sox 4, Pritzker 3, Mayor Johnson 2, Obama 2 |

Automatic matching will find real pairs only in Morning Edition and In the Loop, and those will mostly be sports.

## Gaps and proposed fixes

1. **Show identity.** Write `data/shows.yml` by hand: one entry per audio file with show name, start and end, a replayable flag and artwork colour. Use it to relabel chapters, treating anything not matching the hour's show as a break.
2. **Which day is "today"?** The plan assumes one broadcast day with a live hour. The continuous block is a Sunday night of syndicated shows, and the local content is in two separate hours. Options:
   - **A. Use the Sunday block as recorded.** Honest and continuous, but little Chicago content and few related stories.
   - **B. Compose a demo day in `shows.yml`.** Place Morning Edition and In the Loop on the same timeline as some of the Sunday shows, with the live hour set to In the Loop or Morning Edition. This is what makes related stories and local segments show up. Recommended.
3. **Related stories.** With B, pin matches by hand in `data/related.yml` for the two local hours. A fresh feed snapshot will not help, since the audio's dates have passed.
4. **Rights flag.** This American Life, Snap Judgment and the BBC hours are natural candidates for `replayable: false`, to demonstrate a restricted show.
5. **Raw `.aac` in the browser.** ADTS files carry no duration or seek index, so browsers may report the wrong length and seek imprecisely. Proposed fix: remux once to `.m4a` with `ffmpeg -c copy` (no re-encode, seconds per file). ffmpeg is installed at `~/bin/ffmpeg`. To be confirmed in Chrome and Safari in Phase 1.
6. **Long utterances.** Split at sentence ends using `words[].text_start`, so each line is a sentence or two.
7. **Say More has a transcript but no audio.** Either leave it out, or add the audio for the Sep 28 episode.
8. **Reference files are missing.** `docs/reference/` does not exist, so there is nothing to match behaviour against yet.
9. **Repository size.** `wbez-recordings/` is 408 MB. Its files are now listed one by one in `.gitignore`; a single `wbez-recordings/` line would also cover any files added later, including remuxed `.m4a` copies.
