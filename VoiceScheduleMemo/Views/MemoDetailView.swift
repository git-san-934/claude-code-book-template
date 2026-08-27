import AVFoundation
import SwiftUI

struct MemoDetailView: View {
    @Bindable var memo: ScheduleMemo

    @State private var player: AVAudioPlayer?
    @State private var isPlaying = false

    var body: some View {
        Form {
            Section("内容") {
                TextEditor(text: $memo.transcript)
                    .frame(minHeight: 100)
            }

            Section("通知する日時") {
                DatePicker("日時", selection: $memo.scheduledDate)
                    .onChange(of: memo.scheduledDate) { _, _ in
                        if !memo.isCompleted {
                            NotificationManager.shared.scheduleNotification(for: memo)
                        }
                    }
            }

            if memo.audioFileName != nil {
                Section("録音") {
                    Button {
                        togglePlayback()
                    } label: {
                        Label(isPlaying ? "停止" : "再生", systemImage: isPlaying ? "stop.fill" : "play.fill")
                    }
                }
            }

            Section {
                Toggle("完了", isOn: $memo.isCompleted)
                    .onChange(of: memo.isCompleted) { _, completed in
                        if completed {
                            NotificationManager.shared.cancelNotification(for: memo)
                        } else {
                            NotificationManager.shared.scheduleNotification(for: memo)
                        }
                    }
            }
        }
        .navigationTitle(memo.title.isEmpty ? "メモ" : memo.title)
    }

    private func togglePlayback() {
        if isPlaying {
            player?.stop()
            isPlaying = false
            return
        }
        guard let fileName = memo.audioFileName else { return }
        let url = AudioStore.url(for: fileName)
        do {
            let newPlayer = try AVAudioPlayer(contentsOf: url)
            player = newPlayer
            newPlayer.play()
            isPlaying = true
        } catch {
            isPlaying = false
        }
    }
}
