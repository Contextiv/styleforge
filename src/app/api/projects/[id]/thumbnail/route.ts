import { NextRequest, NextResponse } from "next/server";

const databricksHost = process.env.DATABRICKS_HOST;
const databricksToken = process.env.DATABRICKS_TOKEN;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filename = request.nextUrl.searchParams.get("filename");
    const filePath = request.nextUrl.searchParams.get("path");

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "Missing filename" },
        { status: 400 }
      );
    }

    // Use the stored file_path if provided, otherwise construct from project id
    let volumePath: string;
    if (filePath) {
      // file_path is stored as "dbfs:/Volumes/..." — strip the "dbfs:" prefix
      volumePath = filePath.replace(/^dbfs:/, "");
    } else {
      volumePath = `/Volumes/styleforge/data/illustrations/${id}/${filename}`;
    }

    const res = await fetch(
      `${databricksHost}/api/2.0/fs/files${volumePath}`,
      {
        headers: {
          Authorization: `Bearer ${databricksToken}`,
        },
      }
    );

    if (!res.ok) {
      console.error(`Databricks file fetch failed (${res.status}) for: ${volumePath}`);
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      );
    }

    const buffer = await res.arrayBuffer();

    // Determine content type from extension
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
    };
    const contentType = contentTypes[ext || ""] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load image" },
      { status: 500 }
    );
  }
}
