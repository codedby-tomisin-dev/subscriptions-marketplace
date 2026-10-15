import type { MetadataRoute } from "next";
import { SITE_URL } from "@/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    // Accounts, sign-in links and the admin are private; the shop is for everyone.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/auth"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
