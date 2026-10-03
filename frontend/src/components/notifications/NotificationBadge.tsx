import React, { useState, useEffect } from 'react';
import { getUnreadCount } from '@/api/notifications';

export interface NotificationBadgeProps {
  /** Optional controlled count. If not provided, the badge can fetch unread count automatically. */
  count?: number;
  /** Whether to render badge when count is 0 (defaults to false). */
  showZero?: boolean;
  /** Additional custom class names. */
  className?: string;
  /** Custom test ID for testing (defaults to 'unread-badge'). */
  dataTestId?: string;
  /** Maximum count before showing 99+ (defaults to 99). */
  maxCount?: number;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count: controlledCount,
  showZero = false,
  className = '',
  dataTestId = 'unread-badge',
  maxCount = 99,
}) => {
  const [internalCount, setInternalCount] = useState<number | null>(null);

  useEffect(() => {
    // Only fetch internally if count is undefined
    if (controlledCount !== undefined) return;

    let isMounted = true;
    const fetchCount = async () => {
      try {
        const res = await getUnreadCount();
        if (isMounted) {
          setInternalCount(res.unread_count);
        }
      } catch {
        // Quiet failure for badge
        if (isMounted) {
          setInternalCount(0);
        }
      }
    };

    fetchCount();

    return () => {
      isMounted = false;
    };
  }, [controlledCount]);

  const resolvedCount = controlledCount !== undefined ? controlledCount : (internalCount ?? 0);

  if (resolvedCount <= 0 && !showZero) {
    return null;
  }

  const displayCount = resolvedCount > maxCount ? `${maxCount}+` : resolvedCount;

  return (
    <span
      className={`cb-notification-badge ${className}`}
      data-testid={dataTestId}
      aria-label={`${resolvedCount} unread notifications`}
    >
      {displayCount}
    </span>
  );
};
