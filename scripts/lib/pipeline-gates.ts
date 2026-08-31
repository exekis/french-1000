import { readJson } from './io';

type ImportAudit = {
  status?: string;
  rowCount?: number;
  uniqueFrenchCount?: number;
  blankRequiredCellCount?: number;
};

export async function requirePassedImportAudit(
  auditPath: string,
  importedCount: number,
): Promise<void> {
  const audit = await readJson<ImportAudit>(auditPath);
  if (audit.status !== 'passed') {
    throw new Error(`Workbook import audit is not passed: ${auditPath}`);
  }
  if (
    audit.rowCount !== importedCount ||
    audit.uniqueFrenchCount !== importedCount ||
    audit.blankRequiredCellCount !== 0
  ) {
    throw new Error(
      `Workbook import audit does not match the ${importedCount} imported records`,
    );
  }
}
