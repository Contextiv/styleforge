"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type StyleRef = { filename: string; caption: string };
type ProjectInfo = {
  project_id: string;
  name: string;
  description: string;
  replicate_model: string | null;
  replicate_version: string | null;
  training_status: string | null;
  replicate_training_id: string | null;
};
type ImageMeta = { id: number; filename: string; caption: string };

// Animated status steps for long operations
function StatusSteps({ steps, activeIndex }: { steps: string[]; activeIndex: number }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          {i < activeIndex ? (
            <span className="text-green-400 text-sm w-5 text-center">&#10003;</span>
          ) : i === activeIndex ? (
            <div className="w-4 h-4 border-2 border-[#68899D]/30 border-t-[#A9DFFF] rounded-full animate-spin ml-0.5"></div>
          ) : (
            <span className="w-5 text-center text-[#68899D]/30 text-sm">&#9679;</span>
          )}
          <span className={`text-sm ${i < activeIndex ? "text-green-400" : i === activeIndex ? "text-[#A9DFFF]" : "text-[#68899D]/40"}`}>
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadStep, setUploadStep] = useState(0);

  // Generate state
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateStep, setGenerateStep] = useState(0);
  const generateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [result, setResult] = useState<{
    imageUrl: string | null;
    enhancedPrompt: string;
    styleReferences: StyleRef[];
  } | null>(null);
  const [error, setError] = useState("");

  // Training state
  const [training, setTraining] = useState(false);
  const [trainInitStep, setTrainInitStep] = useState(0);
  const trainTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [trainingLogs, setTrainingLogs] = useState("");

  // Active tab
  const [tab, setTab] = useState<"references" | "generate">("references");

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
        setImages(data.images);
        setTrainingStatus(data.project.training_status);
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

  // Poll training status every 10 seconds when training is in progress
  useEffect(() => {
    if (trainingStatus !== "training") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/training-status`);
        const data = await res.json();
        if (data.success) {
          setTrainingStatus(data.status);
          if (data.logs) setTrainingLogs(data.logs);
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
            loadProject();
          }
        }
      } catch {
        console.error("Failed to check training status");
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [trainingStatus, projectId, loadProject]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadStep(0);
    setUploadStatus("");

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
        setUploadStep(1);
        const captionRes = await fetch(`/api/projects/${projectId}/caption`, {
          method: "POST",
        });
        const captionData = await captionRes.json();
        if (captionData.success) {
          setUploadStep(2);
          setUploadStatus(`${captionData.captioned} image(s) uploaded and captioned.`);
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

  async function handleTrain() {
    setTraining(true);
    setTrainInitStep(0);
    setUploadStatus("");

    // Animate through steps while the API call runs
    trainTimerRef.current = setInterval(() => {
      setTrainInitStep((prev) => Math.min(prev + 1, 2));
    }, 3000);

    try {
      const res = await fetch(`/api/projects/${projectId}/train`, {
        method: "POST",
      });
      const data = await res.json();
      if (trainTimerRef.current) clearInterval(trainTimerRef.current);
      if (data.success) {
        setTrainInitStep(3);
        setTrainingStatus("training");
      } else {
        setUploadStatus(data.error || "Training failed to start.");
      }
    } catch {
      if (trainTimerRef.current) clearInterval(trainTimerRef.current);
      setUploadStatus("Something went wrong starting training.");
    } finally {
      setTraining(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenerateStep(0);
    setError("");
    setResult(null);

    // Animate through steps while the API call runs
    generateTimerRef.current = setInterval(() => {
      setGenerateStep((prev) => Math.min(prev + 1, 2));
    }, 4000);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, project_id: projectId }),
      });
      const data = await res.json();
      if (generateTimerRef.current) clearInterval(generateTimerRef.current);
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
      if (generateTimerRef.current) clearInterval(generateTimerRef.current);
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
                {!uploading ? (
                  <div className="text-[#68899D]">
                    <p className="text-lg mb-1">
                      Drop reference images here or click to upload
                    </p>
                    <p className="text-sm text-[#68899D]/50">
                      JPG, PNG, or WebP — each image will be analyzed by AI
                    </p>
                  </div>
                ) : (
                  <div className="text-left inline-block">
                    <StatusSteps
                      steps={[
                        "Uploading images to Databricks...",
                        "Analyzing images with AI...",
                        "Upload complete",
                      ]}
                      activeIndex={uploadStep}
                    />
                  </div>
                )}
              </label>
            </div>

            {/* Upload/Training status message */}
            {uploadStatus && !uploading && (
              <div className="mb-6 px-4 py-3 bg-[#1a1a1a] border border-[#68899D]/20 rounded-lg text-sm text-[#A9DFFF]">
                {uploadStatus}
              </div>
            )}

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

            {/* Training Section */}
            {images.length > 0 && images.some(img => img.caption !== "Pending captioning...") && (
              <div className="mt-8 bg-[#1a1a1a] border border-[#68899D]/20 rounded-lg p-6">
                <h3 className="text-xs font-medium text-[#A9DFFF] mb-3 uppercase tracking-wider">
                  Model Training
                </h3>

                {!trainingStatus && !training && (
                  <div>
                    <p className="text-[#68899D] text-sm mb-4">
                      Train a custom LoRA model on your reference images. This takes 15-30 minutes.
                    </p>
                    <button
                      onClick={handleTrain}
                      className="px-5 py-2.5 bg-[#A9DFFF] text-[#141414] hover:bg-[#A9DFFF]/80 rounded-lg font-medium transition-colors text-sm"
                    >
                      Train Model
                    </button>
                  </div>
                )}

                {!trainingStatus && training && (
                  <div>
                    <p className="text-[#68899D] text-sm mb-4">Preparing your training data...</p>
                    <StatusSteps
                      steps={[
                        "Downloading images from Databricks...",
                        "Packaging images and captions...",
                        "Uploading to Replicate and starting training...",
                      ]}
                      activeIndex={trainInitStep}
                    />
                  </div>
                )}

                {trainingStatus === "training" && (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-5 h-5 border-2 border-[#68899D]/30 border-t-[#A9DFFF] rounded-full animate-spin"></div>
                      <p className="text-[#A9DFFF] text-sm font-medium">Training in progress...</p>
                    </div>
                    <p className="text-[#68899D] text-xs">This usually takes 15-30 minutes. You can leave this page and come back.</p>
                    {trainingLogs && (
                      <pre className="mt-3 text-xs text-[#68899D]/70 bg-[#141414] rounded p-3 overflow-x-auto">
                        {trainingLogs}
                      </pre>
                    )}
                  </div>
                )}

                {trainingStatus === "completed" && (
                  <div className="flex items-center gap-3">
                    <span className="text-green-400 text-lg">&#10003;</span>
                    <p className="text-green-400 text-sm font-medium">
                      Model trained successfully! Generate images using your custom style.
                    </p>
                  </div>
                )}

                {trainingStatus === "failed" && (
                  <div>
                    <p className="text-[#FF50AD] text-sm mb-3">Training failed. You can try again.</p>
                    <button
                      onClick={handleTrain}
                      disabled={training}
                      className="px-5 py-2.5 bg-[#FF50AD] hover:bg-[#FF88A1] disabled:bg-[#68899D]/20 rounded-lg font-medium transition-colors text-sm"
                    >
                      {training ? "Starting..." : "Retry Training"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Tab */}
        {tab === "generate" && (
          <div>
            {/* Model indicator */}
            {project.replicate_version ? (
              <div className="mb-4 px-3 py-2 bg-green-400/10 border border-green-400/20 rounded-lg text-green-400 text-xs">
                Using your custom-trained model
              </div>
            ) : (
              <div className="mb-4 px-3 py-2 bg-[#68899D]/10 border border-[#68899D]/20 rounded-lg text-[#68899D] text-xs">
                Using default model — train a custom model in the References tab for better results
              </div>
            )}

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
                  <div className="py-12 flex justify-center">
                    <div className="bg-[#1a1a1a] border border-[#68899D]/20 rounded-lg p-6">
                      <StatusSteps
                        steps={[
                          "Enhancing your prompt with artistic details...",
                          "Finding matching reference images...",
                          "Generating image with AI...",
                        ]}
                        activeIndex={generateStep}
                      />
                      <p className="text-[#68899D]/50 text-xs mt-4">This usually takes 15-30 seconds</p>
                    </div>
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
