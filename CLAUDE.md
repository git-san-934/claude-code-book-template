# CLAUDE.md

このリポジトリで作業する際のルールです。個人開発のプロジェクトなので、重い承認プロセスは設けず、素早く直して確認する運用にしています。

## プロジェクト概要

音声で外食の記録（日付・店名・ジャンル・食事の種類・金額・メモ）を管理するWebアプリ。
ビルド不要の静的サイト（HTML/CSS/バニラJS）。バックエンドはなく、記録はブラウザのlocalStorageにのみ保存する。

## ファイル構成

- `index.html` — ページ構造
- `style.css` — スタイル
- `app.js` — 音声認識・解析・履歴のCRUD・集計・バックアップ処理
- `manifest.webmanifest` — iPhoneの「ホーム画面に追加」対応
- `.github/workflows/deploy-pages.yml` — GitHub Pagesへの自動デプロイ

## 開発の進め方

- 要望を聞いたら、原則そのまま実装 → ローカルで動作確認 → PR作成 → ユーザーの確認後にマージ、の流れで進める
- 事前に要件定義書や設計書を作る必要はない。会話の中で決まったことがそのまま仕様
- 1機能1PRを目安にする（大きくなりすぎたら分割）

## 公開・デプロイ

- 公開URL: `https://git-san-934.github.io/claude-code-book-template/`
- `main`ブランチにマージされると`deploy-pages.yml`が自動でGitHub Pagesにデプロイする
- 作業ブランチ: `claude/voice-dining-history-k1h78e`（PRがマージ済みなら、次の変更前に`git fetch origin main && git checkout -B claude/voice-dining-history-k1h78e origin/main`で最新mainから作り直す。マージ済みの履歴の上に積み重ねない）

## キャッシュ対策（重要）

`index.html`から読み込む`app.js`・`style.css`には`?v=数字`が付いている。
**`app.js`または`style.css`を変更したら、`index.html`内の該当する`?v=`の数字を1つ上げること。**
上げ忘れると、ブラウザ（特にiPhone Safari）が古いバージョンをキャッシュしたまま使い続けてしまう。

## テスト

自動テストのフレームワークは入っていない。変更のたびに、Playwrightで簡易スモークテストを行ってから
PRを作成する（既存の手動CRUD・音声3状態フロー・音声解析のパターンが壊れていないか確認）。
ローカル確認は `python3 -m http.server <port> --directory <リポジトリパス>` で行う。

## 音声解析（app.js の parseTranscript）

- 日付・金額は全角数字（iPhoneの音声入力で出やすい）にも対応するため、解析前に半角へ正規化している
- 「店名は〇〇」「メモ△△」のように明示的に言われた場合はそれを最優先で使う。明示指定がなければ、
  「〇〇で」のような言い回しからヒューリスティックに店名を推測する
- ジャンル・食事の種類（朝食/ランチ/ディナー/間食）はキーワード一致。増やす場合は`GENRES`・
  `MEAL_TYPE_PATTERNS`に追記する

## データについて

- 記録はサーバーに送信されず、端末のブラウザ内（localStorage）にのみ保存される
- バックアップは「エクスポート/インポート」ボタンでJSONファイルの書き出し・読み込みが可能（IDが一致する記録は上書き、それ以外は追加するマージ方式）
