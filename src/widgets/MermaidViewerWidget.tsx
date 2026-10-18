import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import { useLukeTool } from "./useLukeTool";
import { useWidgetsContext } from "./WidgetsContext";

// Mirrors leia-workbench-frontend/src/widgets/MermaidViewerWidget.tsx — keep
// both in sync (this repo maintains its own widget copies for the designer
// "try" preview, see the note at the top of catalog.tsx).
let mermaidInitialized = false;

function initMermaidOnce() {
    if (mermaidInitialized) return;
    mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
            primaryColor: "#1e293b",
            primaryBorderColor: "#475569",
            primaryTextColor: "#e5e7eb",
            lineColor: "#94a3b8",
            background: "#0f172a",
            mainBkg: "#1e293b",
            nodeBorder: "#475569",
            clusterBkg: "#111827",
            titleColor: "#e5e7eb",
            edgeLabelBackground: "#0f172a",
        },
        securityLevel: "loose",
    });
    mermaidInitialized = true;
}

function cleanMermaidCode(raw: string): string {
    if (!raw) return "";
    let code = raw.trim();
    code = code.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/i, "");
    code = code.split("\\n").join("\n").split('\\"').join('"').split("\\'").join("'");
    return code.trim();
}

function fixSvgDimensions(svgString: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgString;
    if (!svg.getAttribute("viewBox")) {
        const w = svg.getAttribute("width");
        const h = svg.getAttribute("height");
        if (w && h) svg.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
    }
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "auto");
    svg.style.maxWidth = "none";
    svg.style.display = "block";
    return new XMLSerializer().serializeToString(svg);
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

const RENDER_DEBOUNCE_MS = 400;

interface MermaidViewerWidgetProps {
    params?: { initialCode?: string; title?: string };
}

// Student-editable Mermaid source with a live preview underneath. The
// student is the only author of the diagram — LEIA can only read it
// (mermaid_read) to give Socratic feedback; there is deliberately no tool
// that lets LEIA author or edit the diagram.
export function MermaidViewerWidget({ params }: MermaidViewerWidgetProps = {}) {
    const { setSubmissionContent } = useWidgetsContext();
    const [code, setCode] = useState<string>(() => params?.initialCode ?? "");
    const [debouncedCode, setDebouncedCode] = useState(code);
    const [svg, setSvg] = useState("");
    const [error, setError] = useState("");
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const startPos = useRef({ mx: 0, my: 0, px: 0, py: 0 });
    const lastRenderedRef = useRef<string>("");
    const codeRef = useRef(code);
    codeRef.current = code;

    useEffect(() => {
        const id = setTimeout(() => setDebouncedCode(code), RENDER_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [code]);

    // Publishes the diagram source as the student's current answer — mirrors
    // leia-workbench-frontend's MermaidViewerWidget.tsx.
    useEffect(() => {
        setSubmissionContent(code);
    }, [code, setSubmissionContent]);

    useEffect(() => {
        if (!debouncedCode.trim()) {
            setSvg("");
            setError("");
            return;
        }
        if (debouncedCode === lastRenderedRef.current) return;
        let cancelled = false;
        (async () => {
            try {
                initMermaidOnce();
                const safe = cleanMermaidCode(debouncedCode);
                const renderId = "mermaid-widget-" + Date.now();
                const { svg: rendered } = await mermaid.render(renderId, safe);
                if (cancelled) return;
                lastRenderedRef.current = debouncedCode;
                setSvg(fixSvgDimensions(rendered));
                setError("");
            } catch (e: unknown) {
                if (cancelled) return;
                lastRenderedRef.current = debouncedCode;
                setError(errorMessage(e));
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedCode]);

    useLukeTool(
        "mermaid_read",
        "Reads the Mermaid diagram source the student is currently drawing. Returns { code }. Use this to give feedback on their diagram in conversation — do NOT dictate the diagram content to them; ask questions and let them revise it themselves.",
        { type: "object", properties: {} },
        async () => ({ code: codeRef.current }),
    );

    const zoomBy = (delta: number) => setScale((s) => Math.max(0.15, Math.min(5, s + delta)));
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        zoomBy(e.deltaY > 0 ? -0.1 : 0.1);
    };
    const onMouseDown = (e: React.MouseEvent) => {
        isPanning.current = true;
        startPos.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isPanning.current) return;
        setPan({
            x: startPos.current.px + e.clientX - startPos.current.mx,
            y: startPos.current.py + e.clientY - startPos.current.my,
        });
    };
    const onMouseUp = () => {
        isPanning.current = false;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 360 }}>
            <div
                style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.2)",
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                    {params?.title ?? "UML Diagram"}
                </span>
                <div style={{ marginTop: 4, fontSize: 11, color: "#94a3b8" }}>
                    Write Mermaid syntax below — the preview updates as you type.
                </div>
            </div>

            <div style={{ height: "38%", minHeight: 140, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <Editor
                    height="100%"
                    defaultValue={code}
                    language="plaintext"
                    theme="vs-dark"
                    onChange={(value) => setCode(value ?? "")}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                    }}
                />
            </div>

            <div
                style={{
                    padding: "6px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                }}
            >
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Preview
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => zoomBy(-0.2)} style={btnStyle}>−</button>
                    <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 36, textAlign: "center" }}>
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={() => zoomBy(0.2)} style={btnStyle}>+</button>
                    <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} style={btnStyle}>⟳</button>
                </div>
            </div>

            <div
                className="leia-scrollbar"
                onWheel={handleWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                style={{ flex: 1, minHeight: 0, overflow: "auto", cursor: "grab", position: "relative", background: "rgba(0,0,0,0.15)" }}
            >
                {error ? (
                    <div style={{ padding: 16, fontSize: 12, color: "#fca5a5" }}>
                        <div>Error rendering diagram: {error}</div>
                        <details style={{ marginTop: 8 }}>
                            <summary style={{ cursor: "pointer", color: "#94a3b8" }}>Show failing code</summary>
                            <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "#cbd5e1" }}>{debouncedCode}</pre>
                        </details>
                    </div>
                ) : svg ? (
                    <div
                        style={{
                            display: "inline-block",
                            padding: 16,
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                            transformOrigin: "top left",
                        }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                ) : (
                    <div style={{ padding: 20, color: "#94a3b8", fontSize: 13 }}>
                        Start typing Mermaid syntax above (e.g. "classDiagram") to see it rendered here.
                    </div>
                )}
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    padding: "3px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.06)",
    color: "#e5e7eb",
    cursor: "pointer",
};
