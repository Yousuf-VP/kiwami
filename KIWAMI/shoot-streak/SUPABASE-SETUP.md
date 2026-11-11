# DODGE CORE — Supabase setup

This adds hosted accounts and cloud XP saving to the browser game.

## 1. Create a free Supabase project
1. Open https://supabase.com and create a project on the Free plan.
2. Choose a strong database password and keep it private.
3. Wait for the project to finish provisioning.

## 2. Create the player profile table
1. Open your Supabase project.
2. Go to **SQL Editor** → **New query**.
3. Open `supabase-schema.sql` from this game folder.
4. Paste the entire SQL file into the editor and run it.
5. The script creates the profile table, account-creation trigger, and row-level security policies.

## 3. Configure browser access
1. In Supabase, open **Project Settings** → **API** (or **Data API / API Keys**, depending on the dashboard layout).
2. Copy the Project URL.
3. Copy the **publishable/anon public key**. Never copy a `service_role` or secret key into the website.
4. Edit `supabase-config.js`:
   - Replace `https://YOUR_PROJECT_ID.supabase.co` with your Project URL.
   - Replace `YOUR_SUPABASE_ANON_PUBLIC_KEY` with the publishable/anon public key.
5. Save and deploy the updated game folder.

## 4. Configure email authentication
1. In Supabase, open **Authentication** → **Providers** and make sure Email is enabled.
2. In **Authentication** → **URL Configuration**, add your deployed game URL to the allowed Site URL / Redirect URLs.
3. Email confirmation may be enabled by default. If it is, players must confirm their email before they can sign in.

## 5. Test
1. Open DODGE CORE and expand **PLAYER ACCOUNT**.
2. Create a test account using an email address you control.
3. Confirm the email if Supabase requests it, then log in.
4. Play a run, earn XP, and wait for the cloud-save message.
5. Open the game in another browser/device and log in to check that the same XP is restored.

## Security notes
- The website uses only Supabase's public browser key. Do not put a service-role/secret key in client-side JavaScript.
- Row-level security restricts profile reads and writes to the authenticated owner.
- This starter implementation syncs XP from the browser. It protects one player's profile from other players, but it is not cheat-proof: a determined player can manipulate their own browser and submit a higher XP value. Competitive leaderboards or rewards need server-validated score submissions.
- Do not share passwords, private keys, or database credentials in chat or public repositories.
