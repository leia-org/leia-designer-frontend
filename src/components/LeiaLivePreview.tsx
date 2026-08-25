import type React from "react";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import type { Behaviour, Persona, Problem } from "../models/Leia";
import type { RubricDefinition } from "../models/Rubric";
import { parseRubricMarkdown } from "../lib/rubrics";

interface GeneratedLeiaPreview {
  spec?: {
    persona?: Persona;
    problem?: Problem;
    behaviour?: Behaviour;
  };
}

interface LeiaLivePreviewProps {
  leia: GeneratedLeiaPreview | null;
  rubric: RubricDefinition | null;
  title: string;
  onTitleChange: (value: string) => void;
  titleSuggested?: boolean;
  testAction: React.ReactNode;
  onComponentClick?: (component: "persona" | "behaviour" | "problem" | "rubric") => void;
}

interface PreviewSectionProps {
  accent: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const truncate = (value?: string, length = 240) => {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;
};

const initialsOf = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const PreviewSection: React.FC<PreviewSectionProps> = ({
  accent,
  icon,
  title,
  subtitle,
  children,
  onClick,
}) => (
  <Paper
    variant="outlined"
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={(event) => {
      if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      onClick();
    }}
    sx={{
      borderRadius: 2,
      overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      transition: onClick ? "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease" : undefined,
      "&:hover": onClick
        ? { borderColor: "primary.main", boxShadow: "0 5px 16px rgba(15, 23, 42, 0.08)", transform: "translateY(-1px)" }
        : undefined,
      "&:focus-visible": onClick
        ? { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 }
        : undefined,
    }}
  >
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{ px: 1.5, py: 1.25, bgcolor: "surfaces.subtle", borderBottom: 1, borderColor: "divider" }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          bgcolor: accent,
          color: "common.white",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{title}</Typography>
        {subtitle && (
          <Typography noWrap sx={{ fontSize: 10, color: "text.disabled", fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
    <Box sx={{ p: 1.5 }}>{children}</Box>
  </Paper>
);

const EmptySection: React.FC = () => (
  <Typography variant="body2" color="text.disabled" fontStyle="italic">
    Waiting for the assistant to create this component.
  </Typography>
);

export const LeiaLivePreview: React.FC<LeiaLivePreviewProps> = ({
  leia,
  rubric,
  title,
  onTitleChange,
  titleSuggested = false,
  testAction,
  onComponentClick,
}) => {
  const persona = leia?.spec?.persona;
  const problem = leia?.spec?.problem;
  const behaviour = leia?.spec?.behaviour;
  const displayName = title || persona?.spec?.fullName || "Untitled LEIA";
  const isReady = Boolean(persona && problem && behaviour);
  const widgetCount = problem?.spec?.widgets?.length ?? 0;
  const parsedRubric = rubric ? parseRubricMarkdown(rubric.spec.markdown).rubric : null;
  const rubricCriteriaCount = parsedRubric?.sections.reduce(
    (total, section) => total + section.rows.length,
    0,
  ) ?? 0;
  const rubricWeightingLabel = parsedRubric?.weightingMode === "equal"
    ? "Equal weights"
    : parsedRubric?.weightingMode === "mixed"
      ? "Mixed weights"
      : "Explicit weights";

  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Avatar sx={{ width: 46, height: 46, bgcolor: "primary.main", fontSize: 15, fontWeight: 700 }}>
          {initialsOf(displayName)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="overline" color="text.secondary">Workbench preview</Typography>
            <Chip label={isReady ? "Ready to test" : "Draft"} size="small" color={isReady ? "success" : "default"} variant={isReady ? "filled" : "outlined"} />
          </Stack>
          <TextField
            variant="standard"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Untitled LEIA"
            fullWidth
            inputProps={{ "aria-label": "LEIA title" }}
            helperText={titleSuggested ? "Suggested by the assistant" : undefined}
            sx={{
              mt: -0.25,
              "& .MuiInputBase-input": { fontSize: 17, fontWeight: 700, letterSpacing: "-0.015em", py: 0.25 },
              "& .MuiFormHelperText-root": { ml: 0, mt: 0.5, fontSize: 10 },
            }}
          />
        </Box>
      </Stack>

      <Box sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography sx={{ display: "inline-flex", py: 1, borderBottom: 2, borderColor: "primary.main", fontSize: 12, fontWeight: 700 }}>
          Overview
        </Typography>
      </Box>

      <Stack
        spacing={1.5}
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", p: 1.5 }}
      >
        <PreviewSection
          accent="#7C3AED"
          icon={<PersonOutlineIcon sx={{ fontSize: 17 }} />}
          title="Persona"
          subtitle={persona?.metadata?.name}
          onClick={persona ? () => onComponentClick?.("persona") : undefined}
        >
          {persona ? (
            <Stack spacing={1}>
              <Typography variant="body2" fontWeight={700}>{persona.spec.fullName || persona.metadata.name}</Typography>
              {persona.spec.personality && <Typography variant="caption" color="text.secondary">{truncate(persona.spec.personality, 120)}</Typography>}
              {persona.spec.description && <Typography variant="body2" color="text.secondary">{truncate(persona.spec.description, 180)}</Typography>}
            </Stack>
          ) : <EmptySection />}
        </PreviewSection>

        <PreviewSection
          accent="#0EA5E9"
          icon={<PsychologyOutlinedIcon sx={{ fontSize: 17 }} />}
          title="Behaviour"
          subtitle={behaviour?.metadata?.name}
          onClick={behaviour ? () => onComponentClick?.("behaviour") : undefined}
        >
          {behaviour ? (
            <Stack spacing={1}>
              {behaviour.spec.role && <Typography variant="body2" fontWeight={700}>{behaviour.spec.role}</Typography>}
              {behaviour.spec.process?.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {behaviour.spec.process.map((process) => <Chip key={process} label={process} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "surfaces.subtle" }} />)}
                </Stack>
              )}
              {behaviour.spec.description && <Typography variant="body2" color="text.secondary">{truncate(behaviour.spec.description, 180)}</Typography>}
            </Stack>
          ) : <EmptySection />}
        </PreviewSection>

        <PreviewSection
          accent="#16A34A"
          icon={<ExtensionOutlinedIcon sx={{ fontSize: 17 }} />}
          title="Problem"
          subtitle={problem?.metadata?.name}
          onClick={problem ? () => onComponentClick?.("problem") : undefined}
        >
          {problem ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {problem.spec.solutionFormat && <Chip label={problem.spec.solutionFormat} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "surfaces.accent", color: "primary.dark" }} />}
                {widgetCount > 0 && <Chip label={`${widgetCount} ${widgetCount === 1 ? "widget" : "widgets"}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: "surfaces.subtle" }} />}
              </Stack>
              {problem.spec.description && <Typography variant="body2" color="text.secondary">{truncate(problem.spec.description, 220)}</Typography>}
              {problem.spec.details && <Typography variant="caption" color="text.secondary">{truncate(problem.spec.details, 140)}</Typography>}
            </Stack>
          ) : <EmptySection />}
        </PreviewSection>

        <PreviewSection
          accent="#D97706"
          icon={<FactCheckOutlinedIcon sx={{ fontSize: 17 }} />}
          title="Rubric"
          subtitle={rubric?.metadata.name}
          onClick={rubric ? () => onComponentClick?.("rubric") : undefined}
        >
          {rubric ? (
            <Stack spacing={1}>
              {parsedRubric ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={`${parsedRubric.sections.length} ${parsedRubric.sections.length === 1 ? "section" : "sections"}`}
                    size="small"
                    sx={{ height: 20, fontSize: 10, bgcolor: "surfaces.subtle" }}
                  />
                  <Chip
                    label={`${rubricCriteriaCount} ${rubricCriteriaCount === 1 ? "criterion" : "criteria"}`}
                    size="small"
                    sx={{ height: 20, fontSize: 10, bgcolor: "surfaces.subtle" }}
                  />
                  <Chip
                    label={rubricWeightingLabel}
                    size="small"
                    sx={{ height: 20, fontSize: 10, bgcolor: "surfaces.accent", color: "primary.dark" }}
                  />
                </Stack>
              ) : (
                <Typography variant="body2" color="error.main">Invalid rubric Markdown</Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Click to edit the Markdown and open the rendered preview.
              </Typography>
            </Stack>
          ) : <EmptySection />}
        </PreviewSection>
      </Stack>

      <Divider />
      <Box sx={{ p: 1.5 }}>{testAction}</Box>
    </Paper>
  );
};

export default LeiaLivePreview;
