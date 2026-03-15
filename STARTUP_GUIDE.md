# StyleForge — Startup Guide

How to launch, navigate, and demo StyleForge locally.

---

## Before You Start

Make sure the following are in place:

| Requirement | Details |
|---|---|
| **Wi-Fi / Internet** | Required. The app connects to Databricks and Replicate cloud services. |
| **Node.js** | v18+. Verify with `node -v`. If missing: `brew install node` |
| **Terminal** | Pre-installed on Mac. Open with **Cmd + Space**, type **Terminal**. |
| **Databricks Workspace** | Must be active. The free-tier SQL warehouse auto-sleeps after inactivity. |
| **Replicate Account** | Must have credit remaining. Check at replicate.com/account. |
| **`.env.local` file** | Must exist in the project root with valid API tokens (see below). |

### Environment Variables

The file `.env.local` must exist in the project root with these keys:

```
DATABRICKS_HOST=https://dbc-XXXXX.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
REPLICATE_API_TOKEN=r8_...
REPLICATE_MODEL_OWNER=contextiv_consulting
```

If it's missing or has invalid tokens, every API call will fail with 500 errors. You can verify it exists with:

```bash
cat .env.local
```

---

## Step 1: Open Terminal

Press **Cmd + Space** to open Spotlight. Type **Terminal** and press **Enter**.

---

## Step 2: Navigate to the Project Folder

Copy and paste this entire command into Terminal, then press **Enter**:

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Contextiv/Model\ Training/StyleForge/styleforge
```

No output means it worked.

---

## Step 3: Install Dependencies (first time only)

```bash
npm install
```

---

## Step 4: Start the Application

```bash
npm run dev
```

Wait a few seconds. When you see `Ready in` and `http://localhost:3000`, the app is running:

```
▲ Next.js 16.1.6 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://192.168.1.16:3000

✓ Ready in 595ms
```

---

## Step 5: Open in Your Browser

Open Safari or Chrome. In the address bar, type:

```
http://localhost:3000
```

Press **Enter**. You should see the **StyleForge Creative Projects** page.

---

## Navigating the Interface

### Home Page: Creative Projects

The main dashboard shows:

- **StyleForge** header (top-left) with "by Contextiv Consulting"
- **"Intelligence in Motion"** tagline (top-right)
- **Creative Projects** heading with the subtext "Upload references. Define the brief. Generate directions."
- **+ New Project** button (pink) — opens a form to create a new project
- **Project cards** — each shows the project name, description, and number of reference images. Click any card to open it.

To create a project, click **+ New Project**, fill in a name and description, and click **Create Project**.

### Project Page: References Tab

When you click into a project, you land on the **References** tab. Here you can:

- **Upload reference images** — click the dashed upload area to select files (JPG, PNG, or WebP)
- **View AI-generated captions** — each image is automatically analyzed by AI after upload, and a text description appears beneath it
- **Train a custom model** — once images are uploaded and captioned, a **Model Training** section appears with a **Train Model** button. Training takes 15-30 minutes and runs on Replicate.

### Project Page: Generate Tab

Click the **Generate** tab (pink) to create images. Here you can:

- **Type a prompt** describing the image you want (e.g., "a lighthouse on a rocky cliff during a storm")
- Click **Generate Concept** and wait 10-30 seconds
- View the result: the generated image, the enhanced prompt the AI built from your input, and which reference images were matched from your project

If the project has a trained custom model, you'll see a green banner: "Using your custom-trained model". Otherwise it uses the default model with a note to train one for better results.

---

## Demo Walkthrough

Use this sequence when demonstrating StyleForge:

| Step | Action | What to Say / Show |
|------|--------|--------------------|
| 1 | Show the home page | "This is where all creative projects live. Each project has its own visual references and trained AI model." |
| 2 | Click into a project | "This project was trained on a specific set of reference images. The AI learned this visual style." |
| 3 | Show the References tab | "These are the reference images. Each one has been analyzed and captioned by AI." |
| 4 | Click the Generate tab | "Now I can describe any scene, and the AI renders it in this project's style." |
| 5 | Type a vivid prompt | Try: "a fox sitting on a mossy log at twilight" or "a bold hero image with warm tones" |
| 6 | Show the result | Point out the enhanced prompt, matched references, and how the image captures the style. |
| 7 | Go back to home | Click **"← Projects"** at the top left. |
| 8 | Create a new project | Show that you can start fresh with different reference images and train a completely new style. |

---

## Shutting Down

1. Go to Terminal and press **Ctrl + C** — the app stops immediately.
2. Close Terminal with **Cmd + Q** or just close the window. Your project files are safe.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Page won't load in browser | Make sure Terminal says "Ready". Try **Cmd + Shift + R** to hard-refresh the browser. |
| "No projects yet" on home page | Your Databricks SQL warehouse may be asleep. Log into Databricks, go to SQL Warehouses, and start the Serverless Starter Warehouse. Wait 1-2 minutes, then refresh. |
| Image generation fails | Check that your Replicate account has credit at replicate.com/account. Verify `.env.local` has a valid `REPLICATE_API_TOKEN`. |
| `command not found: npm` | Node.js is not installed. Run: `brew install node` |
| Terminal shows ENOENT error | You're in the wrong folder. Re-run the `cd` command from Step 2. |
| `.env.local` is missing | Create one in the project root with `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `REPLICATE_API_TOKEN`, and `REPLICATE_MODEL_OWNER`. |
| API calls return 500 errors | Almost always a missing or invalid `.env.local`. Check it with `cat .env.local`. |
| No matched references | The Vector Search index may need syncing. Upload images and wait a few minutes, or trigger a sync from the Databricks notebook. |
| Port 3000 already in use | Kill it with `lsof -ti:3000 \| xargs kill`, then run `npm run dev` again. |

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start the dev server with hot-reload |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint checks |
