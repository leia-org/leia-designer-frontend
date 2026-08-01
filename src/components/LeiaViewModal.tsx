import type React from "react";
import { lazy, memo, Suspense, useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { Leia } from "../models/Leia";
import { useAuth } from "../context/useAuth";

const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({ default: module.Prism })),
);

const LoadingCode = ({ label = "Loading..." }: { label?: string }) => (
  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}>
    <CircularProgress size={18} />
    <Typography variant="body2" color="text.secondary">{label}</Typography>
  </Stack>
);

const LazyCodeBlock: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [prismStyle, setPrismStyle] = useState<object | null>(null);

  useEffect(() => {
    void import("react-syntax-highlighter/dist/esm/styles/prism").then((styles) => {
      setPrismStyle(styles.oneLight);
    });
  }, []);

  if (!prismStyle) return <LoadingCode />;

  return (
    <SyntaxHighlighter
      language={language}
      style={prismStyle}
      showLineNumbers
      wrapLines
      customStyle={{ borderRadius: "8px", fontSize: "14px", lineHeight: "1.5", margin: 0 }}
    >
      {code}
    </SyntaxHighlighter>
  );
};

const ContentSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Stack spacing={1}>
    <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
    <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "surfaces.subtle", border: "1px solid", borderColor: "divider" }}>
      {children}
    </Box>
  </Stack>
);

interface LeiaViewModalProps {
  leia: Leia | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LeiaViewModal: React.FC<LeiaViewModalProps> = memo(({ leia, isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState<"problem" | "persona" | "behaviour">("problem");
  const { user } = useAuth();

  useEffect(() => {
    if (leia?.id) setViewMode("problem");
  }, [leia?.id]);

  if (!isOpen || !leia) return null;

  const problem = leia.spec?.problem?.spec;
  const persona = leia.spec?.persona?.spec;
  const behaviour = leia.spec?.behaviour?.spec;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      sx={{ "& .MuiDialog-paper": { height: { xs: "92vh", md: "80vh" }, maxHeight: "none" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" noWrap>{leia.metadata?.name || `LEIA ${leia.id}`}</Typography>
          <Typography variant="body2" color="text.secondary">View LEIA content</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs
        value={viewMode}
        onChange={(_, value: "problem" | "persona" | "behaviour") => setViewMode(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ px: 2, borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab value="problem" label="Problem" />
        <Tab value="persona" label="Persona" />
        {user?.role === "admin" && <Tab value="behaviour" label="Behaviour" />}
      </Tabs>
      <DialogContent sx={{ py: 3, display: "flex", flexDirection: "column" }}>
        {viewMode === "problem" && (
          <Stack spacing={2.5}>
            <ContentSection title="Problem Description">
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {problem?.description || "No description available"}
              </Typography>
            </ContentSection>
            {problem?.details && (
              <ContentSection title="Details">
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{problem.details}</Typography>
              </ContentSection>
            )}
            {problem?.solution && (
              <ContentSection title="Solution">
                <Suspense fallback={<LoadingCode label="Loading syntax highlighter..." />}>
                  <LazyCodeBlock code={problem.solution} language={problem.solutionFormat} />
                </Suspense>
              </ContentSection>
            )}
            {problem?.initialSolution && (
              <ContentSection title="Initial Solution">
                <Suspense fallback={<LoadingCode label="Loading syntax highlighter..." />}>
                  <LazyCodeBlock code={problem.initialSolution} language={problem.solutionFormat} />
                </Suspense>
              </ContentSection>
            )}
            {problem?.evaluationPrompt && (
              <ContentSection title="Evaluation Prompt">
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{problem.evaluationPrompt}</Typography>
              </ContentSection>
            )}
            {problem?.process && (
              <ContentSection title="Process">
                <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                  {problem.process.map((step, index) => <Typography component="li" variant="body2" key={`${step}-${index}`} sx={{ mb: 0.75 }}>{step}</Typography>)}
                </Box>
              </ContentSection>
            )}
          </Stack>
        )}

        {viewMode === "persona" && (
          <Stack spacing={2.5}>
            <ContentSection title="Persona Information">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2 }}>
                <Box><Typography variant="overline">Full Name</Typography><Typography variant="body2">{persona?.fullName || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">First Name</Typography><Typography variant="body2">{persona?.firstName || "N/A"}</Typography></Box>
              </Box>
            </ContentSection>
            {persona?.description && <ContentSection title="Description"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{persona.description}</Typography></ContentSection>}
            {persona?.personality && <ContentSection title="Personality"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{persona.personality}</Typography></ContentSection>}
            <ContentSection title="Pronouns">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2 }}>
                <Box><Typography variant="overline">Subject</Typography><Typography variant="body2">{persona?.subjectPronoum || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">Object</Typography><Typography variant="body2">{persona?.objectPronoum || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">Possessive</Typography><Typography variant="body2">{persona?.possesivePronoum || "N/A"}</Typography></Box>
                <Box><Typography variant="overline">Possessive Adj.</Typography><Typography variant="body2">{persona?.possesiveAdjective || "N/A"}</Typography></Box>
              </Box>
            </ContentSection>
          </Stack>
        )}

        {viewMode === "behaviour" && user?.role === "admin" && (
          <Stack spacing={2.5}>
            <ContentSection title="Behaviour Configuration">
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{behaviour?.description || "No description available"}</Typography>
            </ContentSection>
            {behaviour?.role && <ContentSection title="Role"><Typography variant="body2">{behaviour.role}</Typography></ContentSection>}
            {behaviour?.process && (
              <ContentSection title="Process">
                <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                  {behaviour.process.map((step, index) => <Typography component="li" variant="body2" key={`${step}-${index}`} sx={{ mb: 0.75 }}>{step}</Typography>)}
                </Box>
              </ContentSection>
            )}
            {behaviour?.tooltip && <ContentSection title="Initial Tooltip"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{behaviour.tooltip}</Typography></ContentSection>}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
});
