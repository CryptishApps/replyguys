import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://replyguys.app";

export const siteConfig = {
    name: "ReplyGuys",
    tagline: "Turn X Replies into Actionable Insights",
    description:
        "ReplyGuys transforms hundreds of X replies into high-signal, data-driven reports. Find the valuable insights hidden in your audience's responses.",
    url: siteUrl,
    creator: "@replyguys",
    keywords: [
        "X analytics",
        "Twitter analytics",
        "audience insights",
        "reply analysis",
        "social media intelligence",
        "X creators",
        "Twitter replies",
        "data reports",
    ],
};

// Images are auto-detected via file convention:
// - /app/opengraph-image.png
// - /app/twitter-image.png
export const baseMetadata: Metadata = {
    metadataBase: new URL(siteConfig.url),
    title: {
        default: `${siteConfig.name} - ${siteConfig.tagline}`,
        template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: siteConfig.keywords,
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.creator,
    openGraph: {
        type: "website",
        locale: "en_US",
        url: siteConfig.url,
        siteName: siteConfig.name,
        title: `${siteConfig.name} - ${siteConfig.tagline}`,
        description: siteConfig.description,
    },
    twitter: {
        card: "summary_large_image",
        title: `${siteConfig.name} - ${siteConfig.tagline}`,
        description: siteConfig.description,
        creator: siteConfig.creator,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon-16x16.png",
        apple: "/apple-touch-icon.png",
    },
    manifest: "/site.webmanifest",
};

/**
 * Creates page-specific metadata by merging with base config.
 * Only specify the fields you want to override.
 * Images inherit from parent route's opengraph-image/twitter-image files.
 */
export function createMetadata(overrides: {
    title?: string;
    description?: string;
    path?: string;
}): Metadata {
    const { title, description, path } = overrides;
    const url = path ? `${siteConfig.url}${path}` : siteConfig.url;

    return {
        title,
        description,
        openGraph: {
            title: title ? `${title} | ${siteConfig.name}` : undefined,
            description,
            url,
        },
        twitter: {
            title: title ? `${title} | ${siteConfig.name}` : undefined,
            description,
        },
    };
}
