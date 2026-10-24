import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "templates",
    "jobs",
    "features",
    "about",
    "faq",
    "contact",
    "privacy",
    "terms",
    "help",
    "cover-letter",
  ].map((p) => ({
    url: `${process.env.APP_URL ?? "http://localhost:3035"}/${p}`,
  }));
}
