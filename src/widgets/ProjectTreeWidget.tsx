import { useState } from "react";
import { useLukeTool } from "./useLukeTool";
import { useWidgetsContext } from "./WidgetsContext";

export interface ProjectTreeNode {
    name: string;
    type: "folder" | "file";
    /** Present only on files that are actually open in a sibling
     *  CodeEditorWidget — clicking them switches the shared active file.
     *  Files without a `path` are decorative: mentioned for realistic
     *  project context (design patterns rarely apply to one isolated
     *  class) without being part of the editable exercise. */
    path?: string;
    children?: ProjectTreeNode[];
}

interface ProjectTreeWidgetProps {
    params?: { title?: string; tree?: ProjectTreeNode[] };
}

// Read-only-to-LEIA project structure, clickable-to-the-student. Gives the
// exercise realistic surrounding context (packages, other classes) and, for
// files that are also open in a sibling CodeEditorWidget, doubles as file
// navigation via the shared `activeFile` in WidgetsContext.
export function ProjectTreeWidget({ params }: ProjectTreeWidgetProps = {}) {
    const tree = params?.tree ?? [];
    const { activeFile, setActiveFile } = useWidgetsContext();

    useLukeTool(
        "projectTree_read",
        "Reads the project's file/folder structure shown to the student. Returns { tree }, a nested list of { name, type: 'file'|'folder', path?, children? }. Use this to reference realistic project context (e.g. other classes or packages) in conversation — most nodes are context only, not files the student can open.",
        { type: "object", properties: {} },
        async () => ({ tree }),
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 200 }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.2)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                    {params?.title ?? "Project"}
                </span>
            </div>
            <div className="leia-scrollbar" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 4px", background: "rgba(0,0,0,0.15)" }}>
                {tree.length === 0 ? (
                    <div style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>No project structure configured.</div>
                ) : (
                    tree.map((node, i) => (
                        <TreeNodeView
                            key={`${node.name}-${i}`}
                            node={node}
                            depth={0}
                            activeFile={activeFile}
                            onSelectFile={setActiveFile}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

interface TreeNodeViewProps {
    node: ProjectTreeNode;
    depth: number;
    activeFile: string | null;
    onSelectFile: (path: string) => void;
}

function TreeNodeView({ node, depth, activeFile, onSelectFile }: TreeNodeViewProps) {
    const [open, setOpen] = useState(true);
    const isFolder = node.type === "folder";
    const isOpenableFile = node.type === "file" && !!node.path;
    const isActive = isOpenableFile && node.path === activeFile;

    return (
        <div>
            <div
                onClick={() => {
                    if (isFolder) setOpen((v) => !v);
                    else if (isOpenableFile && node.path) onSelectFile(node.path);
                }}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    paddingLeft: 8 + depth * 14,
                    fontSize: 12.5,
                    fontFamily: isFolder ? undefined : "monospace",
                    color: isActive ? "#e5e7eb" : isFolder ? "#cbd5e1" : isOpenableFile ? "#93c5fd" : "#6b7280",
                    background: isActive ? "rgba(96,165,250,0.15)" : "transparent",
                    borderRadius: 4,
                    cursor: isFolder || isOpenableFile ? "pointer" : "default",
                }}
            >
                <span style={{ width: 12, flexShrink: 0, textAlign: "center", opacity: 0.7 }}>
                    {isFolder ? (open ? "▾" : "▸") : isOpenableFile ? "📄" : "·"}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
            </div>
            {isFolder && open && node.children?.map((child, i) => (
                <TreeNodeView
                    key={`${child.name}-${i}`}
                    node={child}
                    depth={depth + 1}
                    activeFile={activeFile}
                    onSelectFile={onSelectFile}
                />
            ))}
        </div>
    );
}
