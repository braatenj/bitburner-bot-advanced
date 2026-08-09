export async function main(ns) {
  const target = String(ns.args[0] || "");
  if (!target) return;
  await ns.hack(target);
}
