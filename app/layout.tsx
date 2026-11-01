import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pioneer Family Dental and Optical Clinic",
    template: "%s | Pioneer Family Clinic",
  },
  description:
    "Compassionate dental and optical care for the whole family in Nairobi. Book an appointment online with Pioneer Family Dental and Optical Clinic.",
  keywords: ["dentist Nairobi", "optometrist Nairobi", "dental clinic", "eye clinic", "family dental", "spectacles"],
  openGraph: {
    title: "Pioneer Family Dental and Optical Clinic",
    description: "One family. Complete dental and eye care.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
