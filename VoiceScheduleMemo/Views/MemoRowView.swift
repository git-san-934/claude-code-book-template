import SwiftUI

struct MemoRowView: View {
    let memo: ScheduleMemo

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale.current
        return f
    }()

    private var isOverdue: Bool {
        !memo.isCompleted && memo.scheduledDate < Date()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: statusIcon)
                .foregroundStyle(statusColor)
                .font(.title3)

            VStack(alignment: .leading, spacing: 4) {
                Text(memo.title.isEmpty ? "無題のメモ" : memo.title)
                    .font(.headline)
                    .strikethrough(memo.isCompleted)

                Text(memo.transcript)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                Text(Self.formatter.string(from: memo.scheduledDate))
                    .font(.caption)
                    .foregroundStyle(isOverdue ? .red : .secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusIcon: String {
        if memo.isCompleted { return "checkmark.circle.fill" }
        return isOverdue ? "exclamationmark.circle.fill" : "clock"
    }

    private var statusColor: Color {
        if memo.isCompleted { return .green }
        return isOverdue ? .red : .accentColor
    }
}
