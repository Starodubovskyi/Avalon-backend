export const CONVERSATION_KINDS = ['direct', 'group'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const CONVERSATION_TITLE_MAX_LENGTH = 80;
export const MESSAGE_BODY_MAX_LENGTH = 4000;

/** Other participants of one new conversation (the caller is added on top). */
export const CONVERSATION_MAX_PARTICIPANTS = 50;
/** Safety cap for GET /conversations (sorted by latest activity). */
export const CONVERSATION_LIST_LIMIT = 200;

export const MESSAGES_DEFAULT_LIMIT = 50;
export const MESSAGES_MAX_LIMIT = 100;

/** Unique key of the direct conversation between two users: "minId:maxId". */
export function toDirectKey(userA: number, userB: number): string {
  return `${Math.min(userA, userB)}:${Math.max(userA, userB)}`;
}
