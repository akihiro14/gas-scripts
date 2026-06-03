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
└── summary_dashboard.gs     # 売上データ月次サマリー集計ダッシュボード
```

## スクリプト一覧

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
