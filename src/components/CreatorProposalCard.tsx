import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { CreatorProposal, DraftTarget } from "../lib/creatorCommands";

const labels: Record<DraftTarget, string> = {
  problem: "Problem", behaviour: "Behaviour", persona: "Persona", leia: "LEIA title",
};

const formatValue = (value: unknown): string => {
  if (value === undefined || value === "") return "Empty";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

export function CreatorProposalCard({ proposal, onApply, onRevise, onDiscard, disabled }: {
  proposal: CreatorProposal;
  onApply: () => void;
  onRevise: () => void;
  onDiscard: () => void;
  disabled: boolean;
}) {
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="Proposed draft changes"
      sx={{ borderLeft: 3, borderLeftColor: "primary.main", bgcolor: "background.paper", p: 1.5 }}
    >
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        Proposed draft changes
      </Typography>
      <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
        {proposal.changes.map(({ target, action, before, after, version, fields }) => (
          <Box component="li" key={target} sx={{ pt: 1, borderTop: 1, borderColor: "divider", overflowWrap: "anywhere" }}>
            <Typography variant="body2" fontWeight={600}>
              {target === "leia" ? labels[target] : `${action} ${labels[target]}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {before && before !== after ? <><del>{before}</del>{" → "}</> : null}{after}{version && ` (v${version})`}
            </Typography>
            {fields.map(({ field, before: previous, after: updated }) => {
              if (target === "behaviour" && field === "description" && typeof previous === "string" && typeof updated === "string" && updated.startsWith(`${previous}\n\n`)) {
                return (
                  <Typography key={field} variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                    {updated.slice(previous.length + 2)}
                  </Typography>
                );
              }
              const fieldLabel = field.replace(/([A-Z])/g, " $1").toLowerCase();
              return (
                <Box component="details" key={field} sx={{ mt: 0.35 }}>
                  <Typography component="summary" variant="body2" color="primary" sx={{ cursor: "pointer" }}>
                    {fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1)}
                  </Typography>
                  <Stack spacing={1} sx={{ py: 0.5, pl: 1.5 }}>
                    {(previous !== undefined ? [["Before", previous], ["After", updated]] as const : [["Proposed", updated]] as const).map(([label, value]) => (
                      <Box key={label}>
                        <Typography variant="caption" fontWeight={600}>{label}</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{formatValue(value)}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        ))}
      </Stack>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
        <Button size="small" variant="contained" disabled={disabled} onClick={onApply}>Apply changes</Button>
        <Button size="small" disabled={disabled} onClick={onRevise}>Ask for changes</Button>
        <Button size="small" color="inherit" disabled={disabled} onClick={onDiscard}>Discard</Button>
      </Stack>
    </Paper>
  );
}
