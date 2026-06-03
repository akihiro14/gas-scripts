# gas-scripts

## プロジェクト概要

Google Apps Script（GAS）スクリプト集。業務自動化やGoogleサービス連携のスクリプトを管理する。

## 技術スタック

- Google Apps Script（GAS）
- clasp（CLIでGASをローカル開発・デプロイするツール）

## ディレクトリ構成

```
gas-scripts/
├── CLAUDE.md       # このファイル
└── .gitignore      # Gitの除外設定
```

## 環境変数

`.env` ファイルに以下を設定（Gitには含めない）:

```
# 必要に応じて追加
```

## 開発コマンド

```bash
clasp login          # Googleアカウントでログイン
clasp push           # ローカルのコードをGASにアップロード
clasp pull           # GASのコードをローカルにダウンロード
clasp deploy         # デプロイ
```

## Git運用ルール

- コードを変更するたびに、変更内容をコミットしてGitHubにプッシュする
- コミットメッセージは変更内容が分かる日本語で記載する
- リモートリポジトリ: `git@github.com:akihiro14/gas-scripts.git`

## 回答ルール

- 回答するたびにこのCLAUDE.mdを最新の状態に更新する
