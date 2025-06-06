
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTransactionsForUser } from '@/lib/databaseService';
import type { Transaction, NotificationItem } from '@/types';
import { startOfDay, addDays, isWithinInterval, parseISO } from 'date-fns';

const NOTIFICATION_WINDOW_DAYS_BEFORE = 7;
const NOTIFICATION_WINDOW_DAYS_AFTER = 7;
const NOTIFICATION_STORAGE_KEY_PREFIX = 'readNotifications_';

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
      const startDate = addDays(today, -NOTIFICATION_WINDOW_DAYS_BEFORE);
      const endDate = addDays(today, NOTIFICATION_WINDOW_DAYS_AFTER);

      const relevantNotifications: NotificationItem[] = transactions
        .filter(tx => {
          const txDate = startOfDay(parseISO(tx.date));
          return isWithinInterval(txDate, { start: startDate, end: endDate });
        })
        .map(tx => ({
          id: `tx-${tx.id}`, // Make notification ID distinct, e.g., if other types of notifications are added later
          type: 'transaction',
          relatedId: tx.id,
          message: `${tx.type === 'income' ? 'Receita' : 'Despesa'}: ${tx.description || tx.category} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}`,
          date: tx.date,
          isRead: readIds.includes(`tx-${tx.id}`),
          originalTransaction: tx,
        }))
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

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
    setAllNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    const readIds = loadReadStatuses();
    if (!readIds.includes(notificationId)) {
      saveReadStatuses([...readIds, notificationId]);
    }
    setUnreadCount(prev => Math.max(0, prev -1));
  }, [loadReadStatuses, saveReadStatuses]);

  const markAllAsRead = useCallback(() => {
    setAllNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    const allCurrentNotificationIds = allNotifications.map(n => n.id);
    saveReadStatuses(allCurrentNotificationIds);
    setUnreadCount(0);
  }, [allNotifications, saveReadStatuses]);

  return {
    notifications: allNotifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchAndProcessNotifications, // Expose a refresh function
  };
}
