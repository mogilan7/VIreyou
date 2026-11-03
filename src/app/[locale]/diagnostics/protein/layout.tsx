import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isRu = locale === "ru";

  const title = isRu
    ? "Белковый щит: сколько белка нужно мышцам с возрастом — калькулятор VIReyou"
    : "Protein Shield: How much protein your muscles need as you age — VIReyou calculator";

  const description = isRu
    ? "Научно обоснованный калькулятор ориентира суточной нормы белка для сохранения мышечной массы с учётом возраста, веса и физической активности."
    : "Evidence-based daily protein calculator to protect muscle mass based on age, weight, and physical activity level.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://vireyou.com/${locale}/diagnostics/protein`,
      siteName: "VIReyou",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProteinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
