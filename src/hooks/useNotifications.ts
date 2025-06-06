
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTransactionsForUser } from '@/lib/databaseService';
import type { Transaction, NotificationItem, RecurrenceFrequency } from '@/types';
import { 
  startOfDay, 
  addDays, 
  isWithinInterval, 
  parseISO, 
  format as formatDateFns, 
  isBefore, 
  isSameDay,
  addWeeks,
  addMonths,
  addYears,
  getMonth,
  getYear,
  getDate,
  lastDayOfMonth
} from 'date-fns';

const NOTIFICATION_WINDOW_DAYS_BEFORE = 7; // Show past due scheduled items up to 7 days ago
const NOTIFICATION_WINDOW_DAYS_AFTER = 14; // Show upcoming scheduled items up to 14 days in future
const NOTIFICATION_STORAGE_KEY_PREFIX = 'readScheduledNotifications_';


// Helper function to get projected occurrences (similar to dashboard but adapted for notifications)
const getProjectedOccurrencesForNotifications = (
  transaction: Transaction,
  periodStart: Date, // Notification window start
  periodEnd: Date    // Notification window end
): { projectedDate: Date; isPast: boolean }[] => {
  const occurrences: { projectedDate: Date; isPast: boolean }[] = [];
  if (!transaction.recurrenceFrequency || transaction.recurrenceFrequency === 'none') {
    return occurrences;
  }

  const originalDate = parseISO(transaction.date);
  let currentDate = originalDate;
  const today = startOfDay(new Date());

  // Determine a safe starting point for iteration, no earlier than originalDate
  // and not excessively far in the past if periodStart is very old.
  let iterDate = originalDate;
  if (isBefore(iterDate, addYears(periodStart, -2))) { // Limit how far back we search
    iterDate = addYears(periodStart, -2);
     // Align iterDate to match originalDate's day/week characteristics for consistency
    if (transaction.recurrenceFrequency === 'monthly') {
      iterDate = new Date(getYear(iterDate), getMonth(iterDate), getDate(originalDate));
    } else if (transaction.recurrenceFrequency === 'annually') {
      iterDate = new Date(getYear(iterDate), getMonth(originalDate), getDate(originalDate));
    }
    // For weekly, alignment happens naturally in the loop.
  }


  for (let i = 0; i < 200; i++) { // Safety break after 200 iterations
    if (isAfter(iterDate, periodEnd)) break; // Stop if we've passed the notification window

    if (isWithinInterval(iterDate, { start: periodStart, end: periodEnd })) {
       occurrences.push({
        projectedDate: startOfDay(new Date(iterDate)), // Ensure it's start of day for comparison
        isPast: isBefore(iterDate, today) && !isSameDay(iterDate, today),
      });
    }
    
    // Advance iterDate to the next occurrence
    let advanced = false;
    switch (transaction.recurrenceFrequency) {
      case 'monthly':
        iterDate = addMonths(iterDate, 1);
        const dayOfMonth = getDate(originalDate);
        const lastDay = getDate(lastDayOfMonth(iterDate));
        iterDate = new Date(getYear(iterDate), getMonth(iterDate), Math.min(dayOfMonth, lastDay));
        advanced = true;
        break;
      case 'weekly':
        iterDate = addWeeks(iterDate, 1);
        advanced = true;
        break;
      case 'annually':
        iterDate = addYears(iterDate, 1);
        const annualDay = getDate(originalDate);
        const annualMonth = getMonth(originalDate);
        iterDate = new Date(getYear(iterDate), annualMonth, Math.min(annualDay, getDate(lastDayOfMonth(iterDate))));
        advanced = true;
        break;
      default: // Should not happen if pre-filtered
        return occurrences;
    }
    if (!advanced) break; // Safety for unknown frequency
    if (iterDate <= originalDate && i > 0 && transaction.recurrenceFrequency !== 'none') { 
        // If we somehow went back or stuck, break to prevent infinite loop, unless it's the first iteration.
        break;
    }
  }
  return occurrences;
};

// Helper to check if date b is after date a
function isAfter(dateA: Date, dateB: Date): boolean {
    return dateA.getTime() > dateB.getTime();
}


export function useNotifications() {
  const { user } = useAuth();
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const getStorageKey = useCallback(() => {
    return user ? `${NOTIFICATION_STORAGE_KEY_PREFIX}${user.id}` : null;
  }, [user]);

  const loadReadStatuses = useCallback((): string[] => {
    const storageKey = getStorageKey();
    if (!storageKey) return [];
    try {
      const storedReadIds = localStorage.getItem(storageKey);
      return storedReadIds ? JSON.parse(storedReadIds) : [];
    } catch (e) {
      console.error("Error reading read statuses from localStorage", e);
      return [];
    }
  }, [getStorageKey]);

  const saveReadStatuses = useCallback((readIds: string[]) => {
    const storageKey = getStorageKey();
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(readIds));
    } catch (e) {
      console.error("Error saving read statuses to localStorage", e);
    }
  }, [getStorageKey]);

  const fetchAndProcessNotifications = useCallback(async () => {
    if (!user) {
      setAllNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const transactions = await getTransactionsForUser(user.id);
      const readIds = loadReadStatuses();
      
      const today = startOfDay(new Date());
      const notificationWindowStart = addDays(today, -NOTIFICATION_WINDOW_DAYS_BEFORE);
      const notificationWindowEnd = addDays(today, NOTIFICATION_WINDOW_DAYS_AFTER);

      const relevantNotifications: NotificationItem[] = [];

      const recurringTransactions = transactions.filter(
        tx => tx.recurrenceFrequency && tx.recurrenceFrequency !== 'none'
      );

      recurringTransactions.forEach(tx => {
        const projectedOccurrences = getProjectedOccurrencesForNotifications(
          tx,
          notificationWindowStart,
          notificationWindowEnd
        );

        projectedOccurrences.forEach(occurrence => {
          const projectedDateString = formatDateFns(occurrence.projectedDate, 'yyyy-MM-dd');
          const notificationId = `tx-${tx.id}-${projectedDateString}`;
          
          relevantNotifications.push({
            id: notificationId,
            type: 'scheduled_transaction',
            relatedId: tx.id,
            message: `${tx.description || tx.category} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}`,
            projectedDate: projectedDateString,
            isRead: readIds.includes(notificationId),
            isPast: occurrence.isPast,
            originalTransaction: tx,
          });
        });
      });

      // Sort by projected date, then by original creation date as a fallback
      relevantNotifications.sort((a, b) => {
        const dateA = parseISO(a.projectedDate).getTime();
        const dateB = parseISO(b.projectedDate).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Most recent projected dates first
        }
        return b.originalTransaction.createdAt - a.originalTransaction.createdAt;
      });
      
      setAllNotifications(relevantNotifications);
      setUnreadCount(relevantNotifications.filter(n => !n.isRead).length);

    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setAllNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user, loadReadStatuses]);

  useEffect(() => {
    fetchAndProcessNotifications();
  }, [fetchAndProcessNotifications]);

  const markAsRead = useCallback((notificationId: string) => {
    let marked = false;
    setAllNotifications(prev =>
      prev.map(n => {
        if (n.id === notificationId && !n.isRead) {
          marked = true;
          return { ...n, isRead: true };
        }
        return n;
      })
    );
    if (marked) {
      const readIds = loadReadStatuses();
      if (!readIds.includes(notificationId)) {
        saveReadStatuses([...readIds, notificationId]);
      }
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [loadReadStatuses, saveReadStatuses]);

  const markAllAsRead = useCallback(() => {
    const unreadIds = allNotifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

    setAllNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    
    const currentReadIds = loadReadStatuses();
    const newReadIds = Array.from(new Set([...currentReadIds, ...unreadIds]));
    saveReadStatuses(newReadIds);
    setUnreadCount(0);
  }, [allNotifications, loadReadStatuses, saveReadStatuses]);

  return {
    notifications: allNotifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchAndProcessNotifications,
  };
}
