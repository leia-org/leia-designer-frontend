import { useMemo } from "react";
import {
  Alert,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { parseRubricMarkdown } from "../lib/rubrics";

const formatWeight = (weight: number) => Number.isInteger(weight) ? String(weight) : weight.toFixed(1);

export function RubricPreview({ markdown }: { markdown: string }) {
  const parsed = useMemo(() => parseRubricMarkdown(markdown), [markdown]);

  if (!parsed.rubric) return <Alert severity="warning">{parsed.error}</Alert>;

  return (
    <Stack spacing={2.5}>
      {parsed.rubric.sections.map((section, sectionIndex) => {
        const automatic = section.explicitWeight === null;
        const suffix = parsed.rubric?.weightingMode === "equal"
          ? " equal"
          : automatic ? " automatic" : "";
        return (
          <Box key={`${section.title}-${sectionIndex}`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: 2, py: 1.25, bgcolor: "surfaces.subtle" }}>
              <Typography variant="subtitle2" fontWeight={700}>{section.title}</Typography>
              <Chip
                size="small"
                color={automatic ? "default" : "primary"}
                variant={automatic ? "outlined" : "filled"}
                label={`${formatWeight(section.weight)}%${suffix}`}
              />
            </Stack>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small" aria-label={`${section.title} rubric section`}>
                <TableHead>
                  <TableRow>
                    {section.headers.map((header, index) => (
                      <TableCell key={`${header}-${index}`} align={section.alignments[index]} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {section.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} align={section.alignments[cellIndex]} sx={{ verticalAlign: "top", whiteSpace: "pre-wrap" }}>
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      })}
    </Stack>
  );
}
