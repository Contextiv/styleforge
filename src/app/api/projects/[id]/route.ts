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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const projectResult = await databricksSQL(`
      SELECT project_id, name, description, replicate_model, replicate_version, training_status, replicate_training_id
      FROM styleforge.data.projects
      WHERE project_id = '${id}'
    `);

    const projectRow = projectResult.result?.data_array?.[0];
    if (!projectRow) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    const imagesResult = await databricksSQL(`
      SELECT id, filename, caption 
      FROM styleforge.data.illustration_metadata 
      WHERE project_id = '${id}'
      ORDER BY id
    `);

    const images =
      imagesResult.result?.data_array?.map((row: string[]) => ({
        id: parseInt(row[0]),
        filename: row[1],
        caption: row[2],
      })) || [];

    return NextResponse.json({
      success: true,
      project: {
        project_id: projectRow[0],
        name: projectRow[1],
        description: projectRow[2],
        replicate_model: projectRow[3] || null,
        replicate_version: projectRow[4] || null,
        training_status: projectRow[5] || null,
        replicate_training_id: projectRow[6] || null,
      },
      images,
    });
  } catch (error) {
    console.error("Error loading project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load project" },
      { status: 500 }
    );
  }
}
