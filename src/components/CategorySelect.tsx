/**
 * CategorySelect - Taxonomy-driven inline category selector
 * 
 * Loads categories for a specific page type from the database taxonomy system.
 * Handles legacy values by showing them with "(legacy)" suffix.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoriesForPageType } from "@/hooks/use-taxonomy";

interface CategorySelectProps {
  pageType: string | null;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function CategorySelect({ pageType, value, onChange }: CategorySelectProps) {
  const { categories, loading } = useCategoriesForPageType(pageType, true);

  const handleChange = (newValue: string) => {
    onChange(newValue === "none" ? null : newValue);
  };

  // Check if current value is not in active categories (legacy)
  const isLegacy = value && !categories.find(cat => cat.id === value);

  return (
    <Select
      value={value || "none"}
      onValueChange={handleChange}
      disabled={!pageType || loading}
    >
      <SelectTrigger className="w-[160px] h-8 rounded-lg">
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
        {/* Show active categories */}
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
