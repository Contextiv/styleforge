import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const databricksHost = process.env.DATABRICKS_HOST;
const databricksToken = process.env.DATABRICKS_TOKEN;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const files = formData.getAll("files");

    let uploaded = 0;

    for (const file of files) {
      if (!(file instanceof File)) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload to Databricks Volume via API
      const uploadPath = `/Volumes/styleforge/data/illustrations/${id}/${file.name}`;

      const res = await fetch(
        `${databricksHost}/api/2.0/fs/files${uploadPath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${databricksToken}`,
            "Content-Type": "application/octet-stream",
          },
          body: buffer,
        }
      );

      if (res.ok) {
        // Add to metadata table
        const sqlRes = await fetch(
          `${databricksHost}/api/2.0/sql/statements`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${databricksToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              statement: `
                INSERT INTO styleforge.data.illustration_metadata 
                (id, filename, file_path, file_size_kb, uploaded_at, caption, project_id)
                VALUES (
                  ${Date.now() + uploaded},
                  '${file.name.replace(/'/g, "''")}',
                  'dbfs:${uploadPath}',
                  ${Math.round(buffer.length / 1024 * 10) / 10},
                  current_timestamp(),
                  'Pending captioning...',
                  '${id}'
                )
              `,
              warehouse_id: "7cb6d88dbcea8491",
              wait_timeout: "30s",
            }),
          }
        );
        uploaded++;
      }
    }

    return NextResponse.json({ success: true, uploaded });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
