export async function main(ns) {
  const target = String(ns.args[0] || "");
  if (!target) return;

  const additionalMsec = Math.max(0, Math.round(Number(ns.args[2] || 0)));
  await ns.hack(target, { additionalMsec });
}
