# Maury.net

A Next.js 16 website with Tailwind CSS 4 and shadcn/ui components.

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Rentals KPI & Charts** (admin): Copy `env.example` to `.env.local` and set either `CONGDON_API_URL` + `CONGDON_API_KEY` or `NRBE_API_URL`. See [docs/DEPLOYMENT_ENV.md](docs/DEPLOYMENT_ENV.md) for production setup.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
