-- Optional profile photo URL (or small data-URL) for website_users.
ALTER TABLE website_users
  ADD COLUMN IF NOT EXISTS avatar_url text;
