export const siteConfig = {
    name: "Offset",
    title: "Offset | Card Liability Tracker",
    description:
        "Track credit card liabilities across custom buckets, and billing cycles.",
    url: "https://offset-app.mihirnagda.in",
    locale: "en_US",
    keywords: [
        "Offset",
        "Card Liability Tracker",
        "credit card tracker",
        "liability sharing",
        "credit card liabilities",
        "expense tracker",
        "finance manager",
        "bucket based credit card bills",
        "custom expense buckets",
        "Mihir Nagda",
        "Next.js",
        "TypeScript",
        "React",
        "Tailwind CSS",
        "JavaScript",
        "PWA finance tracker"
    ],
    email: "mihirnagda28@gmail.com",
    location: "Mumbai, India",
    socialLinks: {
        github: "https://github.com/mihir-28",
        linkedin: "https://www.linkedin.com/in/mihir-an28/",
        x: "https://x.com/kyayaar_mihir",
        instagram: "https://instagram.com/kyayaar.mihir",
        website: "https://mihirnagda.in",
    },
    images: {
        og: "/og.png",
    },
} as const;

export const socialProfiles = Object.values(siteConfig.socialLinks).filter(Boolean) as string[];
