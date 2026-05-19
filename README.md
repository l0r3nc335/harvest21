# Harvest21 Frontend

A mission and ministry management platform built with Next.js, Supabase, and modern web technologies. The platform enables organizations to manage missionaries, agencies, churches, colleges, and donors while providing public-facing pages for showcasing their work.

## Features

### Admin Portal
- **Dashboard**: Analytics dashboard with KPIs, donation tracking, and activity metrics
- **Missionary Management**: Create, edit, and manage missionary profiles
- **Organization Management**: Manage agencies, churches, and colleges
- **Donor Management**: Track and manage donor information
- **User Management**: Admin user administration
- **Transaction Management**: Monitor and track financial transactions
- **Page Approval System**: Review and approve public pages before publication
- **Image Cropping**: Built-in image cropping and upload functionality
- **Rich Text Editor**: Content editing with Editor.js

### Public Pages
- Dynamic route-based public pages for missionaries and organizations
- Public-facing donation pages
- Media galleries
- Updates and posts

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL database, authentication, storage)
- **Styling**: TailwindCSS 4
- **UI Components**: Radix UI primitives
- **Forms**: React Hook Form + Yup validation
- **Rich Text**: Editor.js
- **Charts**: Chart.js + React Chart.js 2
- **Image Processing**: React Easy Crop
- **Notifications**: React Hot Toast
- **Icons**: Lucide React

## Project Structure

```
harvest21-frontend/
├── app/                    # Next.js App Router pages and layouts
│   ├── [page_url]/        # Dynamic public pages
│   ├── admin/             # Admin portal routes
│   │   ├── agencies/
│   │   ├── churches/
│   │   ├── colleges/
│   │   ├── donors/
│   │   ├── missionaries/
│   │   ├── transactions/
│   │   └── users/
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── auth/             # Authentication components
│   ├── missionary/       # Missionary public views
│   ├── organization/     # Organization public views
│   └── ui/               # Reusable UI components
├── lib/                  # Utility functions and helpers
│   ├── supabaseClient.ts # Client-side Supabase client
│   ├── supabaseServer.ts # Server-side Supabase client
│   └── ...
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd harvest21-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Architecture

### Server Components First
The application follows Next.js 14+ best practices:
- Pages are Server Components by default
- Client Components (`"use client"`) are only used when needed for interactivity
- Server-side data fetching with Supabase

### Authentication
- Supabase Auth for user authentication
- Protected admin routes with session management
- Server-side and client-side Supabase clients

### Data Management
- Server Actions for mutations
- Server Components for data fetching
- Type-safe Supabase queries with TypeScript

### UI/UX
- Mobile-first responsive design
- Dark mode support
- Accessible components with Radix UI
- TailwindCSS for styling

## Key Features Implementation

### Image Upload & Cropping
- Image cropping using `react-easy-crop`
- Upload to Supabase Storage
- Support for profile pictures and media galleries

### Rich Text Editing
- Editor.js block-based editor for content creation
- Link and underline extensions
- Formatted content stored in database

### Analytics Dashboard
- Chart.js for data visualization
- KPI cards with percentage changes
- Filterable data tables
- Period-based filtering (daily/weekly/monthly)

### Dynamic Routing
- `/[page_url]` route for public pages
- Automatic detection of missionary vs organization pages
- Server-side rendering for SEO

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | Yes |
| `NEXT_PUBLIC_APP_URL` | Base URL for email links (activation, password reset). Set to `http://localhost:3000` for local, `https://staging.harvest21.com` for staging, `https://harvest21.com` for production | No (auto-detected if not set) |

## Deployment

The application can be deployed to Vercel, Netlify, or any Node.js hosting platform.

### Vercel Deployment

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add environment variables
4. Deploy

## Code Standards

- **Naming**: kebab-case for files/folders, PascalCase for components
- **Imports**: Absolute imports using `@/` alias
- **Components**: Functional components only
- **TypeScript**: Strict mode enabled
- **Formatting**: ESLint + Prettier (recommended)

## Contributing

1. Follow the project structure and naming conventions
2. Use TypeScript for all new files
3. Prefer Server Components over Client Components
4. Add proper error handling for Supabase operations
5. Ensure accessibility (ARIA labels, keyboard navigation)
6. Keep components small and single-responsibility

## License

[Add your license here]
