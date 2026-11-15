-- Jace Live: the theme maker uploads background pictures and music to the same bucket as question media.

update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a'
]
where id = 'live-media';
