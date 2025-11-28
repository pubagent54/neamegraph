/**
 * JSON-LD Schema Validator
 * 
 * Validates generated schema for common issues:
 * - Invalid JSON structure
 * - Missing required nodes (Organization, WebPage)
 * - Invalid @id references (dangling references)
 * - Circular dependencies
 * - URL consistency
 * - Missing required properties
 */

interface ValidationIssue {
  severity: 'error' | 'warning';
  category: string;
  message: string;
  path?: string;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalNodes: number;
    nodeTypes: Record<string, number>;
    references: number;
  };
}

export function validateJsonLdSchema(jsonldString: string, canonicalUrl?: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const stats = {
    totalNodes: 0,
    nodeTypes: {} as Record<string, number>,
    references: 0,
  };

  // 1. Parse JSON
  let jsonld: any;
  try {
    jsonld = JSON.parse(jsonldString);
  } catch (error) {
    return {
      valid: false,
      issues: [{
        severity: 'error',
        category: 'JSON Parse',
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      stats,
    };
  }

  // 2. Check for @context
  if (!jsonld['@context']) {
    issues.push({
      severity: 'error',
      category: 'Structure',
      message: 'Missing @context property',
    });
  }

  // 3. Check for @graph
  if (!jsonld['@graph'] || !Array.isArray(jsonld['@graph'])) {
    issues.push({
      severity: 'error',
      category: 'Structure',
      message: 'Missing or invalid @graph array',
    });
    return { valid: false, issues, stats };
  }

  const graph = jsonld['@graph'];
  stats.totalNodes = graph.length;

  // Build index of all @id values
  const nodeIds = new Set<string>();
  const nodesByType: Record<string, any[]> = {};
  
  graph.forEach((node: any) => {
    if (node['@id']) {
      nodeIds.add(node['@id']);
    }
    
    // Track node types
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    types.forEach((type: string) => {
      if (type) {
        stats.nodeTypes[type] = (stats.nodeTypes[type] || 0) + 1;
        if (!nodesByType[type]) {
          nodesByType[type] = [];
        }
        nodesByType[type].push(node);
      }
    });
  });

  // 4. Check for required Organization node
  const hasOrganization = graph.some((node: any) => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.includes('Organization');
  });

  if (!hasOrganization) {
    issues.push({
      severity: 'error',
      category: 'Required Nodes',
      message: 'Missing Organization node',
    });
  }

  // 5. Check for WebPage node
  const hasWebPage = graph.some((node: any) => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.includes('WebPage') || types.some((t: string) => t.endsWith('Page'));
  });

  if (!hasWebPage) {
    issues.push({
      severity: 'warning',
      category: 'Required Nodes',
      message: 'Missing WebPage node',
    });
  }

  // 6. Check for invalid references (dangling @id references)
  graph.forEach((node: any, index: number) => {
    const nodeId = node['@id'] || `node-${index}`;
    
    // Check all properties for @id references
    Object.entries(node).forEach(([key, value]) => {
      if (key.startsWith('@')) return; // Skip @context, @type, @id
      
      const checkReference = (ref: any) => {
        if (ref && typeof ref === 'object' && ref['@id']) {
          stats.references++;
          const refId = ref['@id'];
          
          // Skip external references (http/https URLs not on same domain)
          if (refId.startsWith('http://') || refId.startsWith('https://')) {
            if (canonicalUrl) {
              const baseUrl = new URL(canonicalUrl).origin;
              if (!refId.startsWith(baseUrl)) {
                return; // External reference, skip validation
              }
            }
          }
          
          if (!nodeIds.has(refId)) {
            issues.push({
              severity: 'error',
              category: 'Invalid Reference',
              message: `Dangling reference: "${key}" references non-existent node "${refId}"`,
              path: nodeId,
            });
          }
        }
      };

      if (Array.isArray(value)) {
        value.forEach(checkReference);
      } else {
        checkReference(value);
      }
    });
  });

  // 7. Check for circular dependencies
  const detectCircularDeps = (nodeId: string, visited: Set<string> = new Set(), path: string[] = []): boolean => {
    if (visited.has(nodeId)) {
      issues.push({
        severity: 'warning',
        category: 'Circular Dependency',
        message: `Circular reference detected: ${[...path, nodeId].join(' → ')}`,
      });
      return true;
    }

    visited.add(nodeId);
    path.push(nodeId);

    const node = graph.find((n: any) => n['@id'] === nodeId);
    if (!node) return false;

    let hasCircular = false;
    Object.entries(node).forEach(([key, value]) => {
      if (key.startsWith('@')) return;

      const checkRef = (ref: any) => {
        if (ref && typeof ref === 'object' && ref['@id']) {
          if (detectCircularDeps(ref['@id'], new Set(visited), [...path])) {
            hasCircular = true;
          }
        }
      };

      if (Array.isArray(value)) {
        value.forEach(checkRef);
      } else {
        checkRef(value);
      }
    });

    return hasCircular;
  };

  // Check from Organization node
  const orgNode = graph.find((n: any) => {
    const types = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
    return types.includes('Organization');
  });
  if (orgNode?.['@id']) {
    detectCircularDeps(orgNode['@id']);
  }

  // 8. Check URL consistency (if canonical URL provided)
  if (canonicalUrl) {
    graph.forEach((node: any) => {
      if (node.url && typeof node.url === 'string') {
        if (!node.url.startsWith('https://www.shepherdneame.co.uk')) {
          issues.push({
            severity: 'warning',
            category: 'URL Consistency',
            message: `Node URL "${node.url}" does not use canonical base URL`,
            path: node['@id'],
          });
        }
      }

      if (node['@id'] && typeof node['@id'] === 'string' && !node['@id'].startsWith('#')) {
        if (!node['@id'].startsWith('https://www.shepherdneame.co.uk')) {
          issues.push({
            severity: 'warning',
            category: 'URL Consistency',
            message: `Node @id "${node['@id']}" does not use canonical base URL`,
          });
        }
      }
    });
  }

  // 9. Check for required properties based on node type
  nodesByType['Organization']?.forEach((node: any) => {
    if (!node.name) {
      issues.push({
        severity: 'error',
        category: 'Missing Property',
        message: 'Organization node missing required "name" property',
        path: node['@id'],
      });
    }
    if (!node.url) {
      issues.push({
        severity: 'warning',
        category: 'Missing Property',
        message: 'Organization node missing "url" property',
        path: node['@id'],
      });
    }
  });

  nodesByType['WebPage']?.forEach((node: any) => {
    if (!node.name && !node.headline) {
      issues.push({
        severity: 'warning',
        category: 'Missing Property',
        message: 'WebPage node missing "name" or "headline" property',
        path: node['@id'],
      });
    }
  });

  nodesByType['Brand']?.forEach((node: any) => {
    if (!node.name) {
      issues.push({
        severity: 'error',
        category: 'Missing Property',
        message: 'Brand node missing required "name" property',
        path: node['@id'],
      });
    }
  });

  // 10. Check for duplicate @id values
  const idCounts: Record<string, number> = {};
  graph.forEach((node: any) => {
    if (node['@id']) {
      idCounts[node['@id']] = (idCounts[node['@id']] || 0) + 1;
    }
  });

  Object.entries(idCounts).forEach(([id, count]) => {
    if (count > 1) {
      issues.push({
        severity: 'error',
        category: 'Duplicate ID',
        message: `Duplicate @id found: "${id}" appears ${count} times`,
      });
    }
  });

  const errors = issues.filter(i => i.severity === 'error');
  const valid = errors.length === 0;

  return { valid, issues, stats };
}

export function formatValidationIssue(issue: ValidationIssue): string {
  const prefix = issue.severity === 'error' ? '❌' : '⚠️';
  const pathStr = issue.path ? ` (${issue.path})` : '';
  return `${prefix} [${issue.category}] ${issue.message}${pathStr}`;
}
