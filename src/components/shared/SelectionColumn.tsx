import React, { useState, useMemo } from "react";
import { LeiaCard } from "../LeiaCard";
import { SearchFilter } from "./SearchFilter";
import type { Persona, Problem, Behaviour } from "../../models/Leia";

interface SelectionColumnProps {
  title: string;
  items: Persona[] | Behaviour[] | Problem[];
  selectedItem: Persona | Behaviour | Problem | null;
  onSelect: (item: Persona | Behaviour | Problem) => void;
  placeholder: string;
}

export const SelectionColumn: React.FC<SelectionColumnProps> = ({
  title,
  items,
  selectedItem,
  onSelect,
  placeholder,
}) => {
  const [filterValue, setFilterValue] = useState("");

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
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
        <SearchFilter
          placeholder={placeholder}
          value={filterValue}
          onChange={setFilterValue}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {/* Filtered Items */}
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
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              {filterValue
                ? "No se encontraron resultados"
                : "No hay elementos disponibles"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
