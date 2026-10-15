export const APP_NAME = "Bonbon";
export const BRAND_NAME = "Bonbon";
/** The brand has no logo yet; the wordmark is set in type (lowercase, Funnel Display 800). */
export const BRAND_WORDMARK = "bonbon";
export const TAGLINE = "Little boxes of joy, delivered on repeat";
export const SITE_DESCRIPTION = "Subscription boxes for romance, self-care, beauty, snacks and home — arriving as often as you’d like.";

/**
 * The public site's address, for absolute links in previews, the sitemap and canonical URLs.
 * Set NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel it falls back to the production domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
