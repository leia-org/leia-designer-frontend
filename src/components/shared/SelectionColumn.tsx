import React, { useState, useMemo } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { Box, Stack, Typography } from "@mui/material";
import { useAuth } from "../../context";
import LeiaCard from "../LeiaCard";
import { SearchFilter } from "./SearchFilter";
import type { Persona, Problem, Behaviour } from "../../models/Leia";
import { buildOriginalAvatarPath } from "../../lib/avatar";

interface SelectionColumnProps {
  title: string;
  items: Persona[] | Behaviour[] | Problem[];
  selectedItem: Persona | Behaviour | Problem | null;
  onSelect: (item: Persona | Behaviour | Problem) => void;
  placeholder: string;
  rightHeaderElement?: React.ReactNode;
  onDelete?: (
    item: Persona | Behaviour | Problem,
    resourceType: "persona" | "problem" | "behaviour"
  ) => void;
}

export const SelectionColumn: React.FC<SelectionColumnProps> = ({
  title,
  items,
  selectedItem,
  onSelect,
  placeholder,
  rightHeaderElement,
  onDelete,
}) => {
  const [filterValue, setFilterValue] = useState("");
  const { user: currentUser } = useAuth();

  // Determinar si esta columna es de behaviours
  const isBehaviourColumn = title.toLowerCase() === "behaviour";
  const showItemAvatar = title.toLowerCase() === "persona" || title.toLowerCase() === "problem";

  // Determinar si el usuario actual es instructor
  const isCurrentUserInstructor = currentUser?.role === "instructor";

  // Determinar el tipo de recurso basado en el título
  const getResourceType = (): "persona" | "problem" | "behaviour" => {
    const titleLower = title.toLowerCase();
    if (titleLower === "persona") return "persona";
    if (titleLower === "problem") return "problem";
    return "behaviour";
  };

  const filteredItems = useMemo(() => {
    if (!filterValue.trim()) return items;

    const searchTerm = filterValue.toLowerCase();
    return items.filter((item) => {
      const title = item.metadata.name;
      const description = item.spec.description || "";

      return (
        title.toLowerCase().includes(searchTerm) ||
        description.toLowerCase().includes(searchTerm) ||
        item.metadata.name.toLowerCase().includes(searchTerm)
      );
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
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">{title}</Typography>
            <CheckCircleOutlineIcon color={selectedItem ? "success" : "disabled"} />
          </Stack>
          {rightHeaderElement && <Box>{rightHeaderElement}</Box>}
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
            filteredItems.map((item) => (
              <LeiaCard
                key={item.id}
                title={item.metadata.name}
                description={item.spec.description || ""}
                version={item.metadata.version}
                selected={selectedItem?.id === item.id}
                yaml={generateItemYaml(item)}
                onClick={() => onSelect(item)}
                user={item.user}
                isPublished={item.isPublished}
                hideContentForInstructor={
                  isBehaviourColumn && isCurrentUserInstructor
                }
                onDelete={
                  onDelete ? () => onDelete(item, getResourceType()) : undefined
                }
                resourceId={item.id}
                avatar={"avatar" in item.spec ? item.spec.avatar : undefined}
                fallbackAvatar={
                  showItemAvatar
                    ? buildOriginalAvatarPath(
                        getResourceType() === "persona" ? "personas" : "problems",
                        item.id,
                      )
                    : undefined
                }
                showAvatar={showItemAvatar}
              />
            ))
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
