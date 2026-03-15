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

export async function GET() {
  try {
    const result = await databricksSQL(`
      SELECT p.project_id, p.name, p.description,
             COUNT(m.id) as image_count, p.training_status
      FROM styleforge.data.projects p
      LEFT JOIN styleforge.data.illustration_metadata m
        ON p.project_id = m.project_id
      GROUP BY p.project_id, p.name, p.description, p.training_status
      ORDER BY p.name
    `);

    console.log("SQL result:", JSON.stringify(result, null, 2));
    const projects =
      result.result?.data_array?.map((row: string[]) => ({
        project_id: row[0],
        name: row[1],
        description: row[2],
        image_count: parseInt(row[3]) || 0,
        training_status: row[4] || null,
      })) || [];

    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("Error loading projects:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    const projectId = `proj-${Date.now()}`;

    await databricksSQL(`
      INSERT INTO styleforge.data.projects 
      VALUES ('${projectId}', '${name.replace(/'/g, "''")}', '${(description || "").replace(/'/g, "''")}', current_timestamp())
    `);

    return NextResponse.json({ success: true, project_id: projectId });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
