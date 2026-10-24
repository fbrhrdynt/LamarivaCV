import React from "react";
import {
  Document as PDFDocument,
  Page,
  Text,
  View,
  Link,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  ExternalHyperlink,
} from "docx";
import { DocumentData, templates, sectionTitle } from "./model";
import path from "node:path";
Font.register({
  family: "LamarivaSans",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/DejaVuSans.ttf") },
    {
      src: path.join(process.cwd(), "public/fonts/DejaVuSans-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});
Font.register({
  family: "LamarivaSerif",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/DejaVuSerif.ttf") },
    {
      src: path.join(process.cwd(), "public/fonts/DejaVuSerif-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
export type RenderConfig = { font: string; accent: string; header: string };
function configFor(templateId: string, custom?: RenderConfig) {
  return (
    custom ??
    templates.find((t) => t.id === templateId)?.config ??
    templates[0].config
  );
}
export function contentSections(d: DocumentData) {
  return d.profile.sections
    .filter((s) => s.visible && s.entries.length)
    .map((s) => ({
      ...s,
      entries:
        s.type === "experience"
          ? [...s.entries].sort((a, b) =>
              (b.current ? "9999" : b.end || b.start).localeCompare(
                a.current ? "9999" : a.end || a.start,
              ),
            )
          : s.entries,
    }));
}
let rendering = false;
export async function exportPDF(
  d: DocumentData,
  kind: string,
  templateId: string,
  custom?: RenderConfig,
) {
  if (rendering) throw new Error("RENDER_BUSY");
  rendering = true;
  try {
    const c = configFor(templateId, custom),
      p = d.profile,
      f = d.fontSize;
    const family = c.font === "Times-Roman" ? "LamarivaSerif" : "LamarivaSans";
    const heading = {
      fontSize: f + 1,
      fontFamily: family,
      fontWeight: 700 as const,
      lineHeight: 1.4,
      color: c.accent,
      marginBottom: 7,
      marginTop: 15,
      borderBottomWidth: templateId === "minimalist" ? 0 : 0.5,
      borderBottomColor: "#aab4bb",
      paddingBottom: 4,
    };
    return await renderToBuffer(
      <PDFDocument title={p.name} author={p.name}>
        <Page
          size={d.paper}
          style={{
            padding: 42,
            paddingBottom: 48,
            fontFamily: family,
            fontSize: f,
            lineHeight: 1.5,
            color: "#18202a",
          }}
          wrap
        >
          <View
            style={{
              textAlign: c.header === "center" ? "center" : "left",
              marginBottom: 10,
              paddingBottom: 12,
              borderBottomWidth: templateId === "professional-blue" ? 3 : 0,
              borderBottomColor: c.accent,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                lineHeight: 1.25,
                marginBottom: 7,
                color: c.accent,
                fontFamily: family,
                fontWeight: 700,
              }}
            >
              {p.name}
            </Text>
            {p.headline && (
              <Text style={{ fontSize: 12, marginTop: 3 }}>{p.headline}</Text>
            )}
            <Text>
              {[p.email, p.phone, p.location].filter(Boolean).join("  |  ")}
            </Text>
            {[p.linkedin, p.website, p.github].filter(Boolean).map((u) => (
              <Link key={u} src={u} style={{ color: c.accent, fontSize: 9 }}>
                {u}
              </Link>
            ))}
          </View>
          {kind === "LETTER" ? (
            <>
              {d.letterDate && (
                <Text style={{ marginBottom: 15 }}>{d.letterDate}</Text>
              )}
              {d.body.split("\n\n").map((v, i) => (
                <Text
                  key={i}
                  style={{ marginBottom: 12 }}
                  orphans={2}
                  widows={2}
                >
                  {v}
                </Text>
              ))}
            </>
          ) : (
            <>
              {p.summary && (
                <>
                  <Text style={heading}>
                    {d.language === "id"
                      ? "Ringkasan profesional"
                      : "Professional summary"}
                  </Text>
                  <Text orphans={2} widows={2}>
                    {p.summary}
                  </Text>
                </>
              )}
              {contentSections(d).map((s) => (
                <View key={s.id}>
                  <Text style={heading} minPresenceAhead={45}>
                    {sectionTitle(s, d.language)}
                  </Text>
                  {s.entries.map((e) => (
                    <View
                      key={e.id}
                      style={{ marginBottom: 10 }}
                      wrap={e.description.length > 600}
                    >
                      <Text
                        minPresenceAhead={50}
                        style={{
                          fontFamily: family,
                          fontWeight: 700,
                        }}
                      >
                        {[e.title, e.organization].filter(Boolean).join(" | ")}
                      </Text>
                      {(e.start || e.end || e.location) && (
                        <Text style={{ fontSize: 9, color: "#46535c" }}>
                          {[
                            `${e.start}${e.start ? " - " : ""}${e.current ? (d.language === "id" ? "Sekarang" : "Present") : e.end}`,
                            e.location,
                          ]
                            .filter(Boolean)
                            .join(" | ")}
                        </Text>
                      )}
                      {e.description
                        .split("\n")
                        .filter(Boolean)
                        .map((line, i) => (
                          <Text key={i} orphans={2} widows={2}>
                            {line}
                          </Text>
                        ))}
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}
          <Text
            fixed
            style={{
              position: "absolute",
              bottom: 22,
              left: 42,
              right: 42,
              textAlign: "right",
              fontSize: 8,
              color: "#46535c",
            }}
            render={({ pageNumber, totalPages }) =>
              totalPages > 1 ? `${pageNumber} / ${totalPages}` : ""
            }
          />
        </Page>
      </PDFDocument>,
    );
  } finally {
    rendering = false;
  }
}
export async function exportDOCX(
  d: DocumentData,
  kind: string,
  templateId: string,
  custom?: RenderConfig,
) {
  const c = configFor(templateId, custom),
    p = d.profile,
    color = c.accent.replace("#", "");
  const lines: Paragraph[] = [
    new Paragraph({ text: p.name, heading: HeadingLevel.TITLE }),
    new Paragraph(p.headline),
    new Paragraph([p.email, p.phone, p.location].filter(Boolean).join(" | ")),
  ];
  for (const u of [p.linkedin, p.website, p.github].filter(Boolean))
    lines.push(
      new Paragraph({
        children: [
          new ExternalHyperlink({
            link: u,
            children: [new TextRun({ text: u, style: "Hyperlink" })],
          }),
        ],
      }),
    );
  const para = (v: string) =>
    new Paragraph({ text: v, spacing: { after: 100 } });
  if (kind === "LETTER") {
    if (d.letterDate) lines.push(para(d.letterDate));
    d.body.split("\n").forEach((v) => lines.push(para(v)));
  } else {
    if (p.summary)
      lines.push(
        new Paragraph({
          text:
            d.language === "id"
              ? "Ringkasan profesional"
              : "Professional summary",
          heading: HeadingLevel.HEADING_1,
        }),
        para(p.summary),
      );
    for (const s of contentSections(d)) {
      lines.push(
        new Paragraph({
          text: sectionTitle(s, d.language),
          heading: HeadingLevel.HEADING_1,
        }),
      );
      for (const e of s.entries) {
        lines.push(
          new Paragraph({
            text: [e.title, e.organization].filter(Boolean).join(" | "),
            heading: HeadingLevel.HEADING_2,
          }),
        );
        lines.push(
          para(
            [
              e.start,
              e.current
                ? d.language === "id"
                  ? "Sekarang"
                  : "Present"
                : e.end,
              e.location,
            ]
              .filter(Boolean)
              .join(" | "),
          ),
        );
        for (const line of e.description.split("\n"))
          lines.push(
            /^[-•]\s/.test(line)
              ? new Paragraph({
                  text: line.replace(/^[-•]\s/, ""),
                  bullet: { level: 0 },
                })
              : para(line),
          );
      }
    }
  }
  const document = new Document({
    creator: p.name,
    title: p.name,
    styles: {
      default: {
        document: {
          run: {
            font: c.font === "Times-Roman" ? "Times New Roman" : "Arial",
            size: d.fontSize * 2,
            color: "18202A",
          },
          paragraph: { spacing: { after: 100 } },
        },
        heading1: {
          run: { color, bold: true, size: 24 },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading2: { run: { bold: true, size: 21 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size:
              d.paper === "A4"
                ? { width: 11906, height: 16838 }
                : { width: 12240, height: 15840 },
            margin: { top: 840, bottom: 840, left: 840, right: 840 },
          },
        },
        children: lines,
      },
    ],
  });
  return Packer.toBuffer(document);
}
