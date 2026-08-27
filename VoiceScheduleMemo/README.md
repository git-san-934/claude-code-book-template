# VoiceScheduleMemo

自分の声でメモを話すと文字起こしされ、指定した日時になったらiPhoneの画面に通知として表示される、
音声メモ＋スケジュール管理アプリのSwiftUIソースコードです。

このセッションはmacOS/Xcodeが動かないLinuxコンテナ上で実行しているため、Xcodeプロジェクト
(`.xcodeproj`)自体はここには含まれていません。以下の手順でXcode上に組み込んでビルド・実行して
ください。

## 主な機能

1. **音声入力**: マイクボタンを押して話すと、Speechフレームワークでリアルタイムに文字起こしされます
   (`Services/SpeechRecorder.swift`)。文字起こし結果はあとから編集も可能です。
2. **スケジュール管理**: 文字起こしした内容に通知日時を設定して保存すると、SwiftDataで永続化されます
   (`Models/ScheduleMemo.swift`)。一覧は日時順に表示され、期限切れは赤色で強調されます。
3. **時間が来たら画面に表示**: `UNCalendarNotificationTrigger`でローカル通知をスケジュールし、
   アプリがフォアグラウンド・バックグラウンド・未起動のいずれでも、指定時刻にバナー通知が表示され
   ます (`Services/NotificationManager.swift`)。通知から「完了にする」「10分後に再通知」も操作でき
   ます。

## Xcodeでのセットアップ手順

1. Xcodeで **File > New > Project > iOS > App** を選択し、以下の設定で新規プロジェクトを作成します。
   - Product Name: `VoiceScheduleMemo`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **SwiftData** にチェック（`ScheduleMemo.swift`をそのまま使うため）
   - Minimum Deployment: **iOS 17.0** 以上（SwiftDataおよび新しい`onChange`/`ContentUnavailableView`
     APIを使用しています）
2. 生成されたプロジェクトの `App`, `Models`, `Services`, `Views` に相当するデフォルトファイル
   （`ContentView.swift`, `Item.swift` など）を削除し、代わりにこのフォルダ内の
   `App/`, `Models/`, `Services/`, `Views/` 配下のファイルをXcodeのプロジェクトナビゲータへ
   ドラッグ＆ドロップして追加してください（"Copy items if needed"にチェック）。
3. **Info.plist に権限説明キーを追加**します。`Resources/InfoPlist-Additions.plist` の内容
   （`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`）を、
   Target の **Info** タブ（またはInfo.plist）にコピーしてください。この説明文がないと、
   マイク・音声認識の許可ダイアログでアプリがクラッシュします。
4. Target の **Signing & Capabilities** で通常のSigningを設定してください。ローカル通知のみを
   使用しているため、Push Notifications capabilityは不要です。
5. 実機（推奨）またはシミュレータでビルド・実行します。
   - 音声認識・マイクは実機で最も安定して動作します。シミュレータではマイク入力が使えない場合が
     あります。
   - 初回起動時に通知許可・マイク許可・音声認識許可のダイアログが表示されるので、すべて許可して
     ください。

## ファイル構成

```
VoiceScheduleMemo/
├── App/
│   └── VoiceScheduleMemoApp.swift   # アプリのエントリーポイント。起動時に通知の設定・許可要求を行う
├── Models/
│   └── ScheduleMemo.swift           # SwiftDataモデル（タイトル・文字起こし・日時・音声ファイル名など）
├── Services/
│   ├── SpeechRecorder.swift         # 録音＋リアルタイム音声認識（AVAudioEngine + Speech）
│   ├── NotificationManager.swift    # ローカル通知のスケジュール・表示・アクション処理
│   └── AudioStore.swift             # 録音した音声ファイルの保存・読み込み
├── Views/
│   ├── ContentView.swift            # メモ一覧画面
│   ├── MemoRowView.swift            # 一覧の行（期限切れ・完了の色分け）
│   ├── RecordMemoView.swift         # 新規メモ作成画面（録音・文字起こし編集・日時設定）
│   └── MemoDetailView.swift         # メモ詳細画面（編集・再生・完了切り替え）
└── Resources/
    └── InfoPlist-Additions.plist    # Info.plistに追加が必要なキーのサンプル
```

## 動作の流れ

1. 一覧画面右上の＋ボタンをタップ → 録音画面へ。
2. マイクボタンをタップして話す → リアルタイムに文字起こしされたテキストが表示される。
3. 停止して、必要なら文字を編集し、通知したい日時を選んで保存。
4. 保存と同時に、その日時に鳴るローカル通知がスケジュールされる。
5. 指定した時刻になると、アプリがどの状態でもiPhoneの画面にバナー通知（タイトル＋文字起こし内容）
   が表示される。通知から直接「完了にする」「10分後に再通知」を選ぶことも可能。
6. 一覧に戻ると、期限切れの未完了メモは赤色で強調表示される。

## 既知の制限・今後の拡張案

- 現在は音声認識でリアルタイム変換したテキストをそのまま使っています。あとから文字起こしをやり直す
  機能（保存済み音声を再認識）は含まれていません。
- 通知はローカル通知のみのため、複数端末間での同期は行っていません。iCloud同期が必要な場合は
  SwiftDataの `ModelConfiguration(cloudKitDatabase:)` などの追加設定が必要です。
- 繰り返しスケジュール（毎日・毎週など）には対応していません。`ScheduleMemo`に繰り返しルールを
  追加し、`NotificationManager`で`UNCalendarNotificationTrigger(repeats: true)`相当の処理を
  実装することで拡張できます。
