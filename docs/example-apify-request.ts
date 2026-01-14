import { ApifyClient } from 'apify-client';

// 1. CONFIGURATION
const APIFY_TOKEN = 'YOUR_APIFY_TOKEN'; // Replace with your actual token
const ACTOR_ID = 'kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest';

// The Conversation ID you are tracking
const TARGET_CONVERSATION_ID = '2010686898637840839';

// 2. STATE MANAGEMENT (Mocking your Database)
// In a real app, you would fetch this from your DB: "SELECT last_checked_at FROM threads WHERE id = ..."
// Format must be UTC: YYYY-MM-DD_HH:MM:SS_UTC
let lastCheckedDate = '2026-01-14_09:00:00_UTC'; 

// 3. DEFINE INTERFACES (For Type Safety)
interface Tweet {
    id: string;
    text: string;
    created_at: string;
    user: {
        screen_name: string;
        name: string;
        followers_count: number;
        is_blue_verified: boolean;
    };
    // Add other fields you care about
}

async function scrapeNewReplies() {
    const client = new ApifyClient({ token: APIFY_TOKEN });

    console.log(`🔎 Checking for replies since: ${lastCheckedDate}`);

    // 4. CONSTRUCT THE QUERY
    // We embed the date DIRECTLY in the search term. This is the "Holy Grail" filter.
    const searchQuery = `conversation_id:${TARGET_CONVERSATION_ID} filter:replies since:${lastCheckedDate}`;

    const input = {
        "searchTerms": [searchQuery],
        "maxItems": 100,        // Limit to avoid runaway costs. Adjust based on expected volume.
        "sort": "Latest",       // Ensures we get the newest ones first
        "tweetLanguage": "en"
    };

    try {
        // 5. RUN THE ACTOR
        console.log('🚀 Starting Apify Actor...');
        const run = await client.actor(ACTOR_ID).call(input);

        console.log(`✅ Run finished! Dataset ID: ${run.defaultDatasetId}`);

        // 6. FETCH RESULTS
        // We set clean: false to ensure we get the nested 'user' object (author details)
        const { items } = await client.dataset(run.defaultDatasetId).listItems({
            clean: false, 
        });

        const tweets = items as unknown as Tweet[];
        
        if (tweets.length === 0) {
            console.log('💤 No new replies found since last check.');
            return;
        }

        console.log(`📥 Downloaded ${tweets.length} new replies.`);

        // 7. PROCESS & UPSERT (The "Intelligence" Layer)
        let newestTweetDate = lastCheckedDate;

        for (const tweet of tweets) {
            // A. Check if user is "High Value" (Optional Filtering)
            const isPremium = tweet.user.is_blue_verified;
            const followerCount = tweet.user.followers_count;

            console.log(`------------------------------------------------`);
            console.log(`User: @${tweet.user.screen_name} (${followerCount} followers) [Premium: ${isPremium}]`);
            console.log(`Said: "${tweet.text.substring(0, 50)}..."`);

            // B. DATABASE LOGIC GOES HERE
            // await db.replies.upsert({ id: tweet.id }, tweet);
            
            // C. UPDATE TIMESTAMP
            // Keep track of the newest tweet we've seen so we don't fetch it next time
            // Twitter dates are typically "Fri Jan 14..." so you might need a parsing library like 'date-fns'
            // For this example, we assume we parse it correctly to update 'lastCheckedDate'
        }

        // 8. UPDATE STATE
        // Save 'newestTweetDate' back to your database for the next Cron run.

    } catch (error) {
        console.error('❌ Error running scraper:', error);
    }
}

// Run the script
scrapeNewReplies();