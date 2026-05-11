const OVERLAY_PREFIX = "unichat:overlay:";

export function overlayFilterOverrideKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:filter_override`;
}

export function overlayCustomCssKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:custom_css`;
}

export function overlayChannelIdsKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:channel_ids`;
}

export function overlayMaxMessagesKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:max_messages`;
}

export function overlayTextSizeKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:text_size`;
}

export function overlayAnimationTypeKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:animation_type`;
}

export function overlayAnimationDirectionKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:animation_direction`;
}

export function overlayTransparentBgKey(widgetId: string): string {
  return `${OVERLAY_PREFIX}${widgetId}:transparent_bg`;
}
