import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/templates", "/jobs", "/help"],
      disallow: [
        "/dashboard",
        "/cvs",
        "/letters",
        "/profile",
        "/settings",
        "/admin",
        "/applications",
        "/saved-jobs",
        "/api",
        "/reset-password",
      ],
    },
    sitemap: `${process.env.APP_URL}/sitemap.xml`,
  };
}
