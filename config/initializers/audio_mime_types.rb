# Serve the remuxed recordings as audio/mp4 (Rack's default for .m4a is
# audio/mp4a-latm, which Safari won't play).
Rack::Mime::MIME_TYPES[".m4a"] = "audio/mp4"
