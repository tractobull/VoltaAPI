const MAX_HISTORY_MESSAGES = 12;
const SUMMARY_THRESHOLD = 20;

export class ConversationSummarizer {
  static trimHistory(history) {
    if (!history || history.length <= MAX_HISTORY_MESSAGES) {
      return { messages: history || [], summary: null };
    }

    const messages = [...history];
    const toSummarize = messages.slice(0, messages.length - MAX_HISTORY_MESSAGES);
    const recent = messages.slice(messages.length - MAX_HISTORY_MESSAGES);

    const summary = toSummarize
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content.length > 100 ? m.content.slice(0, 100) + '...' : m.content}`)
      .join('\n');

    return {
      messages: recent,
      summary: `Resumen de la conversación anterior:\n${summary}`,
    };
  }
}
