export async function handlePreCompact(payload = {}) {
  const context = payload.context_window ?? payload.contextWindow ?? {};
  const task = payload.task ?? payload.current_task ?? payload.prompt ?? '';
  const modifiedFiles = payload.modified_files ?? payload.modifiedFiles ?? [];
  const pending = payload.pending_decisions ?? payload.pendingDecisions ?? [];
  const remaining = context.remaining_percentage ?? context.remainingPercentage;

  const lines = ['TC_TOKEN_OPTIMIZER_STATE'];
  if (remaining !== undefined) lines.push(`remaining_context=${remaining}`);
  if (task) lines.push(`task=${String(task).slice(0, 240)}`);
  if (modifiedFiles.length) lines.push(`modified=${modifiedFiles.join(', ')}`);
  if (pending.length) lines.push(`pending=${pending.join('; ')}`);

  return { additionalContext: lines.join('\n') };
}
