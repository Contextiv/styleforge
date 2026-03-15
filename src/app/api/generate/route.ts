import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt, project_id } = await request.json();

    const databricksHost = process.env.DATABRICKS_HOST;
    const databricksToken = process.env.DATABRICKS_TOKEN;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    // Step 1: Enhance the prompt using Databricks-hosted LLM
    const enhanceResponse = await fetch(
      `${databricksHost}/serving-endpoints/databricks-meta-llama-3-3-70b-instruct/invocations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${databricksToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are an art director helping a creative team. Take the user's prompt and enhance it with specific artistic details: composition, lighting, color palette, texture, and mood. Keep it under 100 words. Return ONLY the enhanced prompt, nothing else.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
        }),
      }
    );

    const enhanceResult = await enhanceResponse.json();
    const enhancedPrompt =
      enhanceResult.choices?.[0]?.message?.content || prompt;

    // Step 2: Search Vector Search for style references filtered by project
    const searchBody: Record<string, unknown> = {
      query_text: prompt,
      columns: ["id", "filename", "caption", "project_id"],
      num_results: 3,
    };

if (project_id) {
      searchBody.filters_json = JSON.stringify({
        "project_id": project_id,
      });
    }

    const searchResponse = await fetch(
      `${databricksHost}/api/2.0/vector-search/indexes/styleforge.data.illustration_index/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${databricksToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      }
    );

    const searchResult = await searchResponse.json();
    console.log("Search result:", JSON.stringify(searchResult, null, 2));
    const styleRefs =
      searchResult.result?.data_array?.map(
        (doc: (string | number)[]) => ({
          filename: doc[1],
          caption: doc[2],
        })
      ) || [];

    // Step 3: Build style-informed prompt
    const styleDescriptions = styleRefs
      .map((ref: { filename: string; caption: string }) => ref.caption)
      .join(" ");

    const styledPrompt = `STYLFRG ${enhancedPrompt}. Artistic style reference: ${styleDescriptions}. Match this illustrative style closely — use similar color palettes, brushwork, textures, and compositional approach.`;

    // Step 4: Check if project has a custom-trained model
    const DEFAULT_VERSION = "6cf56a65fbcb6780fbf892befe53af18edb2c9ad0213e8eaaf4b78ebd7cc25f8";
    let modelVersion = DEFAULT_VERSION;

    if (project_id) {
      const projectRes = await fetch(`${databricksHost}/api/2.0/sql/statements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${databricksToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          statement: `SELECT replicate_version FROM styleforge.data.projects WHERE project_id = '${project_id}'`,
          warehouse_id: "7cb6d88dbcea8491",
          wait_timeout: "30s",
        }),
      });
      const projectResult = await projectRes.json();
      const projectVersion = projectResult.result?.data_array?.[0]?.[0];
      if (projectVersion) {
        modelVersion = projectVersion;
      }
    }

    // Step 5: Generate image using Replicate
    const replicateResponse = await fetch(
      "https://api.replicate.com/v1/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          version: modelVersion,
          input: {
            prompt: styledPrompt,
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 90,
          },
        }),
      }
    );

    const replicateResult = await replicateResponse.json();
    console.log(
      "Replicate response:",
      JSON.stringify(replicateResult, null, 2)
    );
    const imageUrl = replicateResult.output?.[0] || null;

    return NextResponse.json({
      success: true,
      originalPrompt: prompt,
      enhancedPrompt,
      styleReferences: styleRefs,
      imageUrl,
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { success: false, error: "Generation failed" },
      { status: 500 }
    );
  }
}
