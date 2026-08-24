# GitHub Actions ワークフロー

このドキュメントでは、`.github/workflows` ディレクトリに配置されている GitHub Actions ワークフローの設定内容について説明します。

## 概要

このリポジトリには、[Claude Code Action](https://github.com/anthropics/claude-code-action) を利用した2つのワークフローが定義されています。

| ファイル | ワークフロー名 | 役割 |
| --- | --- | --- |
| [`claude.yml`](../.github/workflows/claude.yml) | Claude Code | Issue や PR 上で `@claude` にメンションすると Claude が応答・作業を行う |
| [`claude-code-review.yml`](../.github/workflows/claude-code-review.yml) | Claude Code Review | Pull Request が作成・更新された際に Claude が自動でコードレビューを行う |

両ワークフローとも `anthropics/claude-code-action@v1` を使用しており、認証には `secrets.CLAUDE_CODE_OAUTH_TOKEN` というリポジトリシークレットが必要です。

## `claude.yml`（Claude Code）

`@claude` へのメンションをトリガーに、Claude Code がリクエスト内容に応じて回答やコード変更を行うワークフローです。

### トリガー（`on`）

以下のいずれかのイベントで起動します。

- `issue_comment`（`created`）: Issue コメントが作成されたとき
- `pull_request_review_comment`（`created`）: PR のレビューコメントが作成されたとき
- `issues`（`opened`, `assigned`）: Issue が作成、またはアサインされたとき
- `pull_request_review`（`submitted`）: PR レビューが提出されたとき

### 実行条件（`if`）

ジョブ全体に条件が設定されており、以下のいずれかを満たす場合のみ実行されます。

- Issue コメント本文に `@claude` が含まれる
- PR レビューコメント本文に `@claude` が含まれる
- PR レビュー本文に `@claude` が含まれる
- Issue の本文またはタイトルに `@claude` が含まれる

これにより、`@claude` へのメンションがあった場合にのみジョブが実行され、無駄な実行を防いでいます。

### 権限（`permissions`）

| 権限 | 値 | 用途 |
| --- | --- | --- |
| `contents` | `read` | リポジトリの内容を読み取る |
| `pull-requests` | `read` | PR 情報を読み取る |
| `issues` | `read` | Issue 情報を読み取る |
| `id-token` | `write` | OIDC トークンの発行 |
| `actions` | `read` | PR 上の CI 結果を Claude が参照するために必要 |

### ジョブ内容（`steps`）

1. **Checkout repository**: `actions/checkout@v4` でリポジトリをチェックアウト（`fetch-depth: 1`）
2. **Run Claude Code**: `anthropics/claude-code-action@v1` を実行
   - `claude_code_oauth_token`: 認証用のシークレット
   - `additional_permissions`: `actions: read` を追加指定し、PR 上の CI 結果を読めるようにする
   - `prompt`（コメントアウト）: カスタムプロンプトを指定したい場合に使用。未指定の場合は `@claude` を含むコメント内の指示に従って動作する
   - `claude_args`（コメントアウト）: `--allowed-tools` などの追加オプションを指定可能

## `claude-code-review.yml`（Claude Code Review）

Pull Request の作成・更新をトリガーに、Claude が自動でコードレビューを行うワークフローです。

### トリガー（`on`）

- `pull_request`（`opened`, `synchronize`, `ready_for_review`, `reopened`）
  - PR が作成、コミット追加による更新、Draft から Ready への変更、再オープンされたときに起動
  - 特定のファイルパス（`src/**/*.ts` など）のみを対象にする `paths` フィルタはコメントアウトされており、現状は無効

### 実行条件（`if`）

ジョブに条件は設定されておらず（コメントアウトされている）、`on` のトリガー条件を満たせば常に実行されます。コメントアウトされた例では、PR作成者でフィルタする方法（特定ユーザーや初回コントリビューターのみレビュー対象にするなど）が示されています。

### 権限（`permissions`）

| 権限 | 値 | 用途 |
| --- | --- | --- |
| `contents` | `read` | リポジトリの内容を読み取る |
| `pull-requests` | `read` | PR 情報を読み取る |
| `issues` | `read` | Issue 情報を読み取る |
| `id-token` | `write` | OIDC トークンの発行 |

### ジョブ内容（`steps`）

1. **Checkout repository**: `actions/checkout@v4` でリポジトリをチェックアウト（`fetch-depth: 1`）
2. **Run Claude Code Review**: `anthropics/claude-code-action@v1` を実行
   - `claude_code_oauth_token`: 認証用のシークレット
   - `plugin_marketplaces`: `https://github.com/anthropics/claude-code.git` を Claude Code のプラグインマーケットプレイスとして指定
   - `plugins`: `code-review@claude-code-plugins` プラグインを使用
   - `prompt`: `/code-review:code-review --comment <owner>/<repo>/pull/<PR番号>` を実行し、レビュー結果を PR にインラインコメントとして投稿
   - `claude_args`: `--allowedTools "mcp__github_inline_comment__create_inline_comment"` を指定し、インラインコメント投稿ツールの使用を許可

## 共通の前提条件

- リポジトリのシークレットに `CLAUDE_CODE_OAUTH_TOKEN`（Claude Code の OAuth トークン）が設定されている必要があります。
- 両ワークフローとも `anthropics/claude-code-action@v1` に依存しています。詳細なオプションは [claude-code-action の usage ドキュメント](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md) や [Claude Code CLI リファレンス](https://code.claude.com/docs/en/cli-reference) を参照してください。

## 関連ドキュメント

- [claude-code-action リポジトリ](https://github.com/anthropics/claude-code-action)
- [claude-code-action usage ドキュメント](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)
- [Claude Code CLI リファレンス](https://code.claude.com/docs/en/cli-reference)
