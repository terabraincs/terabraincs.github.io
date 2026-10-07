// UTF-8. Web-only copy policy: preserve the extracted client strings unchanged.
export const CAFE_STREGA_EVENT_EXPIRY_NOTICE = '해당 아이템은 이벤트 종료 이후 삭제됩니다.';
/** Removes only the event-expiry sentence when it is the final description line. */
export function cafeStregaDisplayItemDescription(description: string): string {
    if (description === CAFE_STREGA_EVENT_EXPIRY_NOTICE)
        return '';
    const windowsSuffix = `\r\n${CAFE_STREGA_EVENT_EXPIRY_NOTICE}`;
    if (description.endsWith(windowsSuffix))
        return description.slice(0, -windowsSuffix.length);
    const suffix = `\n${CAFE_STREGA_EVENT_EXPIRY_NOTICE}`;
    return description.endsWith(suffix) ? description.slice(0, -suffix.length) : description;
}
