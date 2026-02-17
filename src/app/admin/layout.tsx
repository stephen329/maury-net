import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Maury.net",
  description: "Admin tools and dashboards",
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-white">
      <div className="container max-w-full px-4 md:px-6 xl:px-8 py-6 md:py-8">
        {children}
      </div>
    </div>
  );
}
