import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import api from "./axios";

export type JsonSchema = Record<string, unknown>;

let schemaPromise: Promise<JsonSchema> | null = null;
const validators = new WeakMap<object, ValidateFunction>();

export function getRubricSchema(): Promise<JsonSchema> {
  schemaPromise ??= api.get<JsonSchema>("/api/v1/rubrics/schema").then(({ data }) => data);
  return schemaPromise;
}

export function validateAgainstRubricSchema(value: unknown, schema: JsonSchema): string | null {
  let validate = validators.get(schema);
  if (!validate) {
    validate = new Ajv({ allErrors: true }).compile(schema);
    validators.set(schema, validate);
  }
  if (validate(value)) return null;
  return (validate.errors as ErrorObject[] | null | undefined)
    ?.map((error) => `${error.dataPath || "rubric"} ${error.message}`)
    .join("; ") || "Invalid rubric JSON.";
}
