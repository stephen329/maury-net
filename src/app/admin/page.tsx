import Link from "next/link";

const tools = [
  {
    title: "Rentals KPI",
    href: "/admin/rentals-kpi",
    description:
      "Track contract data, agent performance, gross rent, commissions, booking fees, and total revenue.",
  },
  {
    title: "Rentals Charts",
    href: "/admin/rentals-charts",
    description:
      "Bar chart of leases YTD for the past 5 years.",
  },
];

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Admin</h1>
      <p className="text-muted-foreground mb-8">
        Internal tools. No link to this page in the main site navigation.
      </p>
      <ul className="space-y-4">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="block p-5 rounded-lg border border-border bg-card text-card-foreground hover:border-primary/30 hover:shadow-sm transition-colors"
            >
              <span className="font-medium text-foreground">{tool.title}</span>
              <p className="text-sm text-muted-foreground mt-1">
                {tool.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
