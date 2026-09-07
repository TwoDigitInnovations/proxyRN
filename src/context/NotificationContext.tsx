import React, { createContext, useContext, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Text';
import { colors } from '../theme/colors';
import moment from 'moment';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning';
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  openNotificationTray: () => void;
  closeNotificationTray: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'init-1',
      title: 'Welcome to Proxi',
      message: 'Locate nearby agencies, check live queue status & book tickets remotely.',
      timestamp: new Date().toISOString(),
      read: false,
      type: 'info',
    },
  ]);
  const [trayVisible, setTrayVisible] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  function addNotification(title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') {
    const item: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      type,
    };
    setNotifications(prev => [item, ...prev]);
  }

  function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function openNotificationTray() {
    markAllAsRead();
    setTrayVisible(true);
  }

  function closeNotificationTray() {
    setTrayVisible(false);
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAllAsRead,
        clearNotifications,
        openNotificationTray,
        closeNotificationTray,
      }}>
      {children}

      <Modal visible={trayVisible} animationType="slide" transparent onRequestClose={closeNotificationTray}>
        <Pressable style={styles.overlay} onPress={closeNotificationTray}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('Notifications & Reminders')}</Text>
              {notifications.length > 0 ? (
                <TouchableOpacity onPress={clearNotifications}>
                  <Text style={styles.clearText}>{t('Clear All')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{t('No notifications yet')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
                {notifications.map(item => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{t(item.title)}</Text>
                      <Text style={styles.timeText}>{moment(item.timestamp).fromNow()}</Text>
                    </View>
                    <Text style={styles.cardMsg}>{t(item.message)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={closeNotificationTray}>
              <Text style={styles.closeBtnText}>{t('Close')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

export function NotificationBellButton() {
  const { unreadCount, openNotificationTray } = useNotifications();

  return (
    <TouchableOpacity style={styles.bellBtn} onPress={openNotificationTray}>
      <Text style={styles.bellIcon}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textDarker },
  clearText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: colors.gray, fontSize: 14 },
  scrollList: { maxHeight: 400 },
  scrollContent: { gap: 12 },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.backgroundLightAlt },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textDarker, flex: 1 },
  timeText: { fontSize: 11, color: colors.gray, marginLeft: 8 },
  cardMsg: { fontSize: 13, color: colors.textDark, lineHeight: 18 },
  closeBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  closeBtnText: { color: colors.gray, fontSize: 14, fontWeight: '600' },
  bellBtn: { position: 'relative', padding: 6 },
  bellIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
});
