import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \ScheduleMemo.scheduledDate) private var memos: [ScheduleMemo]
    @State private var isPresentingRecorder = false

    var body: some View {
        NavigationStack {
            Group {
                if memos.isEmpty {
                    ContentUnavailableView(
                        "メモがありません",
                        systemImage: "mic.slash",
                        description: Text("右上の＋ボタンから音声メモを追加しましょう")
                    )
                } else {
                    List {
                        ForEach(memos) { memo in
                            NavigationLink(value: memo) {
                                MemoRowView(memo: memo)
                            }
                        }
                        .onDelete(perform: deleteMemos)
                    }
                }
            }
            .navigationTitle("音声スケジュールメモ")
            .navigationDestination(for: ScheduleMemo.self) { memo in
                MemoDetailView(memo: memo)
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isPresentingRecorder = true
                    } label: {
                        Label("新規メモ", systemImage: "mic.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $isPresentingRecorder) {
                RecordMemoView()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .scheduleMemoNotificationAction)) { note in
            handleNotificationAction(note)
        }
    }

    private func handleNotificationAction(_ note: Notification) {
        guard let actionID = note.userInfo?["actionID"] as? String,
              let memoIDString = note.userInfo?["memoID"] as? String,
              let memoID = UUID(uuidString: memoIDString),
              let memo = memos.first(where: { $0.id == memoID }) else { return }

        switch actionID {
        case NotificationManager.doneActionID:
            memo.isCompleted = true
            NotificationManager.shared.cancelNotification(for: memo)
        case NotificationManager.snoozeActionID:
            memo.scheduledDate = Date().addingTimeInterval(10 * 60)
            memo.isCompleted = false
            NotificationManager.shared.scheduleNotification(for: memo)
        default:
            break
        }
    }

    private func deleteMemos(at offsets: IndexSet) {
        for index in offsets {
            let memo = memos[index]
            NotificationManager.shared.cancelNotification(for: memo)
            if let audioFileName = memo.audioFileName {
                AudioStore.remove(fileName: audioFileName)
            }
            modelContext.delete(memo)
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: ScheduleMemo.self, inMemory: true)
}
