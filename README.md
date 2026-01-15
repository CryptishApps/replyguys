<div align="center">

# 🎯 ReplyGuys

**Turn X/Twitter replies into actionable audience intelligence.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Inngest](https://img.shields.io/badge/Inngest-Workflows-5D5FEF?style=flat-square)](https://inngest.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)

---

**ReplyGuys** is an audience-intelligence engine that scrapes replies to your X posts and transforms them into data-driven insights. Built with the modern 2026 stack.

[Getting Started](#-getting-started) • [Environment Variables](#-environment-variables) • [Local Development](#-local-development) • [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

- 🔍 **Smart Reply Scraping** — Automatically collect and process replies from any X post
- 🤖 **AI-Powered Evaluation** — Gemini 2.0 Flash scores each reply on goal relevance, actionability, specificity, substantiveness, and constructiveness
- 📊 **Real-time Dashboard** — Watch replies being processed live with Supabase Realtime
- 🎨 **AI-Generated Summaries** — Gemini 3 Pro generates executive summaries, key themes, action items, and hidden gems
- 🎯 **Goal-Driven Analysis** — Define your research goal and target audience to get relevant insights
- ⚖️ **Customizable Weights** — Choose from presets (balanced, research, ideas, feedback) or customize scoring weights
- 🏆 **Global Leaderboard** — Discover top repliers by total score, average score, and best audiences
- 🔐 **Secure OAuth** — X/Twitter OAuth 2.0 authentication

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) or Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Inngest Dev Server](https://www.inngest.com/docs/local-development)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/replyguys.git
cd replyguys

# Install dependencies
bun install

# Copy environment variables
cp env.example .env.local

# Start the development server
bun dev
```

---

## 🔑 Environment Variables

Create a `.env.local` file with the following variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (for OAuth callbacks) |
| `X_CLIENT_ID` | X/Twitter OAuth 2.0 Client ID |
| `X_CLIENT_SECRET` | X/Twitter OAuth 2.0 Client Secret |
| `APIFY_TOKEN` | Apify API token for scraping |
| `GEMINI_API_KEY` | Google AI Gemini API key |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `INNGEST_SIGNING_KEY` | Inngest signing key |

<details>
<summary><strong>Example .env.local</strong></summary>

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# App URL (for OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# X (Twitter) OAuth 2.0
X_CLIENT_ID=your_x_client_id
X_CLIENT_SECRET=your_x_client_secret

# Apify (Scraping)
APIFY_TOKEN=your_apify_token

# Google AI (Gemini)
GEMINI_API_KEY=your_gemini_api_key

# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key
```

</details>

---

## 🛠️ Local Development

### Supabase Setup

1. **Install the Supabase CLI**

   ```bash
   brew install supabase/tap/supabase
   ```

2. **Start Supabase locally**

   ```bash
   supabase start
   ```

   This spins up a local Postgres database, Auth, and Realtime server. The CLI will output your local credentials:

   ```
   API URL: http://127.0.0.1:54321
   anon key: eyJhbGci...
   service_role key: eyJhbGci...
   ```

3. **Run migrations**

   ```bash
   supabase db reset
   ```

   This applies all migrations from `supabase/migrations/` and seeds the database.

4. **Access Supabase Studio**

   Open [http://127.0.0.1:54323](http://127.0.0.1:54323) to view your local database in the Supabase dashboard.

---

### Inngest Setup

[Inngest](https://inngest.com) handles our background jobs and event-driven workflows.

1. **Install the Inngest Dev Server**

   ```bash
   npx inngest-cli@latest dev
   ```

   Or install globally:

   ```bash
   npm install -g inngest-cli
   inngest dev
   ```

2. **The Dev Server UI**

   Open [http://127.0.0.1:8288](http://127.0.0.1:8288) to access the Inngest dashboard where you can:

   - View all registered functions
   - Trigger events manually
   - Monitor function runs and logs
   - Debug failed jobs

3. **Connect to your app**

   The Inngest Dev Server automatically discovers functions at `/api/inngest`. Make sure your Next.js app is running on `localhost:3000`.

4. **For production**

   Sign up at [inngest.com](https://inngest.com) and add your `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to your environment.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui |
| **Database** | Supabase (Postgres) + Realtime |
| **Auth** | Supabase Auth + X OAuth 2.0 |
| **AI** | Google Gemini (2.0 Flash + 3 Pro) via Vercel AI SDK |
| **Background Jobs** | Inngest |
| **Scraping** | Apify |
| **Animations** | Framer Motion |

---

## 📁 Project Structure

```
├── app/
│   ├── (auth)/          # Authentication routes
│   ├── (dashboard)/     # Protected dashboard routes
│   │   ├── dashboard/   # Report cards grid
│   │   ├── leaderboard/ # Global leaderboard
│   │   ├── new/         # Create new report
│   │   └── report/[id]/ # Report details & analysis
│   └── api/             # API routes (auth, inngest)
├── components/
│   ├── ai-elements/     # AI-themed UI components
│   └── ui/              # shadcn/ui components
├── hooks/               # React hooks (realtime, infinite scroll)
├── lib/
│   ├── ai/              # Gemini AI evaluation & summary
│   ├── inngest/         # Inngest functions & client
│   └── supabase/        # Supabase clients (server/client)
└── supabase/
    └── migrations/      # Database migrations
```

---

## 📜 License

MIT

---

<div align="center">

**Built with ☕ and modern tooling**

</div>
