import SwiftUI

struct RecordMemoView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @StateObject private var recorder = SpeechRecorder()
    @State private var scheduledDate = Date().addingTimeInterval(600)
    @State private var editedTranscript = ""
    @State private var permissionDenied = false

    var body: some View {
        NavigationStack {
            Form {
                Section("録音") {
                    Button {
                        Task { await toggleRecording() }
                    } label: {
                        Label(
                            recorder.isRecording ? "録音を停止" : "録音を開始",
                            systemImage: recorder.isRecording ? "stop.circle.fill" : "mic.circle.fill"
                        )
                        .font(.title3)
                    }

                    if recorder.isRecording {
                        Text("聞き取り中…")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("内容（あとから編集できます）") {
                    TextEditor(text: $editedTranscript)
                        .frame(minHeight: 120)
                }

                Section("通知する日時") {
                    DatePicker("日時", selection: $scheduledDate, in: Date()...)
                        .datePickerStyle(.graphical)
                }

                if let error = recorder.authorizationError {
                    Section {
                        Text(error).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("新しい音声メモ")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") {
                        recorder.stopRecording()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        save()
                    }
                    .disabled(editedTranscript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onChange(of: recorder.transcript) { _, newValue in
                editedTranscript = newValue
            }
        }
    }

    private func toggleRecording() async {
        if recorder.isRecording {
            recorder.stopRecording()
            return
        }
        let granted = await recorder.requestPermissions()
        guard granted else {
            permissionDenied = true
            return
        }
        do {
            try recorder.startRecording()
        } catch {
            recorder.authorizationError = error.localizedDescription
        }
    }

    private func save() {
        recorder.stopRecording()
        let transcript = editedTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = String(transcript.prefix(20))

        var savedAudioFileName: String?
        if let recordedURL = recorder.recordedAudioURL {
            savedAudioFileName = try? AudioStore.persist(temporaryURL: recordedURL)
        }

        let memo = ScheduleMemo(
            title: title,
            transcript: transcript,
            scheduledDate: scheduledDate,
            audioFileName: savedAudioFileName
        )
        modelContext.insert(memo)
        NotificationManager.shared.scheduleNotification(for: memo)
        dismiss()
    }
}
