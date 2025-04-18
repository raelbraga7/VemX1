'use client';

import { BellIcon } from '@heroicons/react/24/outline';

interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
}

export default function NotificationBell({ count = 0, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-[#1d4ed8]/10 transition-colors"
      aria-label="Notificações"
    >
      <BellIcon className="h-6 w-6 text-white" />
      {count > 0 && (
        <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1d4ed8] text-xs font-medium text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
} 