interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Public site URL used in share text, e.g. https://daily-darts.com. */
  readonly VITE_SITE_URL?: string
  /** Contact address shown on the privacy policy and terms. */
  readonly VITE_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
