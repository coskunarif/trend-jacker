import fs from 'node:fs';
import path from 'node:path';

function main() {
  const playbookPath = path.join(process.cwd(), 'AGENT_PLAYBOOK.md');
  if (!fs.existsSync(playbookPath)) {
    console.error(`Error: AGENT_PLAYBOOK.md not found at ${playbookPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(playbookPath, 'utf8');

  // Find active task in the backlog table
  // Example line: | **TJ-03** | ... | ... | **[/] Active** |
  const lines = content.split('\n');
  let activeTaskId = null;
  let activeTaskRow = null;

  for (const line of lines) {
    if (line.includes('[/] Active')) {
      const match = line.match(/\*\*(TJ-\d+)\*\*/);
      if (match) {
        activeTaskId = match[1];
        activeTaskRow = line;
        break;
      }
    }
  }

  if (!activeTaskId) {
    console.log(`
======================================================================
🤖 TRENDJACKER AUTONOMOUS AGENT PORTAL
======================================================================
No active task found in AGENT_PLAYBOOK.md (marked with '[/] Active').

Next Steps:
1. Open AGENT_PLAYBOOK.md.
2. Select the next uncompleted task (marked with '[ ]').
3. Change its status to '[/] Active' in the backlog table.
4. Save the file and run 'npm run agent:next' again.
======================================================================
`);
    process.exit(0);
  }

  // Extract the Active Task Details section for the task ID
  // Find the header e.g. ## 🛠️ Active Task Details: TJ-03
  const sectionHeaderRegex = new RegExp(`## 🛠️ Active Task Details:\\s*${activeTaskId}`, 'i');
  let sectionIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (sectionHeaderRegex.test(lines[i])) {
      sectionIndex = i;
      break;
    }
  }

  let details = '';
  if (sectionIndex !== -1) {
    // Read lines until the next major section (starts with ## or ---)
    for (let j = sectionIndex + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.startsWith('##') || line.startsWith('---')) {
        break;
      }
      details += line + '\n';
    }
  } else {
    details = `(Active task details section for ${activeTaskId} was not found in AGENT_PLAYBOOK.md)\n`;
  }

  console.log(`
======================================================================
🤖 TRENDJACKER AUTONOMOUS AGENT PLAYBOOK TRIGGER
======================================================================
Active Task Identified: ${activeTaskId}
Status: IN PROGRESS (ACTIVE)

--- Task Metadata ---
${activeTaskRow.trim()}

--- Active Task Details ---
${details.trim()}

======================================================================
INSTRUCTIONS FOR THE AGENT:
1. Read PHILOSOPHY.md to understand core design, performance, and infrastructure economy constraints.
2. Implement the active task outlined above completely (Backend, UI, CSS).
3. Verify changes locally (start local server, run Playwright verification, check console logs for errors).
4. Commit and push the verified changes to GitHub (Conventional Commits e.g. 'feat: ...', 'fix: ...', 'docs: ...', followed by 'git push origin main').
5. Deploy to Production (using the gcloud deployment command in README.md).
6. Perform a Live Production Check (query the live Production URL, perform a smoke test, and check browser console logs in production to verify zero errors).
7. Update AGENT_PLAYBOOK.md to mark this task as '[x] Completed'.
8. Select the next task from the backlog and mark it as '[/] Active'.
9. Update the walkthrough.md log.
======================================================================
`);
}

main();
