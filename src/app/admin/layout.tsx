import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Maury.net",
  description: "Admin tools and dashboards",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </div>
    </div>
  );
}
