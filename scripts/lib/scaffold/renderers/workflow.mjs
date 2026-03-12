export function renderGeneratedAppCiWorkflow(source) {
  return source
    .replace(
      /\n\s+- name: Check publish readiness[\s\S]*?\n\s+run: npm run check:publish\n/g,
      "\n"
    )
    .replace(
      /\n\s+- name: Scaffold integration test[\s\S]*?\n\s+timeout-minutes: 10\n/g,
      "\n"
    )
    .replace(/\n{3,}/g, "\n\n");
}
