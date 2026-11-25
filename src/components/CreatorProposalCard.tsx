import { useId } from "react";
import AddIcon from "@mui/icons-material/Add";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckIcon from "@mui/icons-material/Check";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import TitleIcon from "@mui/icons-material/Title";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { CreatorProposal, DraftTarget } from "../lib/creatorCommands";

const resources = {
  problem: { label: "Problem", Icon: ArticleOutlinedIcon },
  behaviour: { label: "Behaviour", Icon: PsychologyOutlinedIcon },
  persona: { label: "Persona", Icon: PersonOutlineIcon },
  rubric: { label: "Rubric", Icon: FactCheckOutlinedIcon },
  leia: { label: "LEIA title", Icon: TitleIcon },
} satisfies Record<DraftTarget, { label: string; Icon: typeof ArticleOutlinedIcon }>;

const formatValue = (value: unknown): string => {
  if (value === undefined || value === "") return "Empty";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

function FieldComparison({ field, before, after }: CreatorProposal["changes"][number]["fields"][number]) {
  const name = field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const values: [string, unknown][] = before === undefined ? [["Proposed", after]] : [["Before", before], ["After", after]];

  return (
    <Box
      component="details"
      sx={{ "&[open] .proposal-field-chevron": { transform: "rotate(90deg)" } }}
    >
      <Typography
        component="summary"
        variant="body2"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          minHeight: 28,
          maxWidth: "100%",
          width: "fit-content",
          pr: 0.75,
          borderRadius: 0.5,
          color: "text.secondary",
          listStyle: "none",
          cursor: "pointer",
          "&::-webkit-details-marker": { display: "none" },
          "&:hover": { color: "text.primary", bgcolor: "action.hover" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        <ChevronRightIcon className="proposal-field-chevron" sx={{ fontSize: 17, flex: "0 0 auto" }} />
        {label}
      </Typography>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 0.5,
          mb: 1,
          bgcolor: "surfaces.subtle",
          borderRadius: 1,
          "& > div + div": { borderTop: 1, borderColor: "divider" },
        }}
      >
        {values.map(([caption, value]) => (
          <Box key={caption} sx={{ px: 1.25, py: 1 }}>
            <Typography component="dt" variant="caption" fontWeight={700}>{caption}</Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
              {formatValue(value)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function CreatorProposalCard({ proposal, onApply, onRevise, onDiscard, disabled }: {
  proposal: CreatorProposal;
  onApply: () => void;
  onRevise: () => void;
  onDiscard: () => void;
  disabled: boolean;
}) {
  const titleId = useId();

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={titleId}
      sx={{ minWidth: 0, containerType: "inline-size" }}
    >
      <Stack
        component="header"
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.75, py: 1.25, bgcolor: "surfaces.subtle", borderRadius: "inherit", borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
      >
        <RateReviewOutlinedIcon sx={{ fontSize: 19, color: "text.secondary" }} />
        <Typography id={titleId} variant="subtitle2" component="h3" fontWeight={700}>
          Proposed draft changes
        </Typography>
      </Stack>

      <Box
        component="ul"
        sx={{ listStyle: "none", m: 0, p: 0, "& > li": { borderTop: 1, borderColor: "divider" } }}
      >
        {proposal.changes.map(({ target, action, before, after, version, reason, fields }) => {
          const { label, Icon } = resources[target];

          return (
            <Box
              component="li"
              key={target}
              sx={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", gap: 1, px: 1.75, py: 1.25, overflowWrap: "anywhere" }}
            >
              <Icon sx={{ fontSize: 18, mt: 0.1, color: "text.secondary" }} />
              <Box>
                <Typography component="h4" variant="body2" fontWeight={700}>
                  {target === "leia" ? label : `${action} ${label}`}
                </Typography>
                <Typography component="p" variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {before && before !== after ? (
                    <>
                      <del>{before}</del>{" "}
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.5, maxWidth: "100%", verticalAlign: "top" }}>
                        <ArrowForwardIcon sx={{ fontSize: 13, flexShrink: 0, alignSelf: "center" }} />
                        <Box component="span" sx={{ color: "text.primary", minWidth: 0 }}>{after}</Box>
                      </Box>
                    </>
                  ) : after}
                  {version && ` (v${version})`}
                </Typography>
                {reason && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{reason}</Typography>}
                {fields.length > 0 && (
                  <Box sx={{ mt: 0.75 }}>
                    {fields.map(({ field, before: previous, after: updated }) => {
                      if (target === "behaviour" && field === "description" && typeof previous === "string" && typeof updated === "string" && updated.startsWith(`${previous}\n\n`)) {
                        return (
                          <Box
                            key={field}
                            sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, px: 1, py: 0.75, bgcolor: "surfaces.subtle", borderRadius: 1 }}
                          >
                            <AddIcon sx={{ fontSize: 16, mt: 0.2, color: "success.dark" }} titleAccess="Added instruction" />
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
                              {updated.slice(previous.length + 2)}
                            </Typography>
                          </Box>
                        );
                      }

                      return <FieldComparison key={field} field={field} before={previous} after={updated} />;
                    })}
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box
        component="footer"
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 0.5,
          borderTop: 1,
          borderColor: "divider",
          px: 1.25,
          py: 1,
          "& .MuiButton-root": { whiteSpace: "nowrap", minHeight: 32 },
          "& .MuiButton-root:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          "@container (max-width: 339px)": {
            "& .proposal-apply": { flexBasis: "100%", mt: 0.25 },
          },
        }}
      >
        <Button size="small" color="inherit" disabled={disabled} onClick={onDiscard} sx={{ mr: "auto", color: "text.secondary" }}>
          Discard
        </Button>
        <Button size="small" color="inherit" disabled={disabled} onClick={onRevise}>
          Ask for changes
        </Button>
        <Button className="proposal-apply" size="small" variant="contained" disabled={disabled} onClick={onApply} startIcon={<CheckIcon />}>
          Apply changes
        </Button>
      </Box>
    </Paper>
  );
}
