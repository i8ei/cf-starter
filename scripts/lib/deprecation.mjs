export function printDeprecatedCommandNotice(command, replacement) {
  console.error(
    `[deprecated] ${command} is an internal compatibility path. Prefer ${replacement}.`
  );
}
