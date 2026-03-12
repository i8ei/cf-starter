export function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }

  args.splice(index, 2);
  return value;
}

export function takeListOption(args, name) {
  const value = takeOption(args, name);
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function takeFlag(args, name) {
  const present = args.includes(name);
  if (present) {
    args.splice(args.indexOf(name), 1);
  }
  return present;
}

export function assertNoUnknownArgs(args) {
  if (args.length > 0) {
    throw new Error(`Unknown arguments: ${args.join(" ")}`);
  }
}
