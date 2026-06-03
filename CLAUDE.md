# gas-scripts

## プロジェクト概要

Google Apps Script（GAS）スクリプト集。業務自動化やGoogleサービス連携のスクリプトを管理する。

## 技術スタック

- Google Apps Script（GAS）
- clasp（CLIでGASをローカル開発・デプロイするツール）

## ディレクトリ構成

```
gas-scripts/
├── CLAUDE.md                # このファイル
├── .gitignore               # Gitの除外設定
├── summary_dashboard.gs     # 売上データ月次サマリー集計ダッシュボード
└── email_classifier.gs      # Gmail メール自動分類・記録・通知スクリプト
```

## スクリプト一覧

### email_classifier.gs

Gmailの「要処理」ラベル付き未読メールをClaude APIで分類・要約し、スプレッドシートへの記録とSlack通知を行う。

| 関数 | 説明 |
|------|------|
| `classifyEmails()` | メイン処理。未読メールを取得して分類・記録・通知を実行 |
| `processEmail(message, thread, ...)` | 1件のメールを処理（分類→記録→通知→ラベル付け替え） |
| `classifyWithClaude(body, subject, apiKey)` | Claude APIでメールを分類・要約してJSONで返す |
| `logToSheet(date, sender, subject, ...)` | 「メールログ」シートに結果を追記 |
| `notifySlack(webhookUrl, ...)` | Slack Incoming Webhookで通知を送信 |
| `logError(message)` | 「エラーログ」シートにエラーを記録 |
| `setFiveMinuteTrigger()` | 5分おきの自動実行トリガーを登録（一度だけ手動実行） |

**スクリプトプロパティの設定（必須）：**

| プロパティ名 | 内容 |
|---|---|
| `CLAUDE_API_KEY` | Anthropic APIキー（`sk-ant-` で始まる文字列） |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL（未設定時は通知スキップ） |

**使用モデル：** `claude-haiku-4-5-20251001`（コスト最適化）

**分類カテゴリ：** クレーム / 質問 / 注文 / その他

### summary_dashboard.gs

Googleスプレッドシートの売上データを月次集計し、サマリーシートへの書き込みと棒グラフ作成を行う。

| 関数 | 説明 |
|------|------|
| `updateSummaryDashboard()` | メイン処理。集計・書き込み・グラフ作成を一括実行 |
| `aggregateByMonth(dataSheet)` | 売上データを月ごとに合計売上・件数で集計 |
| `writeSummarySheet(ss, monthlyData)` | 「月次サマリー」シートをクリアして集計結果を書き込み |
| `createBarChart(ss)` | 月次推移の縦棒グラフを作成・更新 |
| `setDailyTrigger()` | 毎朝9時の自動実行トリガーを登録（GASエディタで一度だけ手動実行） |

**対象スプレッドシートのシート構成：**

- 「売上データ」シート：A列=日付、B列=担当者名、C列=商品名、D列=金額
- 「月次サマリー」シート：A列=月、B列=合計売上、C列=件数（自動生成）

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
