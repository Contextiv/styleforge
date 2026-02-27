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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get uncaptioned images for this project
    const result = await databricksSQL(`
      SELECT id, filename 
      FROM styleforge.data.illustration_metadata 
      WHERE project_id = '${id}' AND caption = 'Pending captioning...'
    `);

    const images = result.result?.data_array || [];
    let captioned = 0;

    for (const row of images) {
      const imageId = row[0];
      const filename = row[1];

      try {
        // Read image from Volume
        const filePath = `/Volumes/styleforge/data/illustrations/${id}/${filename}`;
        const fileRes = await fetch(
          `${databricksHost}/api/2.0/fs/files${filePath}`,
          {
            headers: { Authorization: `Bearer ${databricksToken}` },
          }
        );

        if (!fileRes.ok) continue;

        const fileBuffer = await fileRes.arrayBuffer();
        const b64 = Buffer.from(fileBuffer).toString("base64");
        const ext = filename.split(".").pop()?.toLowerCase() || "jpeg";
        const mediaType =
          ext === "png" ? "image/png" : "image/jpeg";

        // Caption with Llama 4 Maverick
        const captionRes = await fetch(
          `${databricksHost}/serving-endpoints/databricks-llama-4-maverick/invocations`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${databricksToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "You are an art expert analyzing visual reference material. Describe this image in detail: the subject matter, artistic style, techniques, color palette, mood, composition, and any distinctive characteristics. Be specific. Write 2-3 sentences.",
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mediaType};base64,${b64}`,
                      },
                    },
                  ],
                },
              ],
              max_tokens: 300,
            }),
          }
        );

        const captionResult = await captionRes.json();
        const caption =
          captionResult.choices?.[0]?.message?.content ||
          "Captioning failed";

        // Update the metadata
        await databricksSQL(`
          UPDATE styleforge.data.illustration_metadata 
          SET caption = '${caption.replace(/'/g, "''")}'
          WHERE id = ${imageId}
        `);

        captioned++;
      } catch (err) {
        console.error(`Failed to caption ${filename}:`, err);
      }
    }

    // Sync Vector Search index
    await fetch(
      `${databricksHost}/api/2.0/vector-search/indexes/styleforge.data.illustration_index/sync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${databricksToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json({ success: true, captioned });
  } catch (error) {
    console.error("Captioning error:", error);
    return NextResponse.json(
      { success: false, error: "Captioning failed" },
      { status: 500 }
    );
  }
}
