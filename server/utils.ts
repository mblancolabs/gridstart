import path from "path";
import fs from "fs";

/**
 * Validates that a file path is safe and within allowed boundaries
 * Prevents path traversal attacks by ensuring the path:
 * 1. Resolves to within the allowed directory
 * 2. Doesn't contain path traversal sequences (..)
 * 3. Is properly normalized
 */
export function validateFilePath(filePath: string, allowedDir: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);

  // Check if path is within allowed directory
  if (!resolvedPath.startsWith(resolvedAllowedDir)) {
    return false;
  }

  // Check for path traversal attempts
  if (resolvedPath !== path.normalize(resolvedPath)) {
    return false;
  }

  // Additional check: ensure no .. components
  const relativePath = path.relative(resolvedAllowedDir, resolvedPath);
  if (relativePath.startsWith("..") || relativePath.includes("../") || relativePath.includes("..\\")) {
    return false;
  }

  return true;
}

/**
 * Safely loads and parses a JSON file with validation
 */
export function safeLoadJsonFile(filePath: string, allowedDir: string): unknown {
  if (!validateFilePath(filePath, allowedDir)) {
    throw new Error(`Invalid file path: ${filePath}`);
  }

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath}`, { cause: error });
    }
    throw error;
  }
}
