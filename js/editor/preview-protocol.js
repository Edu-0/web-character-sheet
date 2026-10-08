export const PREVIEW_PROTOCOL = 1;
export function previewMessage(type, context, payload = {}) { return {type,protocol:PREVIEW_PROTOCOL,...context,...payload}; }
export function matchesPreview(message, context, types) {
  return message && message.protocol===PREVIEW_PROTOCOL && types.includes(message.type) && ['sessionId','generation','revision','layoutId'].every(key=>message[key]===context[key]);
}
