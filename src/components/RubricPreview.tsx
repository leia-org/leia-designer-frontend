import { Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import type { RubricSpec } from "../models/Rubric";

const formatWeight = (weight: number) => Number.isInteger(weight) ? String(weight) : weight.toFixed(1);

export function RubricPreview({ spec }: { spec: RubricSpec }) {
  return <Stack spacing={2.5}>{spec.sections.map((section, sectionIndex) => {
    const descriptors = (criterionIndex: number) => new Map(section.criteria[criterionIndex].descriptors.map((item) => [item.level, item.description]));
    return <Box key={`${section.title}-${sectionIndex}`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: 2, py: 1.25, bgcolor: "surfaces.subtle" }}>
        <Typography variant="subtitle2" fontWeight={700}>{section.title}</Typography><Chip size="small" color="primary" label={`${formatWeight(section.weight)}%`} />
      </Stack>
      <TableContainer sx={{ overflowX: "auto" }}><Table size="small" aria-label={`${section.title} rubric section`}>
        <TableHead><TableRow><TableCell sx={{ fontWeight: 700 }}>Criterion</TableCell>{section.levels.map((level) => <TableCell key={level} sx={{ fontWeight: 700 }}>{level}</TableCell>)}</TableRow></TableHead>
        <TableBody>{section.criteria.map((criterion, criterionIndex) => <TableRow key={`${criterion.name}-${criterionIndex}`}>
          <TableCell sx={{ verticalAlign: "top", whiteSpace: "pre-wrap", fontWeight: 600 }}>{criterion.name}</TableCell>
          {section.levels.map((level) => <TableCell key={level} sx={{ verticalAlign: "top", whiteSpace: "pre-wrap" }}>{descriptors(criterionIndex).get(level)}</TableCell>)}
        </TableRow>)}</TableBody>
      </Table></TableContainer>
    </Box>;
  })}</Stack>;
}
