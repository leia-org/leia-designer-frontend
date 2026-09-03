import React, { useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import type { Persona, Problem, Behaviour, ProblemWidget } from "../models/Leia";
import { ProblemWidgetsEditor } from "./ProblemWidgetsEditor";
import { FormatPreview } from "./FormatPreview";
import { downloadProblemPdf } from "../lib/problemPdf";
//import type { unknown } from "zod";

type ResourceType = "persona" | "problem" | "behaviour";

type HighlightSegment = {
  text: string;
  highlight: boolean;
};

type ProblemEditorData = {
  solutionFormat?: unknown;
  solution?: unknown;
};

type EditableSpec = Record<string, unknown>;

type MermaidParser = {
  initialize: (config: { startOnLoad: boolean }) => void;
  parse: (text: string) => Promise<unknown>;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

let mermaidParserPromise: Promise<MermaidParser> | null = null;

//Handle errors
let numberOfErrors:number=0;


const loadMermaidParser = async (): Promise<MermaidParser> => {
  if (!mermaidParserPromise) {
    mermaidParserPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false });
      return mermaid as MermaidParser;
    });
  }

  return mermaidParserPromise;
};

const unwrapMermaidCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:mermaid)?\s*\r?\n([\s\S]*?)\r?\n?```\s*$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const extractMermaidSolution = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;

  const problemData = data as ProblemEditorData;
  if (problemData.solutionFormat !== "mermaid" || typeof problemData.solution !== "string") {
    return null;
  }

  const solution = unwrapMermaidCodeFence(problemData.solution);
  return solution.length > 0 ? solution : null;
};

const getMermaidErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Invalid Mermaid syntax";
};

const stripAvatar = (data: unknown): unknown => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const { avatar: _avatar, ...rest } = data as EditableSpec;
  return rest;
};

const restoreOriginalAvatar = (
  data: unknown,
  initialData?: Partial<Persona> | Partial<Problem> | Partial<Behaviour>,
): unknown => {
  const originalAvatar = (initialData?.spec as { avatar?: unknown } | undefined)
    ?.avatar;

  if (
    typeof originalAvatar !== "string" ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return data;
  }

  return {
    ...(data as EditableSpec),
    avatar: originalAvatar,
  };
};

const splitPlaceholderSegments = (text: string): HighlightSegment[] => {
  if (!text) return [];

  const segments: HighlightSegment[] = [];
  const expression = /\{\{[^}]+\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    segments.push({ text: match[0], highlight: true });
    lastIndex = expression.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false });
  }

  return segments.length ? segments : [{ text, highlight: false }];
};

type HighlightableInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className" | "color" | "value"
> & {
  value?: string | number | readonly string[];
};

const highlightTokenSx = {
  borderRadius: 0.5,
  bgcolor: "#F3E8FF",
  color: "#7E22CE",
};

const highlightableControlSx = {
  width: "100%",
  display: "block",
  boxSizing: "border-box",
  px: 1.5,
  py: 1,
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  bgcolor: "transparent",
  color: "transparent",
  caretColor: "primary.main",
  font: "inherit",
  lineHeight: 1.5,
  position: "relative",
  zIndex: 1,
  "&:focus": {
    outline: "none",
    borderColor: "primary.main",
    boxShadow: "0 0 0 2px rgba(37, 99, 235, 0.16)",
  },
};

const HighlightableInput: React.FC<HighlightableInputProps> = ({
  value,
  placeholder,
  ...rest
}) => {
  const normalizedValue =
    value === undefined || value === null
      ? ""
      : Array.isArray(value)
        ? value.join(", ")
        : String(value);
  const segments = useMemo(() => splitPlaceholderSegments(normalizedValue), [normalizedValue]);

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <Box
        component="input"
        {...rest}
        value={normalizedValue}
        placeholder={placeholder}
        sx={highlightableControlSx}
      />
      <Box
        aria-hidden="true"
        sx={{
          pointerEvents: "none",
          position: "absolute",
          inset: 1,
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          px: 1.5,
          py: 1,
          color: "text.primary",
          whiteSpace: "pre",
          borderRadius: 1,
          font: "inherit",
        }}
      >
        {normalizedValue.length === 0 ? (
          placeholder && <Box component="span" sx={{ color: "text.disabled" }}>{placeholder}</Box>
        ) : (
          segments.map((segment, index) => (
            <Box component="span" key={`${segment.text}-${index}`} sx={segment.highlight ? highlightTokenSx : undefined}>
              {segment.text}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

type HighlightableTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "color" | "value"
> & {
  value?: string | number | readonly string[];
};

const HighlightableTextarea: React.FC<HighlightableTextareaProps> = ({
  value,
  placeholder,
  onScroll,
  ...rest
}) => {
  const normalizedValue = value === undefined || value === null ? "" : String(value);
  const segments = useMemo(() => splitPlaceholderSegments(normalizedValue), [normalizedValue]);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleScroll: React.UIEventHandler<HTMLTextAreaElement> = (event) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = event.currentTarget.scrollTop;
      overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
    onScroll?.(event);
  };

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      <Box
        component="textarea"
        {...rest}
        value={normalizedValue}
        placeholder={placeholder}
        onScroll={handleScroll}
        sx={{
          ...highlightableControlSx,
          resize: "vertical",
        }}
      />
      <Box
        ref={overlayRef}
        aria-hidden="true"
        sx={{
          pointerEvents: "none",
          position: "absolute",
          inset: 1,
          zIndex: 0,
          overflow: "auto",
          px: 1.5,
          py: 1,
          color: "text.primary",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          borderRadius: 1,
          font: "inherit",
        }}
      >
        {normalizedValue.length === 0 ? (
          placeholder && <Box component="span" sx={{ color: "text.disabled" }}>{placeholder}</Box>
        ) : (
          segments.map((segment, index) => (
            <Box component="span" key={`${segment.text}-${index}`} sx={segment.highlight ? highlightTokenSx : undefined}>
              {segment.text}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box>
    <Typography variant="body2" fontWeight={600} sx={{ display: "block", mb: 0.75 }}>
      {label}
    </Typography>
    {children}
  </Box>
);

interface ResourceEditorProps {
  resourceType: ResourceType;
  initialData?: Partial<Persona> | Partial<Problem> | Partial<Behaviour>;
  apiVersion?: string;
  onSave: (data: any, apiVersion: string, resourceName: string) => void;
  onCancel: () => void;
}

export const ResourceEditor: React.FC<ResourceEditorProps> = ({
  resourceType,
  initialData,
  apiVersion = "v1",
  onSave,
  onCancel,
}) => {
  const [currentApiVersion, setCurrentApiVersion] = useState(apiVersion);
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");
  const [jsonContent, setJsonContent] = useState("");
  const [visualData, setVisualData] = useState<any>({});
  const [resourceName, setResourceName] = useState("");
  const [resourceNameError, setResourceNameError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const mermaidPreviewId = useRef(
    `resource-editor-mermaid-${Math.random().toString(36).slice(2)}`,
  ).current;
  const processOptions = [
    { value: "requirements-elicitation", label: "Requirements Elicitation" },
    { value: "game", label: "Game" },
    { value: "other", label: "Other" },
  ];

  const validateMermaidSyntax = async (data: unknown): Promise<string | null> => {
    const solution = extractMermaidSolution(data);
    if (!solution) return null;

    try {
      const mermaid = await loadMermaidParser();
      await mermaid.parse(solution);
      return null;
    } catch (error) {
      return getMermaidErrorMessage(error);
    }
  };

  useEffect(() => {
    setResourceName(initialData?.metadata?.name ?? "");
    setResourceNameError(null);
    

    if (initialData?.spec) {
      const editableSpec = stripAvatar(initialData.spec);
      setVisualData(editableSpec);
      setJsonContent(JSON.stringify(editableSpec, null, 2));
      return;
    }

    const emptySpec = (() => {
      switch (resourceType) {
        case "persona":
          return {
            fullName: "",
            firstName: "",
            description: "",
            personality: "",
            subjectPronoum: "",
            objectPronoum: "",
            possesivePronoum: "",
            possesiveAdjective: "",
          };
        case "problem":
          return {
            description: "",
            personaBackground: "",
            details: "",
            solution: "",
            initialSolution: "",
            solutionFormat: "text",
            evaluationPrompt: "",
            process: [],
            extends: {},
            overrides: {},
            constrainedTo: {},
          };
        case "behaviour":
          return { description: "", role: "", process: [], tooltip: "" };
        default:
          return {};
      }
    })();

    setVisualData(emptySpec);
    setJsonContent(JSON.stringify(emptySpec, null, 2));
  }, [initialData, resourceType]);

  useEffect(() => {
    if (activeTab === "code") {
      setJsonContent(JSON.stringify(stripAvatar(visualData), null, 2));
    }
  }, [activeTab, visualData]);

  useEffect(() => {
    if (resourceType !== "problem") {
      setMermaidError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void validateMermaidSyntax({
        solutionFormat: visualData?.solutionFormat,
        solution: visualData?.solution,
      }).then((error) => {
        if (!cancelled) setMermaidError(error);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [resourceType, visualData?.solutionFormat, visualData?.solution]);

  useEffect(() => {
    const solution = extractMermaidSolution({
      solutionFormat: visualData?.solutionFormat,
      solution: visualData?.solution,
    });
    if (resourceType !== "problem" || !solution) {
      setMermaidSvg(null);
      return;
    }

    let cancelled = false;
    void loadMermaidParser()
      .then((mermaid) => mermaid.render(mermaidPreviewId, solution))
      .then(({ svg }) => {
        if (!cancelled) setMermaidSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setMermaidSvg(null);
      });

    return () => {
      cancelled = true;
    };
  }, [mermaidPreviewId, resourceType, visualData?.solutionFormat, visualData?.solution]);

  const handleVisualChange = (field: string, value: any) => {
    setVisualData((previous: any) => ({ ...previous, [field]: value }));
  };



  const checkForSolutionFormatField= (solutionFormat:string)=>{

    const validSolutionFormatValues:Array<string>=['text', 'mermaid', 'yaml', 'markdown', 'html', 'json', 'xml'];

    if(!validSolutionFormatValues.includes(solutionFormat) || solutionFormat==='') return true;
    return false;
  }

  const checkForProcessField= (process:string[])=>{

    if((process!.includes('other') && process!.length>1)
        || process?.filter(p=>!process.includes(p)).length>0
        || process?.length!<1) return true;
    return false;
  }

  const checkForEmptyField =(field:string)=>{
    if(field==='') return true;
    return false;
  }
   
  const checkDatatoSave=(dataToSave:Object)=>{
    for (const [key, value] of Object.entries(dataToSave)){
      if(key=='process' && checkForProcessField(value)) {
        numberOfErrors=numberOfErrors+1;
        continue;}
      if(key==='solutionFormat' &&checkForSolutionFormatField(value)) {
        numberOfErrors=numberOfErrors+1;
        continue;}

      if(checkForEmptyField(value)) numberOfErrors=numberOfErrors+1;
        
  }
}

  

  

 

  const handleJsonChange = (value: string | undefined) => {
    setJsonContent(value || "");
    setJsonError(null);

    try {
      if (value) {
        const parsed = stripAvatar(JSON.parse(value));
        setVisualData(parsed);
      }
    } catch {
      setJsonError("Invalid JSON format");
      setMermaidError(null);
    }
  };

  const handleSave = async () => {

    numberOfErrors=0;
    
    
    


    const normalizedResourceName = resourceName.trim();
    if (!normalizedResourceName) {
      setResourceNameError("Resource name is required");
      return;
    }

    let dataToSave: unknown = visualData;

    if (activeTab === "code") {
      try {
        const parsed = stripAvatar(JSON.parse(jsonContent));
        dataToSave = parsed;
      } catch {
        setJsonError("Cannot save: Invalid JSON format");
        return;
      }
    }

    checkDatatoSave(dataToSave!);

    if (resourceType === "problem") {
      const solution = extractMermaidSolution(dataToSave);
      if (solution && dataToSave && typeof dataToSave === "object" && !Array.isArray(dataToSave)) {
        dataToSave = { ...(dataToSave as Record<string, unknown>), solution };
      }
      const validationError = await validateMermaidSyntax(dataToSave);
      setMermaidError(validationError);
      if (validationError) return;
    }

    
    if(numberOfErrors!==0) return;

    onSave(
      restoreOriginalAvatar(stripAvatar(dataToSave), initialData),
      currentApiVersion,
      normalizedResourceName,
    );
  };

  const renderPersonaForm = () => (
    <Stack spacing={2} sx={{ p: 2, maxHeight: 400, overflowY: "auto" }}>
      <Field label="Full Name">
        <HighlightableInput
          type="text"
          value={visualData.fullName || ""}
          onChange={(event) => handleVisualChange("fullName", event.target.value)}
          placeholder="e.g., Dr. Alice Johnson"
        />
        {checkForEmptyField(visualData.fullName || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      
      <Field label="First Name">
        <HighlightableInput
          type="text"
          value={visualData.firstName || ""}
          onChange={(event) => handleVisualChange("firstName", event.target.value)}
          placeholder="e.g., Alice"
        />
        {checkForEmptyField(visualData.firstName || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      
      <Field label="Description">
        <HighlightableTextarea
          value={visualData.description || ""}
          onChange={(event) => handleVisualChange("description", event.target.value)}
          rows={3}
          placeholder="Describe the persona..."
        />
        {checkForEmptyField(visualData.description) && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Personality">
        <HighlightableTextarea
          value={visualData.personality || ""}
          onChange={(event) => handleVisualChange("personality", event.target.value)}
          rows={3}
          placeholder="Describe personality traits..."
        />
        {checkForEmptyField(visualData.personality || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Field label="Subject Pronoun">
          <HighlightableInput
            type="text"
            value={visualData.subjectPronoum || ""}
            onChange={(event) => handleVisualChange("subjectPronoum", event.target.value)}
            placeholder="e.g., she, he, they"
          />
          {checkForEmptyField(visualData.subjectPronoum || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
        </Field>
        <Field label="Object Pronoun">
          <HighlightableInput
            type="text"
            value={visualData.objectPronoum || ""}
            onChange={(event) => handleVisualChange("objectPronoum", event.target.value)}
            placeholder="e.g., her, him, them"
          />
          {checkForEmptyField(visualData.objectPronoum || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
        </Field>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        <Field label="Possessive Pronoun">
          <HighlightableInput
            type="text"
            value={visualData.possesivePronoum || ""}
            onChange={(event) => handleVisualChange("possesivePronoum", event.target.value)}
            placeholder="e.g., hers, his, theirs"
          />
          {checkForEmptyField(visualData.possesivePronoum || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
        </Field>
        <Field label="Possessive Adjective">
          <HighlightableInput
            type="text"
            value={visualData.possesiveAdjective || ""}
            onChange={(event) => handleVisualChange("possesiveAdjective", event.target.value)}
            placeholder="e.g., her, his, their"
          />
          {checkForEmptyField(visualData.possesiveAdjective || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
        </Field>
      </Box>
    </Stack>
  );

  const renderProcessCheckboxes = () => (
    <Stack spacing={0.25}>
      {processOptions.map(({ value, label }) => {
        const currentProcess: string[] = visualData.process || [];
        const isChecked = currentProcess.includes(value);
        const hasOther = currentProcess.includes("other");
        const disabled = !isChecked && ((value === "other" && currentProcess.length > 0) || (value !== "other" && hasOther));

        return (
          <FormControlLabel
            key={value}
            disabled={disabled}
            control={
              <Checkbox
                size="small"
                checked={isChecked}
                onChange={(event) => {
                  if (event.target.checked) {
                    handleVisualChange("process", value === "other" ? ["other"] : [...currentProcess, value]);
                    return;
                  }
                  handleVisualChange("process", currentProcess.filter((process) => process !== value));
                }}
              />
            }
            label={<Typography variant="body2">{label}</Typography>}
            sx={{ m: 0 }}
          />
        );
      })}
    </Stack>
  );

  const renderProblemForm = () => (
    <Stack spacing={2} sx={{ p: 2, maxHeight: 400, overflowY: "auto" }}>
      <Field label="Description">
        <HighlightableTextarea
          value={visualData.description || ""}
          onChange={(event) => handleVisualChange("description", event.target.value)}
          rows={3}
          placeholder="Describe the problem..."
        />
        {checkForEmptyField(visualData.description || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Persona Background">
        <HighlightableTextarea
          value={visualData.personaBackground || ""}
          onChange={(event) => handleVisualChange("personaBackground", event.target.value)}
          rows={2}
          placeholder="Background context for the persona..."
        />
        {checkForEmptyField(visualData.personaBackground || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Details">
        <HighlightableTextarea
          value={visualData.details || ""}
          onChange={(event) => handleVisualChange("details", event.target.value)}
          rows={3}
          placeholder="Additional details..."
        />
        {checkForEmptyField(visualData.details || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Solution">
        <HighlightableTextarea
          value={visualData.solution || ""}
          onChange={(event) => handleVisualChange("solution", event.target.value)}
          rows={3}
          placeholder="Expected solution..."
        />
        {visualData.solutionFormat === "mermaid" && extractMermaidSolution(visualData) && (
          <Box sx={{ mt: 1.5, height: 280, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
            <FormatPreview
              code={extractMermaidSolution(visualData) || ""}
              format="mermaid"
              mermaidSvg={mermaidSvg}
              error={mermaidError}
            />
          </Box>
        )}
        {checkForEmptyField(visualData.solution || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Initial Solution">
        <HighlightableTextarea
          value={visualData.initialSolution || ""}
          onChange={(event) => handleVisualChange("initialSolution", event.target.value)}
          rows={3}
          placeholder="Initial Solution..."
        />
        {checkForEmptyField(visualData.initialSolution || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <TextField
        select
        label="Solution Format"
        value={visualData.solutionFormat || "text"}
        onChange={(event) => handleVisualChange("solutionFormat", event.target.value)}
        fullWidth
      >
        <MenuItem value="text">Plain Text</MenuItem>
        <MenuItem value="mermaid">Mermaid Diagram</MenuItem>
        <MenuItem value="yaml">YAML</MenuItem>
        <MenuItem value="markdown">Markdown</MenuItem>
        <MenuItem value="html">HTML</MenuItem>
        <MenuItem value="json">JSON</MenuItem>
        <MenuItem value="xml">XML</MenuItem>
      </TextField>
      {checkForSolutionFormatField(visualData.solutionFormat || "") && <Alert severity="error" sx={{width:'fit-content'}}>Incorrect value</Alert>}
      <Field label="Evaluation Prompt">
        <HighlightableTextarea
          value={visualData.evaluationPrompt || ""}
          onChange={(event) => handleVisualChange("evaluationPrompt", event.target.value)}
          rows={2}
          placeholder="Prompt for evaluating the solution..."
        />
        {checkForEmptyField(visualData.evaluationPrompt || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Process">{renderProcessCheckboxes()}</Field>
      {checkForProcessField(visualData.process || []) && <Alert severity="error" sx={{width:'fit-content'}}>Incorrect value</Alert>}
      
      <ProblemWidgetsEditor
        widgets={(visualData.widgets as ProblemWidget[]) ?? []}
        onChange={(widgets) => handleVisualChange("widgets", widgets.length > 0 ? widgets : undefined)}
      />
    </Stack>
  );

  const renderBehaviourForm = () => (
    <Stack spacing={2} sx={{ p: 2, maxHeight: 400, overflowY: "auto" }}>
      <Field label="Description">
        <HighlightableTextarea
          value={visualData.description || ""}
          onChange={(event) => handleVisualChange("description", event.target.value)}
          rows={3}
          placeholder="Describe the behaviour..."
        />
        {checkForEmptyField(visualData.description || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Role">
        <HighlightableInput
          type="text"
          value={visualData.role || ""}
          onChange={(event) => handleVisualChange("role", event.target.value)}
          placeholder="e.g., Facilitator"
        />
        {checkForEmptyField(visualData.role || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Tooltip">
        <HighlightableTextarea
          value={visualData.tooltip || ""}
          onChange={(event) => handleVisualChange("tooltip", event.target.value)}
          rows={2}
          placeholder="Tooltip text for this behaviour..."
        />
        {checkForEmptyField(visualData.tooltip || "") && <Alert severity="error" sx={{width:'fit-content'}}>Empty field</Alert>}
      </Field>
      <Field label="Process">{renderProcessCheckboxes()}</Field>
      {checkForProcessField(visualData.process || []) && <Alert severity="error" sx={{width:'fit-content'}}>Incorrect value</Alert>}
    </Stack>
  );

  const renderForm = () => {
    switch (resourceType) {
      case "persona":
        return renderPersonaForm();
      case "problem":
        return renderProblemForm();
      case "behaviour":
        return renderBehaviourForm();
      default:
        return null;
    }
  };

  const resourceLabel = `${resourceType.charAt(0).toUpperCase()}${resourceType.slice(1)}`;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
          sx={{ pb: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Typography variant="h6">Edit {resourceLabel}</Typography>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            {resourceType === "problem" && (
              <Button
                type="button"
                color="inherit"
                variant="outlined"
                size="small"
                startIcon={<DownloadOutlinedIcon />}
                title="Download the problem statement (boletín) as a PDF"
                onClick={() => downloadProblemPdf(visualData, resourceName.trim() || "Problem")}
              >
                PDF
              </Button>
            )}
            <TextField
              select
              label="API Version"
              value={currentApiVersion}
              onChange={(event) => setCurrentApiVersion(event.target.value)}
              size="small"
              sx={{ minWidth: 128 }}
            >
              <MenuItem value="v1">v1</MenuItem>
            </TextField>
          </Stack>
        </Stack>

        <Box>
          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label="Resource editor mode">
            <Tab value="visual" label="Visual Editor" />
            <Tab value="code" label="Code Editor" />
          </Tabs>
          {activeTab === "visual" && (
            <Stack spacing={2} sx={{ pt: 2 }}>
              <TextField
                required
                label={`${resourceLabel} name`}
                value={resourceName}
                onChange={(event) => {
                  setResourceName(event.target.value);
                  if (resourceNameError) setResourceNameError(null);
                }}
                error={Boolean(resourceNameError)}
                helperText={resourceNameError || "Used to identify this resource in the LEIA library."}
                fullWidth
              />
              {renderForm()}
            </Stack>
          )}
          {activeTab === "code" && (
            <Box sx={{ pt: 2 }}>
              <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                <Editor
                  height="400px"
                  language="json"
                  theme="vs-light"
                  value={jsonContent}
                  onChange={handleJsonChange}
                  options={{
                    readOnly: false,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineNumbers: "on",
                    glyphMargin: false,
                    folding: true,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 3,
                    automaticLayout: true,
                    contextmenu: false,
                    scrollbar: { vertical: "auto", horizontal: "auto", handleMouseWheel: true },
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                    wordWrap: "on",
                  }}
                />
              </Paper>
              {jsonError && <Alert severity="error" sx={{ mt: 1 }}>{jsonError}</Alert>}
              {!jsonError && resourceType === "problem" && extractMermaidSolution(visualData) && (
                <Box sx={{ mt: 1.5, height: 280, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <FormatPreview
                    code={extractMermaidSolution(visualData) || ""}
                    format="mermaid"
                    mermaidSvg={mermaidSvg}
                    error={mermaidError}
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Button color="inherit" onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={jsonError !== null || mermaidError !== null}>
            Save
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
};
