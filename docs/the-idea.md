This is the complete, high-fidelity project specification for **ReplyGuys.app**. It is designed to be pasted directly into **Cursor IDE** to provide the necessary context for the 2026 tech stack.

---

# Project Brief: ReplyGuys.app (The "Banana" Logic)

## 1. Core Idea & Value Prop

**ReplyGuys.app** is an audience-intelligence engine. It solves the "signal-to-noise" problem for X creators by scraping hundreds of replies to a "Question" post and using **Gemini 3 (Nano Banana Pro)** to transform raw text into high-status, data-driven visual reports and viral "Insight Threads."

---

## 2. 2026 Tech Stack

* **Framework:** Next.js 16 (App Router) + React 19.2 (Stable React Compiler, no manual memoization).
* **Bundler:** Turbopack (Default, stable).
* **Styling:** Tailwind CSS + Shadcn UI.
* **Workflow & Cron:** **Inngest** (For durable, event-driven pipelines).
* **Database:** Supabase (Postgres) + **Supabase Vault** (for encrypted X tokens).
* **Real-time:** Supabase Realtime (for the "Live Scrape" dashboard).
* **AI Reasoning:** Gemini 1.5 Pro (via Vercel AI SDK).
* **AI Visuals:** **Nano Banana Pro** (Gemini 3 Pro Image) for 4K data-viz and infographics.
* **Scraper:** Apify (X/Twitter Scraper Actor).

---

## 3. Database Schema (Supabase)

### `profiles` (Public - for Leaderboards)

* `id`: uuid (PK, references auth.users)
* `x_username`: text (X handle)
* `avatar_url`: text
* `bio`: text

### `x_credentials` (Private - Encrypted via Supabase Vault)

* `id`: uuid (PK)
* `user_id`: uuid (FK to profiles)
* `access_token`: text (Encrypted)
* `refresh_token`: text (Encrypted)
* `expires_at`: timestamp

### `reports`

* `id`: uuid (PK)
* `user_id`: uuid (FK)
* `x_post_url`: text
* `status`: enum (`scraping`, `evaluating`, `visualizing`, `completed`)
* `config`: jsonb (Stores user criteria: `min_length`, `blue_only`, `followers_only`, `sub_questions`)
* `summary_json`: jsonb (Final AI output)
* `infographic_url`: text

### `replies`

* `id`: text (X Tweet ID)
* `report_id`: uuid (FK)
* `username`: text
* `is_premium`: boolean
* `text`: text
* `evaluation`: jsonb (AI-generated: `grade`, `is_pearl`, `category`)

---

## 4. Inngest Workflow: The "Insight Pipeline"

To maximize efficiency and respect rate limits, we use a **Fan-out Pattern**:

### Step 1: The Scrape Trigger (`app/report.triggered`)

* **Action:** Triggered when a user submits a URL.
* **Logic:** Inngest calls Apify. We use **Inngest Throttling** to ensure we don't exceed Apify's concurrent job limits.
* **Output:** Apify returns a batch of replies. For each reply, Inngest emits a `reply.captured` event.

### Step 2: The Parallel Evaluation (`reply.captured`)

* **Action:** Fans out to handle each reply individually.
* **Validation:** First, a non-AI check: Does it meet the user's `min_length`? Is the user blue-badged (if toggled)?
* **Evaluation (AI):** If valid, pass to **Gemini 1.5 Pro** via Vercel AI SDK `generateObject`.
* **Zod Schema:**
```typescript
const evaluationSchema = z.object({
  grade: z.number().min(1).max(10).describe("Relevance and quality score"),
  is_pearl: z.boolean().describe("Is this a rare, high-value insight?"),
  category: z.string().describe("E.g., Actionable, Technical, Emotional"),
  sentiment: z.enum(['positive', 'neutral', 'negative'])
});

```


* **Real-time:** Update the `replies` table. Supabase Realtime pushes this to the UI.

### Step 3: The Report Synthesis (`report.threshold_reached`)

* **Action:** Once the number of "Useful" replies hits the user's target.
* **Logic:** Aggregate all `replies` into a prompt for Gemini 1.5 Pro to create the final `summary_json`.
* **Visual Step:** Pass the summary to **Nano Banana Pro**.
* **Prompting:** "Create a 4K data infographic. Title: [X Question]. Use colors [Brand Colors]. Graph type: [AI chooses Radar or Bar]. Include the text for the 'Top Pearl of Wisdom'."


* **The Post:** Use the stored X credentials to post the Quote Tweet with the image.

---

## 5. UI/UX Flow

1. **Dashboard:** A "Live Counter" showing replies being processed.
2. **Report Page:**
* **Sentiment Chart:** Shadcn-based bar chart.
* **Leaderboard:** "MVPs" (Most Valuable Posters) ranked by their AI `grade`.
* **Gems Section:** Cards highlighting the `is_pearl` replies.


3. **The Hook:** A "Share Report" button that previews the Nano Banana Pro infographic before posting.

---

## 6. Development Instructions for Cursor

> "Build a Next.js 16 app with the provided schema. Use Inngest to handle the asynchronous scraping from Apify. For the AI evaluation, use the Vercel AI SDK with Gemini 1.5 Pro and a Zod schema to enforce structured data. The UI must use Supabase Realtime to update the 'Processing' counter. For the final visual, call the Gemini 3 Pro Image (Nano Banana Pro) API to generate a 4K infographic with the 'Pearl of Wisdom' text rendered inside it."

**Ready to build? Would you like me to generate the Inngest function code for the `process-reply` step first?**