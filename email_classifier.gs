// ===================================================
// Gmail メール自動分類・記録・通知スクリプト
// ===================================================

// 定数
var LABEL_TO_PROCESS = "要処理";
var LABEL_PROCESSED  = "処理済み";
var LOG_SHEET_NAME   = "メールログ";
var ERROR_SHEET_NAME = "エラーログ";
var CLAUDE_MODEL     = "claude-haiku-4-5-20251001";
var CLAUDE_API_URL   = "https://api.anthropic.com/v1/messages";

/**
 * メイン処理：「要処理」ラベルの未読メールを取得して分類・記録・通知する
 * 5分おきのトリガーから自動実行される
 */
function classifyEmails() {
  // スクリプトプロパティからAPIキーを取得
  var props          = PropertiesService.getScriptProperties();
  var claudeApiKey   = props.getProperty("CLAUDE_API_KEY");
  var slackWebhookUrl = props.getProperty("SLACK_WEBHOOK_URL");

  if (!claudeApiKey) {
    logError("CLAUDE_API_KEY がスクリプトプロパティに設定されていません。");
    return;
  }

  // 「要処理」ラベルを取得
  var label = GmailApp.getUserLabelByName(LABEL_TO_PROCESS);
  if (!label) {
    logError("「" + LABEL_TO_PROCESS + "」ラベルが見つかりません。Gmailで作成してください。");
    return;
  }

  // ラベルがついたスレッドを取得
  var threads = label.getThreads();

  for (var i = 0; i < threads.length; i++) {
    var thread   = threads[i];
    var messages = thread.getMessages();

    for (var j = 0; j < messages.length; j++) {
      var message = messages[j];

      // 未読メールのみ処理対象
      if (!message.isUnread()) continue;

      try {
        processEmail(message, thread, claudeApiKey, slackWebhookUrl);
      } catch (e) {
        logError("メール処理中にエラー発生: " + e.message + "（件名: " + message.getSubject() + "）");
      }
    }
  }

  Logger.log("メール分類処理が完了しました。");
}

/**
 * 1件のメールを分類・記録・通知・ラベル付け替えする
 * @param {GmailMessage} message - 処理対象のメール
 * @param {GmailThread}  thread  - メールが属するスレッド
 * @param {string} claudeApiKey   - Claude APIキー
 * @param {string} slackWebhookUrl - Slack Webhook URL（未設定の場合は通知スキップ）
 */
function processEmail(message, thread, claudeApiKey, slackWebhookUrl) {
  var subject = message.getSubject();
  var sender  = message.getFrom();
  var date    = message.getDate();
  var body    = message.getPlainBody();

  // 本文が長すぎる場合は先頭2000文字に制限（APIコスト削減）
  if (body.length > 2000) {
    body = body.substring(0, 2000) + "...（以下省略）";
  }

  // Claude APIで分類・要約を実行
  var result = classifyWithClaude(body, subject, claudeApiKey);

  // スプレッドシートの「メールログ」シートに記録
  logToSheet(date, sender, subject, result.category, result.summary);

  // SLACK_WEBHOOK_URLが設定されている場合のみSlack通知
  if (slackWebhookUrl) {
    notifySlack(slackWebhookUrl, subject, sender, result.category, result.summary);
  }

  // 「処理済み」ラベルがなければ作成
  var processedLabel = GmailApp.getUserLabelByName(LABEL_PROCESSED);
  if (!processedLabel) {
    processedLabel = GmailApp.createLabel(LABEL_PROCESSED);
  }

  // ラベルを付け替える（「要処理」を外して「処理済み」を追加）
  thread.addLabel(processedLabel);
  thread.removeLabel(GmailApp.getUserLabelByName(LABEL_TO_PROCESS));

  // 既読にする
  message.markRead();

  Logger.log("処理完了: " + subject + " → 分類: " + result.category);
}

/**
 * Claude APIにメール本文を送り、分類と要約をJSON形式で受け取る
 * @param {string} body     - メール本文
 * @param {string} subject  - 件名
 * @param {string} apiKey   - Claude APIキー
 * @return {{category: string, summary: string}} 分類と要約
 */
function classifyWithClaude(body, subject, apiKey) {
  var prompt =
    "以下のメールを分析して、JSONのみで回答してください。\n\n" +
    "【件名】\n" + subject + "\n\n" +
    "【本文】\n" + body + "\n\n" +
    "以下のJSON形式で回答してください（説明文は不要。JSONのみ出力）:\n" +
    '{"category": "クレーム" または "質問" または "注文" または "その他", ' +
    '"summary": "50文字以内の要約"}';

  var payload = {
    model: CLAUDE_MODEL,
    max_tokens: 256,
    messages: [
      { role: "user", content: prompt }
    ]
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true  // エラーレスポンスも文字列として受け取る
  };

  var response     = UrlFetchApp.fetch(CLAUDE_API_URL, options);
  var responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error("Claude API エラー (HTTP " + responseCode + "): " + response.getContentText());
  }

  var responseJson = JSON.parse(response.getContentText());
  var content      = responseJson.content[0].text;

  // レスポンスからJSONブロックを抽出
  var jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude APIのレスポンスからJSONを取得できませんでした: " + content);
  }

  var result = JSON.parse(jsonMatch[0]);

  // categoryが想定外の値の場合は「その他」にフォールバック
  var validCategories = ["クレーム", "質問", "注文", "その他"];
  if (validCategories.indexOf(result.category) === -1) {
    result.category = "その他";
  }

  return result;
}

/**
 * スプレッドシートの「メールログ」シートに1行追記する
 * シートが存在しない場合は自動作成する
 * @param {Date}   date     - 受信日時
 * @param {string} sender   - 送信者
 * @param {string} subject  - 件名
 * @param {string} category - 分類
 * @param {string} summary  - 要約
 */
function logToSheet(date, sender, subject, category, summary) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LOG_SHEET_NAME);

  // シートがなければ新規作成してヘッダーを追加
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    var headers = [["受信日時", "送信者", "件名", "分類", "要約"]];
    sheet.getRange(1, 1, 1, 5).setValues(headers);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
  }

  sheet.appendRow([date, sender, subject, category, summary]);
}

/**
 * Slack Incoming Webhookで担当者に通知する
 * @param {string} webhookUrl - Slack Webhook URL
 * @param {string} subject    - 件名
 * @param {string} sender     - 送信者
 * @param {string} category   - 分類
 * @param {string} summary    - 要約
 */
function notifySlack(webhookUrl, subject, sender, category, summary) {
  var text = [
    "*【メール分類通知】*",
    "件名：" + subject,
    "送信者：" + sender,
    "分類：" + category,
    "要約：" + summary
  ].join("\n");

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ text: text }),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(webhookUrl, options);
  if (response.getResponseCode() !== 200) {
    throw new Error("Slack通知エラー (HTTP " + response.getResponseCode() + "): " + response.getContentText());
  }

  Logger.log("Slack通知を送信しました。");
}

/**
 * エラー内容をスプレッドシートの「エラーログ」シートに記録する
 * @param {string} message - エラーメッセージ
 */
function logError(message) {
  Logger.log("エラー: " + message);

  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(ERROR_SHEET_NAME);

    // シートがなければ新規作成してヘッダーを追加
    if (!sheet) {
      sheet = ss.insertSheet(ERROR_SHEET_NAME);
      var headers = [["発生日時", "エラー内容"]];
      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
    }

    sheet.appendRow([new Date(), message]);
  } catch (e) {
    // エラーログ記録自体が失敗した場合はLoggerのみに出力
    Logger.log("エラーログの記録に失敗しました: " + e.message);
  }
}

/**
 * 5分おきに classifyEmails を自動実行するトリガーを登録する
 * ※ GASエディタからこの関数を一度だけ手動実行してください
 *   （重複登録を防ぐため、既存の同名トリガーは事前に削除します）
 */
function setFiveMinuteTrigger() {
  var functionName = "classifyEmails";

  // 同名の既存トリガーを削除して重複を防ぐ
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("既存トリガーを削除しました。");
    }
  }

  // 5分おきのタイムベーストリガーを登録
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("5分おきの自動実行トリガーを登録しました。");
}
