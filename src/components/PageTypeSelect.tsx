/**
 * PageTypeSelect - Taxonomy-driven inline page type selector
 * 
 * Loads page types for a specific domain from the database taxonomy system.
 * Handles legacy values by showing them with "(legacy)" suffix.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTypesForDomain } from "@/hooks/use-taxonomy";

interface PageTypeSelectProps {
  domain: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onPageTypeChange?: () => void;
}

export function PageTypeSelect({ domain, value, onChange, onPageTypeChange }: PageTypeSelectProps) {
  const { pageTypes, loading } = usePageTypesForDomain(domain, true);

  const handleChange = (newValue: string) => {
    const actualValue = newValue === "none" ? null : newValue;
    onChange(actualValue);
    onPageTypeChange?.();
  };

  // Check if current value is not in active page types (legacy)
  const isLegacy = value && !pageTypes.find(pt => pt.id === value);

  return (
    <Select
      value={value || "none"}
      onValueChange={handleChange}
      disabled={loading}
    >
      <SelectTrigger className="w-[180px] h-8 rounded-lg">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="rounded-xl max-h-[300px]">
        <SelectItem value="none">—</SelectItem>
        {/* Show legacy value first if present */}
        {isLegacy && value && (
          <SelectItem value={value}>
            {value} (legacy)
          </SelectItem>
        )}
        {/* Show active page types */}
        {pageTypes.map((type) => (
          <SelectItem key={type.id} value={type.id}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
