export interface RedactOptions {
  redactEmails: boolean;
  redactApiKeys: boolean;
  redactPaths: boolean;
}

// Patterns
const EMAIL_PATTERN = /[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/g,    // Anthropic API keys
  /ghp_[a-zA-Z0-9]{36}/g,    // GitHub PATs
  /gho_[a-zA-Z0-9]{36}/g,
  /AKIA[0-9A-Z]{16}/g,       // AWS access keys
];
const HOME_PATH_PATTERN = /\/Users\/[^/\s"']+/g; // macOS home paths

export function redactText(text: string, options: RedactOptions): string {
  let result = text;

  if (options.redactEmails) {
    result = result.replace(EMAIL_PATTERN, '[EMAIL]');
  }

  if (options.redactApiKeys) {
    for (const pattern of API_KEY_PATTERNS) {
      result = result.replace(pattern, '[API_KEY]');
    }
  }

  if (options.redactPaths) {
    result = result.replace(HOME_PATH_PATTERN, '/Users/[USER]');
  }

  return result;
}

export function redactSession(
  messages: Array<{ content: unknown }>,
  options: RedactOptions,
): Array<{ content: unknown }> {
  if (!options.redactEmails && !options.redactApiKeys && !options.redactPaths) {
    return messages;
  }

  return messages.map(msg => ({
    ...msg,
    content:
      typeof msg.content === 'string'
        ? redactText(msg.content, options)
        : msg.content,
  }));
}
