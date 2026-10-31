import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  keywords?: string;
  schema?: object;
  noIndex?: boolean;
}

export function SEO({
  title,
  description,
  canonical,
  ogImage = "https://myfabclean.com/opengraph.jpg",
  keywords,
  schema,
  noIndex = false,
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        const attr = selector.includes("property") ? "property" : "name";
        const val  = selector.match(/["']([^"']+)["']/)?.[1] ?? "";
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta('meta[name="description"]',         description);
    setMeta('meta[name="robots"]', noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    if (keywords) setMeta('meta[name="keywords"]', keywords);
    setMeta('meta[property="og:title"]',         title);
    setMeta('meta[property="og:description"]',   description);
    setMeta('meta[property="og:url"]',           canonical);
    setMeta('meta[property="og:image"]',         ogImage);
    setMeta('meta[name="twitter:title"]',        title);
    setMeta('meta[name="twitter:description"]',  description);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    // JSON-LD schema
    if (schema) {
      const id = "fc-schema-ld";
      let script = document.getElementById(id);
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        (script as HTMLScriptElement).type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(schema);
    }
  }, [title, description, canonical, ogImage, keywords, schema, noIndex]);

  return null;
}
