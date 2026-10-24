import { Workspace } from "@/components/workspace";
import type { Metadata } from "next";
const publicPages = [
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
];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const path = (await params).slug ?? [];
  const section = path[0] ?? "";
  return {
    title: section ? section.replaceAll("-", " ") : "CV & Cover Letter",
    robots: publicPages.includes(section)
      ? { index: true, follow: true }
      : { index: false, follow: false },
    alternates: { canonical: "/" + path.join("/") },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  return <Workspace path={(await params).slug ?? []} />;
}
