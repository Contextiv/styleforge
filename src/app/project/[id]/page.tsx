"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type StyleRef = { filename: string; caption: string };
type ProjectInfo = { project_id: string; name: string; description: string };
type ImageMeta = { id: number; filename: string; caption: string };

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // Generate state
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    imageUrl: string | null;
    enhancedPrompt: string;
    styleReferences: StyleRef[];
  } | null>(null);
  const [error, setError] = useState("");

  // Active tab
  const [tab, setTab] = useState<"references" | "generate">("references");

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
        setImages(data.images);
      }
    } catch {
      console.error("Failed to load project");
    } finally {
      setLoadingProject(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadStatus(`Uploading ${files.length} file(s)...`);

    const formData = new FormData();
    formData.append("project_id", projectId);
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadStatus(
          `Uploaded ${data.uploaded} file(s). Captioning with AI...`
        );
        // Trigger captioning
        const captionRes = await fetch(`/api/projects/${projectId}/caption`, {
          method: "POST",
        });
        const captionData = await captionRes.json();
        if (captionData.success) {
          setUploadStatus(
            `Done! ${captionData.captioned} images captioned.`
          );
          loadProject();
        } else {
          setUploadStatus("Upload succeeded but captioning failed.");
        }
      } else {
        setUploadStatus("Upload failed. Try again.");
      }
    } catch {
      setUploadStatus("Something went wrong.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, project_id: projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          imageUrl: data.imageUrl,
          enhancedPrompt: data.enhancedPrompt,
          styleReferences: data.styleReferences,
        });
      } else {
        setError("Generation failed. Please try again.");
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  if (loadingProject) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="inline-block w-10 h-10 border-4 border-[#68899D]/30 border-t-[#A9DFFF] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <p className="text-[#68899D]">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Header */}
      <header className="border-b border-[#68899D]/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-[#68899D] hover:text-[#A9DFFF] transition-colors text-sm"
          >
            ← Projects
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-[#68899D]">{project.description}</p>
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight">
          Style<span className="text-[#A9DFFF]">Forge</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-[#1a1a1a] rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("references")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "references"
                ? "bg-[#A9DFFF] text-[#141414]"
                : "text-[#68899D] hover:text-white"
            }`}
          >
            References ({images.length})
          </button>
          <button
            onClick={() => setTab("generate")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "generate"
                ? "bg-[#FF50AD] text-white"
                : "text-[#68899D] hover:text-white"
            }`}
          >
            Generate
          </button>
        </div>

        {/* References Tab */}
        {tab === "references" && (
          <div>
            {/* Upload Area */}
            <div className="mb-8 bg-[#1a1a1a] border-2 border-dashed border-[#68899D]/30 rounded-lg p-8 text-center">
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <div className="text-[#68899D]">
                  <p className="text-lg mb-1">
                    {uploading
                      ? uploadStatus
                      : "Drop reference images here or click to upload"}
                  </p>
                  <p className="text-sm text-[#68899D]/50">
                    JPG, PNG, or WebP — each image will be analyzed by AI
                  </p>
                </div>
              </label>
            </div>

            {/* Image Grid */}
            {images.length === 0 ? (
              <p className="text-center text-[#68899D] py-8">
                No reference images yet. Upload some to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="bg-[#1a1a1a] border border-[#68899D]/20 rounded-lg p-4"
                  >
                    <p className="text-[#FF50AD] text-sm font-medium mb-1">
                      {img.filename}
                    </p>
                    <p className="text-[#68899D] text-sm">{img.caption}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generate Tab */}
        {tab === "generate" && (
          <div>
            {images.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#68899D] mb-4">
                  Upload reference images first to define the visual direction.
                </p>
                <button
                  onClick={() => setTab("references")}
                  className="px-5 py-2 bg-[#A9DFFF] text-[#141414] rounded-lg font-medium text-sm"
                >
                  Go to References
                </button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <label className="block text-xs text-[#68899D] mb-2 uppercase tracking-wider font-medium">
                    Describe the creative direction
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., a bold hero image showing athletic energy with warm tones..."
                    className="w-full h-28 bg-[#1a1a1a] border border-[#68899D]/30 rounded-lg px-4 py-3 text-white placeholder-[#68899D]/50 focus:outline-none focus:border-[#A9DFFF] transition-colors resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="mt-3 px-6 py-2.5 bg-[#FF50AD] hover:bg-[#FF88A1] disabled:bg-[#68899D]/20 disabled:text-[#68899D]/50 rounded-lg font-medium transition-colors"
                  >
                    {generating ? "Generating..." : "Generate Concept"}
                  </button>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-[#FF50AD]/10 border border-[#FF50AD]/30 rounded-lg text-[#FF88A1]">
                    {error}
                  </div>
                )}

                {generating && (
                  <div className="text-center py-16">
                    <div className="inline-block w-10 h-10 border-4 border-[#68899D]/30 border-t-[#A9DFFF] rounded-full animate-spin mb-4"></div>
                    <p className="text-[#68899D]">
                      Enhancing prompt. Matching references. Generating.
                    </p>
                  </div>
                )}

                {result && (
                  <div className="space-y-6">
                    {result.imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-[#68899D]/20">
                        <img
                          src={result.imageUrl}
                          alt={prompt}
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="bg-[#1a1a1a] rounded-lg p-5 border border-[#68899D]/20">
                      <h3 className="text-xs font-medium text-[#A9DFFF] mb-2 uppercase tracking-wider">
                        Enhanced Prompt
                      </h3>
                      <p className="text-[#68899D] text-sm leading-relaxed">
                        {result.enhancedPrompt}
                      </p>
                    </div>

                    {result.styleReferences.length > 0 && (
                      <div className="bg-[#1a1a1a] rounded-lg p-5 border border-[#68899D]/20">
                        <h3 className="text-xs font-medium text-[#A9DFFF] mb-3 uppercase tracking-wider">
                          Matched References
                        </h3>
                        {result.styleReferences.map((ref, i) => (
                          <div
                            key={i}
                            className="py-3 border-t border-[#68899D]/10 first:border-0"
                          >
                            <p className="text-[#FF50AD] text-sm font-medium">
                              {ref.filename}
                            </p>
                            <p className="text-[#68899D] text-sm mt-1">
                              {ref.caption}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-[#68899D]/10 px-6 py-4 mt-20">
        <p className="text-xs text-[#68899D]/50 text-center">
          © 2025 Contextiv LLC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
