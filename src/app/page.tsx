"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type Project = {
  project_id: string;
  name: string;
  description: string;
  image_count: number;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.success) setProjects(data.projects);
    } catch {
      console.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      const data = await res.json();
      if (data.success) {
        setNewName("");
        setNewDesc("");
        setShowCreate(false);
        loadProjects();
      }
    } catch {
      console.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Header */}
      <header className="border-b border-[#68899D]/30 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Style<span className="text-[#A9DFFF]">Forge</span>
          </h1>
          <p className="text-sm text-[#68899D]">by Contextiv Consulting</p>
        </div>
        <div className="text-xs text-[#68899D]">Intelligence in Motion</div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              Creative <span className="text-[#FF50AD]">Projects</span>
            </h2>
            <p className="text-[#68899D]">
              Upload references. Define the brief. Generate directions.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-5 py-2.5 bg-[#FF50AD] hover:bg-[#FF88A1] rounded-lg font-medium transition-colors text-sm"
          >
            + New Project
          </button>
        </div>

        {/* Create Project Form */}
        {showCreate && (
          <div className="mb-8 bg-[#1a1a1a] border border-[#68899D]/20 rounded-lg p-6">
            <h3 className="text-xs font-medium text-[#A9DFFF] mb-4 uppercase tracking-wider">
              New Project
            </h3>
            <input
              type="text"
              placeholder="Project name (e.g., Nike Spring Campaign)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-[#141414] border border-[#68899D]/30 rounded-lg px-4 py-3 text-white placeholder-[#68899D]/50 focus:outline-none focus:border-[#A9DFFF] transition-colors mb-3"
            />
            <textarea
              placeholder="Brief description — what's the creative direction?"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full h-20 bg-[#141414] border border-[#68899D]/30 rounded-lg px-4 py-3 text-white placeholder-[#68899D]/50 focus:outline-none focus:border-[#A9DFFF] transition-colors resize-none mb-3"
            />
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-5 py-2 bg-[#A9DFFF] text-[#141414] hover:bg-[#A9DFFF]/80 disabled:bg-[#68899D]/20 disabled:text-[#68899D]/50 rounded-lg font-medium transition-colors text-sm"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-5 py-2 border border-[#68899D]/30 text-[#68899D] hover:text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-10 h-10 border-4 border-[#68899D]/30 border-t-[#A9DFFF] rounded-full animate-spin"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-[#68899D]">
            No projects yet. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.project_id}
                href={`/project/${project.project_id}`}
                className="group bg-[#1a1a1a] border border-[#68899D]/20 rounded-lg p-5 hover:border-[#A9DFFF]/50 transition-colors"
              >
                <h3 className="font-bold text-lg mb-1 group-hover:text-[#A9DFFF] transition-colors">
                  {project.name}
                </h3>
                <p className="text-[#68899D] text-sm mb-3 line-clamp-2">
                  {project.description || "No description"}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#68899D]/60">
                  <span className="bg-[#141414] px-2 py-1 rounded">
                    {project.image_count} references
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#68899D]/10 px-6 py-4 mt-20">
        <p className="text-xs text-[#68899D]/50 text-center">
          © 2025 Contextiv LLC. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
