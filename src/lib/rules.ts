/**
 * Frontend helper to understand v2 rules structure
 * Note: The actual rules loading happens in the edge function
 */

export const V2_PAGE_TYPE_FILES: Record<string, string> = {
  EstatePage: "estate.md",
  GovernancePage: "governance.md",
  CommunityPage: "community.md",
  SiteHomePage: "siteHomePage.md",
};

export const V2_CATEGORIES: Record<string, string[]> = {
  EstatePage: ["Overview", "Collections", "EthosAndSuppliers"],
  GovernancePage: ["About", "Legal", "TradeAndSupply"],
  CommunityPage: ["ShepsGiving", "CharityAndDonations", "ArtsAndCulture", "CommunityOverview"],
  SiteHomePage: [],
};

export function getRulesFilePath(pageType: string, category?: string): string[] {
  const paths = ["rules/global.md"];
  
  const pageTypeFile = V2_PAGE_TYPE_FILES[pageType];
  if (pageTypeFile) {
    paths.push(`rules/${pageTypeFile}`);
  }
  
  return paths;
}
