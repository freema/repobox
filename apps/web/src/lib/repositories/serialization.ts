/**
 * Serialization helpers for Redis hash <-> TypeScript object conversion
 * All timestamps are stored as milliseconds (number)
 */

/**
 * Converts a TypeScript object to Redis hash fields
 * - Converts booleans to "true"/"false"
 * - Converts numbers to strings
 * - Converts null/undefined to empty string
 * - Converts camelCase keys to snake_case
 */
export function toHash(obj: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);

    if (value === null || value === undefined) {
      result[snakeKey] = "";
    } else if (typeof value === "boolean") {
      result[snakeKey] = value ? "true" : "false";
    } else {
      result[snakeKey] = String(value);
    }
  }

  return result;
}

/**
 * Type definition for field conversion
 */
export type FieldType = "string" | "number" | "boolean" | "optional_string" | "optional_number";

export type FieldSchema = Record<string, FieldType>;

/**
 * Converts Redis hash to TypeScript object using a schema
 */
export function fromHash<T>(data: Record<string, string>, schema: FieldSchema): T {
  const result: Record<string, unknown> = {};

  for (const [camelKey, fieldType] of Object.entries(schema)) {
    const snakeKey = camelToSnake(camelKey);
    const value = data[snakeKey];

    switch (fieldType) {
      case "string":
        result[camelKey] = value ?? "";
        break;
      case "number":
        result[camelKey] = value ? parseInt(value, 10) : 0;
        break;
      case "boolean":
        result[camelKey] = value === "true";
        break;
      case "optional_string":
        result[camelKey] = value && value !== "" ? value : undefined;
        break;
      case "optional_number":
        result[camelKey] = value && value !== "" ? parseInt(value, 10) : undefined;
        break;
    }
  }

  return result as T;
}

/**
 * Converts camelCase to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
