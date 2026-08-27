import Foundation
import SwiftData

@Model
final class ScheduleMemo {
    var id: UUID
    var title: String
    var transcript: String
    var createdAt: Date
    var scheduledDate: Date
    var audioFileName: String?
    var isCompleted: Bool

    init(
        title: String = "",
        transcript: String,
        scheduledDate: Date,
        audioFileName: String? = nil
    ) {
        self.id = UUID()
        self.title = title
        self.transcript = transcript
        self.createdAt = Date()
        self.scheduledDate = scheduledDate
        self.audioFileName = audioFileName
        self.isCompleted = false
    }

    /// 通知のスケジュール変更・キャンセル時に、常に同じ通知を指し示すための識別子。
    var notificationID: String { "schedule-memo-\(id.uuidString)" }
}
