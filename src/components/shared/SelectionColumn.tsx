import React, { useState, useMemo } from 'react';
import { LeiaCard } from '../LeiaCard';
import { SearchFilter } from './SearchFilter';

interface LeiaItem {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    version: string;
  };
  spec: {
    description?: string;
    fullName?: string;
    [key: string]: any;
  };
}

interface SelectionColumnProps {
  title: string;
  items: LeiaItem[];
  selectedItem: LeiaItem | null;
  onSelect: (item: LeiaItem) => void;
  onCreateNew: () => void;
  placeholder: string;
}

export const SelectionColumn: React.FC<SelectionColumnProps> = ({
  title,
  items,
  selectedItem,
  onSelect,
  onCreateNew,
  placeholder
}) => {
  const [filterValue, setFilterValue] = useState('');

  const filteredItems = useMemo(() => {
    if (!filterValue.trim()) return items;
    
    const searchTerm = filterValue.toLowerCase();
    return items.filter(item => {
      const title = item.spec.fullName || item.metadata.name;
      const description = item.spec.description || '';
      
      return title.toLowerCase().includes(searchTerm) || 
             description.toLowerCase().includes(searchTerm) ||
             item.metadata.name.toLowerCase().includes(searchTerm);
    });
  }, [items, filterValue]);

  const generateItemYaml = (item: LeiaItem) => {
    return `kind: ${item.kind}
apiVersion: ${item.apiVersion}
metadata:
  name: "${item.metadata.name}"
  version: "${item.metadata.version}"
spec:
  ${Object.entries(item.spec)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n  ')}`;
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
          {/* Create New Button */}
          <div 
            className="p-4 rounded-lg cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors group"
            onClick={onCreateNew}
          >
            <div className="flex items-center justify-center text-gray-500 group-hover:text-blue-500">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Crear Nuevo {title}</span>
            </div>
          </div>

          {/* Filtered Items */}
          {filteredItems.length > 0 ? (
            filteredItems.map(item => (
              <LeiaCard
                key={item.metadata.name}
                title={item.spec.fullName || item.metadata.name}
                description={item.spec.description || ''}
                version={item.metadata.version}
                selected={selectedItem?.metadata.name === item.metadata.name}
                yaml={generateItemYaml(item)}
                onClick={() => onSelect(item)}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              {filterValue ? 'No se encontraron resultados' : 'No hay elementos disponibles'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 