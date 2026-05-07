/**
 * Interface for optional Telegram bot notification adapter.
 * Keeps NotificationService decoupled from BotModule to avoid circular dependencies.
 */
export const BOT_NOTIFIER = Symbol('BOT_NOTIFIER');

export interface IBotNotifier {
  sendNotification(opts: {
    chatId: string;
    eventKey: string;
    dealPublicId?: string;
    dealId?: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}
