import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

const databricksHost = process.env.DATABRICKS_HOST;
const databricksToken = process.env.DATABRICKS_TOKEN;
const replicateToken = process.env.REPLICATE_API_TOKEN;

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

    // Get the training ID from the database
    const projectResult = await databricksSQL(`
      SELECT training_status, replicate_training_id, replicate_version
      FROM styleforge.data.projects
      WHERE project_id = '${id}'
    `);

    const row = projectResult.result?.data_array?.[0];
    if (!row) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    const [trainingStatus, trainingId, existingVersion] = row;

    // If no training has been started, or already completed/failed
    if (!trainingId || trainingStatus === "completed" || trainingStatus === "failed") {
      return NextResponse.json({
        success: true,
        status: trainingStatus || null,
        version: existingVersion || null,
      });
    }

    // Poll Replicate for current status
    const replicate = new Replicate({ auth: replicateToken });
    const training = await replicate.trainings.get(trainingId);

    // If succeeded, update database with the trained version
    if (training.status === "succeeded") {
      const trainedVersion = (training.output as { version?: string })?.version || null;

      await databricksSQL(`
        UPDATE styleforge.data.projects
        SET training_status = 'completed',
            replicate_version = '${trainedVersion}'
        WHERE project_id = '${id}'
      `);

      return NextResponse.json({
        success: true,
        status: "completed",
        version: trainedVersion,
      });
    }

    // If failed, update database
    if (training.status === "failed" || training.status === "canceled") {
      await databricksSQL(`
        UPDATE styleforge.data.projects
        SET training_status = 'failed'
        WHERE project_id = '${id}'
      `);

      return NextResponse.json({
        success: true,
        status: "failed",
        error: training.error || "Training failed",
      });
    }

    // Still in progress
    return NextResponse.json({
      success: true,
      status: "training",
      logs: training.logs?.split("\n").slice(-5).join("\n") || "",
    });
  } catch (error) {
    console.error("Training status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check training status" },
      { status: 500 }
    );
  }
}
