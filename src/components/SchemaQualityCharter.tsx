import { CheckCircle } from "lucide-react";
import { SCHEMA_QUALITY_RULES, SCHEMA_QUALITY_RULE_DESCRIPTIONS } from "@/config/schemaQualityRules";
import { ORG_DESCRIPTION } from "@/config/organization";

/**
 * Reusable Schema Quality Charter component
 * Displays the canonical organisation strap and global quality rules
 * Used in both Settings and Rules pages
 */
export function SchemaQualityCharter() {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-muted/30 rounded-xl border">
        <h3 className="text-sm font-semibold mb-2">Canonical Organisation Strap</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {ORG_DESCRIPTION}
        </p>
      </div>
      
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Global Quality Rules</h3>
        <div className="space-y-2">
          {Object.entries(SCHEMA_QUALITY_RULES).map(([key, enabled]) => (
            <div key={key} className="flex items-start gap-3 p-3 bg-card rounded-lg border">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {SCHEMA_QUALITY_RULE_DESCRIPTIONS[key as keyof typeof SCHEMA_QUALITY_RULES]}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground border-t pt-4">
        <p>
          These rules are enforced by the schema engine and validated post-generation. 
          For full context, see <code className="px-1 py-0.5 bg-muted rounded text-xs">docs/schema-quality-charter.md</code>
        </p>
      </div>
    </div>
  );
}
