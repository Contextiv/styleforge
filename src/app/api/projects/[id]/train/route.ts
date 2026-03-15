import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import JSZip from "jszip";

const databricksHost = process.env.DATABRICKS_HOST;
const databricksToken = process.env.DATABRICKS_TOKEN;
const replicateToken = process.env.REPLICATE_API_TOKEN;
const modelOwner = process.env.REPLICATE_MODEL_OWNER;

async function databricksSQL(statement: string) {
  const res = await fetch(`${databricksHost}/api/2.0/sql/statements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${databricksToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statement,
      warehouse_id: "7cb6d88dbcea8491",
      wait_timeout: "30s",
    }),
  });
  return res.json();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if already training
    const statusCheck = await databricksSQL(`
      SELECT training_status FROM styleforge.data.projects WHERE project_id = '${id}'
    `);
    const currentStatus = statusCheck.result?.data_array?.[0]?.[0];
    if (currentStatus === "training") {
      return NextResponse.json(
        { success: false, error: "Training is already in progress for this project." },
        { status: 400 }
      );
    }

    // Get project's captioned images
    const imagesResult = await databricksSQL(`
      SELECT id, filename, caption
      FROM styleforge.data.illustration_metadata
      WHERE project_id = '${id}' AND caption != 'Pending captioning...'
      ORDER BY id
    `);

    const images = imagesResult.result?.data_array || [];
    if (images.length === 0) {
      return NextResponse.json(
        { success: false, error: "No captioned images found. Upload and caption images first." },
        { status: 400 }
      );
    }

    // Build ZIP with images + metadata.jsonl
    const zip = new JSZip();
    const metadataLines: string[] = [];

    for (const row of images) {
      const filename = row[1] as string;
      const caption = row[2] as string;

      // Download image from Databricks Volume
      const filePath = `/Volumes/styleforge/data/illustrations/${id}/${filename}`;
      const fileRes = await fetch(
        `${databricksHost}/api/2.0/fs/files${filePath}`,
        { headers: { Authorization: `Bearer ${databricksToken}` } }
      );

      if (!fileRes.ok) {
        console.error(`Failed to download ${filename}`);
        continue;
      }

      const fileBuffer = await fileRes.arrayBuffer();
      zip.file(filename, fileBuffer);
      metadataLines.push(
        JSON.stringify({ file_name: filename, text: `STYLFRG ${caption}` })
      );
    }

    zip.file("metadata.jsonl", metadataLines.join("\n"));

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Upload ZIP to Replicate Files API
    const replicate = new Replicate({ auth: replicateToken });
    const file = await replicate.files.create(
      new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" }),
    );
    const zipUrl = file.urls.get;

    // Start training on Replicate
    const training = await replicate.trainings.create(
      "ostris",
      "flux-dev-lora-trainer",
      "d995297071a44dcb72244e6c19462111649ec86a9646c32df56daa7f14801944",
      {
        destination: `${modelOwner}/styleforge-custom`,
        input: {
          input_images: zipUrl,
          trigger_word: "STYLFRG",
          steps: 1000,
          lora_rank: 16,
          learning_rate: 0.0004,
          autocaption: false,
        },
      }
    );

    // Update project in database
    await databricksSQL(`
      UPDATE styleforge.data.projects
      SET training_status = 'training',
          replicate_training_id = '${training.id}',
          replicate_model = '${modelOwner}/styleforge-custom'
      WHERE project_id = '${id}'
    `);

    return NextResponse.json({
      success: true,
      training_id: training.id,
      status: "training",
    });
  } catch (error) {
    console.error("Training error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start training" },
      { status: 500 }
    );
  }
}
