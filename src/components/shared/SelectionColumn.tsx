import React, { useState, useMemo } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useAuth } from "../../context";
import LeiaCard from "../LeiaCard";
import { RubricPreview } from "../RubricPreview";
import { SearchFilter } from "./SearchFilter";
import type { Persona, Problem, Behaviour } from "../../models/Leia";
import type { Rubric } from "../../models/Rubric";
import { buildOriginalAvatarPath } from "../../lib/avatar";

type SelectableItem = Persona | Behaviour | Problem | Rubric;
type SelectableResourceType = "persona" | "problem" | "behaviour" | "rubric";

const isRubricItem = (item: SelectableItem): item is Rubric =>
  "sections" in item.spec && Array.isArray(item.spec.sections);

const getItemId = (item: SelectableItem): string =>
  ("id" in item && item.id) || ("_id" in item && item._id) || "";

const getRubricSummary = (rubric: Rubric): string => {
  const sections = rubric.spec.sections || [];
  const criteriaCount = sections.reduce(
    (sum, section) => sum + (section.criteria?.length || 0),
    0,
  );
  const sectionTitles = sections.map((section) => section.title).filter(Boolean).join(", ");
  const header = `${sections.length} ${sections.length === 1 ? "section" : "sections"} · ${criteriaCount} ${criteriaCount === 1 ? "criterion" : "criteria"}`;
  return sectionTitles ? `${header} — ${sectionTitles}` : header;
};

interface SelectionColumnProps {
  title: string;
  items: SelectableItem[];
  selectedItem: SelectableItem | null;
  onSelect: (item: SelectableItem) => void;
  onClearSelection?: () => void;
  optional?: boolean;
  placeholder: string;
  rightHeaderElement?: React.ReactNode;
  onDelete?: (
    item: SelectableItem,
    resourceType: SelectableResourceType
  ) => void;
}

export const SelectionColumn: React.FC<SelectionColumnProps> = ({
  title,
  items,
  selectedItem,
  onSelect,
  onClearSelection,
  optional = false,
  placeholder,
  rightHeaderElement,
  onDelete,
}) => {
  const [filterValue, setFilterValue] = useState("");
  const { user: currentUser } = useAuth();

  const isBehaviourColumn = title.toLowerCase() === "behaviour";
  const isRubricColumn = title.toLowerCase() === "rubric";
  const showItemAvatar = title.toLowerCase() === "persona" || title.toLowerCase() === "problem";

  const isCurrentUserInstructor = currentUser?.role === "instructor";

  const getResourceType = (): SelectableResourceType => {
    const titleLower = title.toLowerCase();
    if (titleLower === "persona") return "persona";
    if (titleLower === "problem") return "problem";
    if (titleLower === "rubric") return "rubric";
    return "behaviour";
  };

  const filteredItems = useMemo(() => {
    if (!filterValue.trim()) return items;

    const searchTerm = filterValue.toLowerCase();
    return items.filter((item) => {
      const name = item.metadata.name.toLowerCase();
      if (isRubricItem(item)) {
        const sectionText = item.spec.sections
          .map((section) => `${section.title} ${section.criteria.map((c) => c.name).join(" ")}`)
          .join(" ")
          .toLowerCase();
        const promptText = (item.spec.evaluationPrompt || "").toLowerCase();
        return (
          name.includes(searchTerm) ||
          sectionText.includes(searchTerm) ||
          promptText.includes(searchTerm)
        );
      }

      const description = (item.spec.description || "").toLowerCase();
      return name.includes(searchTerm) || description.includes(searchTerm);
    });
  }, [items, filterValue]);

  const generateItemYaml = (item: Persona | Behaviour | Problem) => {
    return `apiVersion: ${item.apiVersion}
metadata:
  name: "${item.metadata.name}"
  version: "${item.metadata.version}"
spec:
  ${Object.entries(item.spec)
    .map(([key, value]) => `${key}: "${value}"`)
    .join("\n  ")}`;
  };

  const selectedId = selectedItem ? getItemId(selectedItem) : "";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>{title}</Typography>
            {optional ? (
              <Chip label="Optional" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
            ) : (
              <CheckCircleOutlineIcon color={selectedItem ? "success" : "disabled"} />
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {optional && selectedItem && onClearSelection && (
              <Button size="small" color="inherit" onClick={onClearSelection} sx={{ minWidth: 0, px: 1 }}>
                Clear
              </Button>
            )}
            {rightHeaderElement && <Box>{rightHeaderElement}</Box>}
          </Stack>
        </Stack>
        <SearchFilter
          placeholder={placeholder}
          value={filterValue}
          onChange={setFilterValue}
        />
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        <Stack spacing={1.5}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const itemId = getItemId(item);
              const isSelected = Boolean(selectedId && itemId && selectedId === itemId);
              const rubricItem = isRubricItem(item) ? item : null;

              return (
                <LeiaCard
                  key={itemId || item.metadata.name}
                  title={item.metadata.name}
                  description={
                    rubricItem
                      ? getRubricSummary(rubricItem)
                      : (item as Persona | Behaviour | Problem).spec.description || ""
                  }
                  version={
                    rubricItem
                      ? undefined
                      : (item as Persona | Behaviour | Problem).metadata.version
                  }
                  selected={isSelected}
                  yaml={
                    rubricItem
                      ? undefined
                      : generateItemYaml(item as Persona | Behaviour | Problem)
                  }
                  previewContent={
                    rubricItem ? (
                      <Box sx={{ maxHeight: 380, overflowY: "auto", p: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                          {rubricItem.metadata.name}
                        </Typography>
                        <RubricPreview spec={rubricItem.spec} />
                      </Box>
                    ) : undefined
                  }
                  onClick={() => {
                    if (isRubricColumn && isSelected && onClearSelection) {
                      onClearSelection();
                      return;
                    }
                    onSelect(item);
                  }}
                  user={item.user}
                  isPublished={item.isPublished}
                  hideContentForInstructor={
                    isBehaviourColumn && isCurrentUserInstructor
                  }
                  onDelete={
                    onDelete ? () => onDelete(item, getResourceType()) : undefined
                  }
                  resourceId={itemId}
                  avatar={!rubricItem && "avatar" in item.spec ? item.spec.avatar : undefined}
                  fallbackAvatar={
                    showItemAvatar && !rubricItem
                      ? buildOriginalAvatarPath(
                          getResourceType() === "persona" ? "personas" : "problems",
                          itemId,
                        )
                      : undefined
                  }
                  showAvatar={showItemAvatar}
                />
              );
            })
          ) : (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              {filterValue ? "No results found" : "No items available"}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  );
};
