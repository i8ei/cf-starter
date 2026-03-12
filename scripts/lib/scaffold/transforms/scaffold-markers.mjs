export function removeScaffoldBlock(source, { name, featureKey, jsx = false }) {
  const suffix = featureKey ? ` ${featureKey}` : "";
  const startMarker = jsx
    ? `{/* scaffold:${name}:start${suffix} */}`
    : `// scaffold:${name}:start${suffix}`;
  const endMarker = jsx ? `{/* scaffold:${name}:end${suffix} */}` : `// scaffold:${name}:end${suffix}`;

  const lines = source.split("\n");
  let changed = false;

  for (;;) {
    const startIndex = lines.findIndex((line) => line.trim() === startMarker);
    if (startIndex === -1) {
      break;
    }

    const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === endMarker);
    if (endIndex === -1) {
      break;
    }

    lines.splice(startIndex, endIndex - startIndex + 1);
    changed = true;
  }

  if (!changed) {
    return source;
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function stripRemainingScaffoldMarkers(source) {
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !(
        /^\/\/ scaffold:[a-z0-9-]+:(?:start|end)(?: [a-z0-9-]+)?$/i.test(trimmed) ||
        /^\{\/\* scaffold:[a-z0-9-]+:(?:start|end)(?: [a-z0-9-]+)? \*\/\}$/i.test(trimmed)
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
