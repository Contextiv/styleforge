import { NextRequest, NextResponse } from "next/server";

const databricksHost = process.env.DATABRICKS_HOST;
const databricksToken = process.env.DATABRICKS_TOKEN;

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

// GET — List gallery images for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await databricksSQL(`
      SELECT id, filename, file_path, original_prompt, enhanced_prompt, style_references, generated_at
      FROM styleforge.data.generated_images
      WHERE project_id = '${id}'
      ORDER BY generated_at DESC
    `);

    const images =
      result.result?.data_array?.map((row: string[]) => ({
        id: parseInt(row[0]),
        filename: row[1],
        file_path: row[2],
        original_prompt: row[3],
        enhanced_prompt: row[4],
        style_references: row[5],
        generated_at: row[6],
      })) || [];

    return NextResponse.json({ success: true, images });
  } catch (error) {
    console.error("Error loading gallery:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load gallery" },
      { status: 500 }
    );
  }
}

// POST — Save a generated image to the gallery
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { imageUrl, originalPrompt, enhancedPrompt, styleReferences } =
      await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "Missing imageUrl" },
        { status: 400 }
      );
    }

    // Download image from Replicate CDN
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        { success: false, error: "Failed to download image from source" },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const timestamp = Date.now();
    const filename = `gen-${timestamp}.webp`;
    const volumePath = `/Volumes/styleforge/data/illustrations/${id}/generated/${filename}`;

    // Upload to Databricks Volume
    const uploadRes = await fetch(
      `${databricksHost}/api/2.0/fs/files${volumePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${databricksToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: buffer,
      }
    );

    if (!uploadRes.ok) {
      console.error(`Databricks upload failed (${uploadRes.status}) for: ${volumePath}`);
      return NextResponse.json(
        { success: false, error: "Failed to save image to storage" },
        { status: 500 }
      );
    }

    // Serialize style references for storage
    const refsJson = JSON.stringify(styleReferences || []);

    // Insert metadata row
    await databricksSQL(`
      INSERT INTO styleforge.data.generated_images
      (id, project_id, filename, file_path, original_prompt, enhanced_prompt, style_references, generated_at)
      VALUES (
        ${timestamp},
        '${id}',
        '${filename}',
        'dbfs:${volumePath}',
        '${(originalPrompt || "").replace(/'/g, "''")}',
        '${(enhancedPrompt || "").replace(/'/g, "''")}',
        '${refsJson.replace(/'/g, "''")}',
        current_timestamp()
      )
    `);

    return NextResponse.json({
      success: true,
      image: { id: timestamp, filename },
    });
  } catch (error) {
    console.error("Gallery save error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save image" },
      { status: 500 }
    );
  }
}

// DELETE — Remove an image from the gallery
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = request.nextUrl.searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "Missing imageId" },
        { status: 400 }
      );
    }

    // Look up file_path before deleting
    const lookupResult = await databricksSQL(`
      SELECT file_path FROM styleforge.data.generated_images
      WHERE id = ${imageId} AND project_id = '${id}'
    `);

    const filePath = lookupResult.result?.data_array?.[0]?.[0];

    // Delete from Databricks Volume if file_path exists
    if (filePath) {
      const volumePath = filePath.replace(/^dbfs:/, "");
      await fetch(`${databricksHost}/api/2.0/fs/files${volumePath}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${databricksToken}`,
        },
      });
    }

    // Delete the metadata row
    await databricksSQL(`
      DELETE FROM styleforge.data.generated_images
      WHERE id = ${imageId} AND project_id = '${id}'
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gallery delete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete image" },
      { status: 500 }
    );
  }
}
