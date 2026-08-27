import Foundation
import UserNotifications

/// スケジュールした日時が来たらローカル通知としてiPhoneの画面に表示するためのマネージャー。
/// フォアグラウンド中でもバナーを出す（willPresent）ことで、アプリを開いていても確実に通知が見える。
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()

    static let doneActionID = "MARK_DONE"
    static let snoozeActionID = "SNOOZE_10MIN"
    static let categoryID = "SCHEDULE_MEMO"

    private override init() {
        super.init()
    }

    /// アプリ起動時に一度呼び出す。デリゲート登録と通知アクション（完了・スヌーズ）の定義を行う。
    func configure() {
        UNUserNotificationCenter.current().delegate = self

        let doneAction = UNNotificationAction(identifier: Self.doneActionID, title: "完了にする", options: [])
        let snoozeAction = UNNotificationAction(identifier: Self.snoozeActionID, title: "10分後に再通知", options: [])
        let category = UNNotificationCategory(
            identifier: Self.categoryID,
            actions: [doneAction, snoozeAction],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func scheduleNotification(for memo: ScheduleMemo) {
        let content = UNMutableNotificationContent()
        content.title = memo.title.isEmpty ? "音声メモの予定" : memo.title
        content.body = memo.transcript
        content.sound = .default
        content.categoryIdentifier = Self.categoryID
        content.userInfo = ["memoID": memo.id.uuidString]

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: memo.scheduledDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: memo.notificationID, content: content, trigger: trigger)

        // 既存の通知を上書きするため、まず取り消してから登録し直す。
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [memo.notificationID])
        UNUserNotificationCenter.current().add(request)
    }

    func cancelNotification(for memo: ScheduleMemo) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [memo.notificationID])
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// アプリがフォアグラウンドにあっても、バナーと音で通知を表示する。
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    /// 通知のアクション（完了にする／スヌーズ）や通知タップをアプリ側に伝える。
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let memoIDString = response.notification.request.content.userInfo["memoID"] as? String
        NotificationCenter.default.post(
            name: .scheduleMemoNotificationAction,
            object: nil,
            userInfo: [
                "actionID": response.actionIdentifier,
                "memoID": memoIDString as Any
            ]
        )
    }
}

extension Notification.Name {
    static let scheduleMemoNotificationAction = Notification.Name("scheduleMemoNotificationAction")
}
