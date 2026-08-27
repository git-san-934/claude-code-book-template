import Foundation

/// 録音した音声ファイルを、一時ディレクトリからアプリのDocuments配下へ永続保存するためのヘルパー。
enum AudioStore {
    private static var directory: URL {
        let dir = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("VoiceMemos", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    @discardableResult
    static func persist(temporaryURL: URL) throws -> String {
        let fileName = temporaryURL.lastPathComponent
        let destination = directory.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporaryURL, to: destination)
        return fileName
    }

    static func url(for fileName: String) -> URL {
        directory.appendingPathComponent(fileName)
    }

    static func remove(fileName: String) {
        try? FileManager.default.removeItem(at: url(for: fileName))
    }
}
