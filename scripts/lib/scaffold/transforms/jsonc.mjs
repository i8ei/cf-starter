function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replaceJsoncStringProperty(
  source,
  propertyName,
  currentValue,
  nextValue,
  { global = false } = {}
) {
  if (typeof currentValue !== "string" || currentValue.length === 0 || currentValue === nextValue) {
    return source;
  }

  const flags = global ? "g" : "";
  const pattern = new RegExp(
    `("${escapeRegExp(propertyName)}"\\s*:\\s*)"${escapeRegExp(currentValue)}"`,
    flags
  );
  return source.replace(pattern, `$1"${nextValue}"`);
}

export function removeJsoncPropertyBlock(source, propertyName) {
  const pattern = new RegExp(`\\n\\s*"${propertyName}":\\s*(?:\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\}),?`, "m");
  return source.replace(pattern, "");
}
