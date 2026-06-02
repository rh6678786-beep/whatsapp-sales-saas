import { createChildLogger } from "./logger.js";
import { estimateTokens } from "./tokenBudget.js";

const log = createChildLogger("guard:context-filter");

interface ContextSection {
  name: string;
  content: string;
  priority: number;
  required: boolean;
}

export function sortByPriority(sections: ContextSection[]): ContextSection[] {
  return [...sections].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return b.priority - a.priority;
  });
}

export function filterContext(
  sections: ContextSection[],
  maxTokens: number,
): string[] {
  const sorted = sortByPriority(sections);
  const outputs: string[] = [];
  let usedTokens = 0;

  for (const section of sorted) {
    const sectionTokens = estimateTokens(section.content);

    if (usedTokens + sectionTokens <= maxTokens) {
      outputs.push(section.content);
      usedTokens += sectionTokens;
    } else if (section.required) {
      const remaining = maxTokens - usedTokens;
      if (remaining > 20) {
        const truncated = section.content.slice(0, remaining * 4);
        outputs.push(truncated + "...");
        usedTokens = maxTokens;
      }
      log.warn(
        { name: section.name, tokens: sectionTokens, remaining },
        "Required context section truncated to fit budget",
      );
    } else {
      log.warn({ name: section.name, tokens: sectionTokens, maxTokens }, "Context section dropped to fit budget");
    }

    if (usedTokens >= maxTokens) break;
  }

  return outputs;
}

export function buildContextString(
  sections: ContextSection[],
  maxTokens: number = 25000,
): string {
  const filtered = filterContext(sections, maxTokens);
  return filtered.join("\n\n");
}
