# StyleForge — Project Context

> Last updated: March 10, 2026

## What This Is

StyleForge is an AI-powered creative tool built by Contextiv Consulting. Users create projects, upload reference images, train custom LoRA models on those images, and then generate new images in that learned visual style. It was originally built to replicate the owner's personal illustration style and is expanding into a multi-project workspace for teams.

**Owner:** Chris at Contextiv Consulting (chris@contextivconsulting.com)
**Brand colors:** #141414 (bg), #A9DFFF (accent blue), #FF50AD (accent pink), #68899D (muted text)

---

## Architecture

```
User types a prompt in the browser
        ↓
[Next.js App on localhost:3000]
        ↓
[Databricks LLM — Llama 3.3 70B] → Enhances the prompt with artistic details
        ↓
[Databricks Vector Search] → Finds 3 most relevant reference images by caption similarity
        ↓
[Replicate — Custom LoRA Model] → Generates the image using style-trained FLUX model
        ↓
Image + enhanced prompt + matched references displayed in browser
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16.1.6 + TypeScript + Tailwind CSS 4 |
| Data Platform | Databricks Free Edition (Unity Catalog, Delta Lake, Vector Search) |
| LLM — prompt enhancement | databricks-meta-llama-3-3-70b-instruct |
| LLM — image captioning | databricks-llama-4-maverick (multimodal) |
| Embeddings | databricks-gte-large-en |
| Image Generation | Replicate API — custom LoRA-trained FLUX model |
| SQL | Databricks SQL Statements API, warehouse ID: 7cb6d88dbcea8491 |

---

## Project Location

```
~/Library/Mobile Documents/com~apple~CloudDocs/Contextiv/Model Training/StyleForge/styleforge
```

Start: `cd` to that directory, then `npm run dev` → opens at http://localhost:3000

---

## File Structure

```
src/app/
├── page.tsx                              # Home — project list + "Create Project" form
├── layout.tsx                            # Root layout (Geist fonts, metadata)
├── globals.css                           # Tailwind + dark/light theme vars
├── project/
│   └── [id]/
│       └── page.tsx                      # Project detail — References tab + Generate tab
├── api/
│   ├── generate/
│   │   └── route.ts                      # POST: enhance prompt → vector search → Replicate generate
│   └── projects/
│       ├── route.ts                      # GET: list projects | POST: create project
│       └── [id]/
│           ├── route.ts                  # GET: project details + images
│           ├── upload/
│           │   └── route.ts              # POST: upload images to Databricks Volume
│           ├── caption/
│           │   └── route.ts              # POST: caption images with Llama 4 Maverick
│           ├── train/
│           │   └── route.ts              # POST: package images → send to Replicate for LoRA training
│           └── training-status/
│               └── route.ts              # GET: poll Replicate for training progress
.env.local                                # API tokens (not committed)
```

---

## Environment Variables (.env.local)

```
DATABRICKS_HOST=https://dbc-81a91655-19fe.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
REPLICATE_API_TOKEN=r8_...
REPLICATE_MODEL_OWNER=contextiv_consulting
```

All API routes depend on these. If missing, every backend call returns 500.

---

## Databricks Setup

- **Workspace:** https://dbc-81a91655-19fe.cloud.databricks.com (Free Edition)
- **SQL Warehouse ID:** 7cb6d88dbcea8491 (Serverless Starter Warehouse — auto-sleeps)
- **Catalog:** `styleforge` → **Schema:** `styleforge.data`
- **Volume:** `styleforge.data.illustrations` (stores uploaded images)

### Tables

**styleforge.data.projects**

| Column | Type | Notes |
|---|---|---|
| project_id | STRING | e.g. "proj-001" |
| name | STRING | Project name |
| description | STRING | Project description |
| replicate_model | STRING | e.g. "contextiv_consulting/styleforge" |
| replicate_version | STRING | Full version hash for Replicate API |
| training_status | STRING | "completed", "training", "failed", or null |

Note: No `created_at` column. Do not ORDER BY it.

**styleforge.data.illustration_metadata**

| Column | Type | Notes |
|---|---|---|
| id | BIGINT | Auto-generated |
| filename | STRING | Image filename |
| file_path | STRING | Path in Databricks Volume |
| file_size_kb | DOUBLE | File size |
| uploaded_at | TIMESTAMP | Upload time |
| caption | STRING | AI-generated description |
| project_id | STRING | Foreign key to projects |

### Vector Search

- Endpoint: `styleforge-search`
- Index: `styleforge.data.illustration_index` (DELTA_SYNC, TRIGGERED)
- Embedding column: `caption` (via databricks-gte-large-en)
- Synced columns: id, filename, caption, project_id
- Supports filtering by `project_id`
- Caption route auto-triggers sync after captioning

### Serving Endpoints

- `databricks-llama-4-maverick` — multimodal, for image captioning
- `databricks-meta-llama-3-3-70b-instruct` — for prompt enhancement
- `databricks-gte-large-en` — for embeddings

---

## Replicate Setup

- **Account:** contextiv_consulting
- **Model:** `contextiv_consulting/styleforge`
- **Trained with:** ostris/flux-dev-lora-trainer
- **Training params:** steps=1000, lora_rank=16, learning_rate=0.0004
- **Trigger word:** `STYLFRG`
- **Per-project training:** Each project can train its own LoRA. The train route packages project images + captions into a ZIP with metadata.jsonl and sends to Replicate.

---

## Application Flow

### Home Page (`/`)
- Lists all projects (fetched from Databricks via `/api/projects`)
- "+ New Project" button opens an inline form (name + description)
- Clicking a project card navigates to `/project/[id]`

### Project Page (`/project/[id]`) — References Tab
1. **Upload images** — drag/click the upload area. Files go to Databricks Volume.
2. **Auto-captioning** — immediately after upload, Llama 4 Maverick analyzes each image and writes a caption.
3. **Image list** — shows filename + AI caption for each reference image.
4. **Train Model** — appears once images are captioned. Packages images + captions into ZIP, sends to Replicate for LoRA fine-tuning (15-30 min). Polls status every 10 seconds.

### Project Page (`/project/[id]`) — Generate Tab
1. **Prompt input** — user describes the image they want.
2. **Generate Concept** — triggers a 4-step pipeline:
   - Llama 3.3 70B enhances the prompt with artistic details
   - Vector Search finds the 3 most relevant reference images by caption
   - Combines enhanced prompt + reference captions + "STYLFRG" trigger word
   - Replicate generates the image (uses project's custom LoRA if trained, otherwise default FLUX)
3. **Result display** — generated image, enhanced prompt, and matched references.

---

## What's Working

- Multi-project CRUD
- Image upload to Databricks Volume
- AI captioning via Llama 4 Maverick
- Per-project LoRA model training via Replicate
- Training status polling with animated UI steps
- Vector Search with project-scoped filtering
- Prompt enhancement via Llama 3.3 70B
- Image generation via Replicate FLUX (custom or default model)
- Contextiv brand styling throughout

---

## Known Issues & Gotchas

- `.env.local` has been lost before when VS Code saves to wrong location. If "undefined" errors appear for Databricks URLs, verify the file exists in the project root.
- The Databricks SQL warehouse auto-sleeps. If "No projects yet" appears, wake it from the Databricks console and wait 1-2 minutes.
- The projects table has duplicate rows for proj-001 (inserted twice accidentally) — not breaking anything but could be cleaned up.
- SQL Statements API requires warehouse_id `"7cb6d88dbcea8491"` — not `"SERVERLESS"`.

---

## Roadmap

1. ~~Per-project LoRA training~~ — Done
2. Digitize more personal illustrations and retrain proj-001
3. Deploy to Vercel (GitHub and Vercel accounts not yet set up)
4. Creative brief upload — incorporate brand guidelines/PDFs into prompt enhancement
5. Multiple concept directions — generate variations per prompt
6. Save and share — persist generated concepts and share with clients

---

## User Context

- **Skill level:** Beginner developer, learning as we build
- **Platform:** Mac — Terminal, VS Code, Safari
- **Prefers:** Step-by-step paste-ready commands, one at a time, with explanations
- **Background:** Former illustrator — understands art direction, visual style, composition
- **Goal:** Building StyleForge as both a creative tool and a Databricks portfolio piece for Contextiv Consulting
