// ===================================================
// 売上データ月次サマリー集計ダッシュボード
// ===================================================

// シート名の定数
var DATA_SHEET_NAME = "売上データ";
var SUMMARY_SHEET_NAME = "月次サマリー";

/**
 * メイン処理：売上データを集計してサマリーシートと棒グラフを更新する
 * 毎朝9時のトリガーから自動実行される
 */
function updateSummaryDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 売上データシートを取得
  var dataSheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!dataSheet) {
    Logger.log("「" + DATA_SHEET_NAME + "」シートが見つかりません。");
    return;
  }

  // 月次集計を実行
  var monthlyData = aggregateByMonth(dataSheet);

  // サマリーシートに書き込み
  writeSummarySheet(ss, monthlyData);

  // 棒グラフを作成・更新
  createBarChart(ss);

  Logger.log("サマリーダッシュボードの更新が完了しました。");
}

/**
 * 売上データシートを読み込み、月ごとに合計売上と件数を集計する
 * @param {Sheet} dataSheet - 売上データシート
 * @return {Array} 月ごとの集計結果（[月ラベル, 合計売上, 件数]の配列）
 */
function aggregateByMonth(dataSheet) {
  var lastRow = dataSheet.getLastRow();

  // データが1行もない場合は空を返す
  if (lastRow < 2) {
    Logger.log("売上データが存在しません。");
    return [];
  }

  // 2行目以降のデータを全件取得（1行目はヘッダー）
  var data = dataSheet.getRange(2, 1, lastRow - 1, 4).getValues();

  // 月ごとの集計用マップ（キー: "YYYY/MM", 値: {total, count}）
  var monthMap = {};
  // 月の表示順を保持する配列
  var monthOrder = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var dateCell = row[0]; // A列：日付
    var amount   = row[3]; // D列：金額

    // 日付が空またはamountが数値でない行はスキップ
    if (!dateCell || typeof amount !== "number") continue;

    // Date型に変換してYYYY/MMキーを生成
    var date = new Date(dateCell);
    var year  = date.getFullYear();
    var month = date.getMonth() + 1; // 0始まりを補正
    var key   = year + "/" + zeroPad(month);

    if (!monthMap[key]) {
      monthMap[key] = { total: 0, count: 0 };
      monthOrder.push(key);
    }

    monthMap[key].total += amount;
    monthMap[key].count += 1;
  }

  // monthOrderに従って結果配列を組み立てる
  var result = [];
  for (var j = 0; j < monthOrder.length; j++) {
    var k = monthOrder[j];
    var parts = k.split("/");
    var label = parts[0] + "年" + parseInt(parts[1]) + "月"; // 例：2026年1月
    result.push([label, monthMap[k].total, monthMap[k].count]);
  }

  return result;
}

/**
 * 月次サマリーシートをクリアしてヘッダーと集計データを書き込む
 * @param {Spreadsheet} ss - スプレッドシート
 * @param {Array} monthlyData - 月次集計データ
 */
function writeSummarySheet(ss, monthlyData) {
  // サマリーシートがなければ新規作成
  var summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME);
  }

  // シートをクリア
  summarySheet.clearContents();

  // ヘッダー行を書き込む
  var headers = [["月", "合計売上", "件数"]];
  summarySheet.getRange(1, 1, 1, 3).setValues(headers);
  summarySheet.getRange(1, 1, 1, 3).setFontWeight("bold");

  // データが空の場合はヘッダーのみで終了
  if (monthlyData.length === 0) {
    Logger.log("集計データがないため、ヘッダーのみ書き込みました。");
    return;
  }

  // 集計データを書き込む（2行目以降）
  summarySheet.getRange(2, 1, monthlyData.length, 3).setValues(monthlyData);

  // 合計売上列（B列）を通貨フォーマットに設定
  summarySheet
    .getRange(2, 2, monthlyData.length, 1)
    .setNumberFormat("¥#,##0");

  Logger.log(monthlyData.length + "ヶ月分のデータを書き込みました。");
}

/**
 * 月次サマリーをもとに棒グラフを作成・更新する
 * 既存のグラフがあれば削除してから新規作成する
 * @param {Spreadsheet} ss - スプレッドシート
 */
function createBarChart(ss) {
  var summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) return;

  var lastRow = summarySheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("グラフ作成に必要なデータがありません。");
    return;
  }

  // 既存グラフをすべて削除
  var existingCharts = summarySheet.getCharts();
  for (var i = 0; i < existingCharts.length; i++) {
    summarySheet.removeChart(existingCharts[i]);
  }

  // グラフのデータ範囲（月ラベルと合計売上のみ使用）
  var dataRange = summarySheet.getRange(1, 1, lastRow, 2);

  // 棒グラフを作成
  var chart = summarySheet.newChart()
    .setChartType(Charts.ChartType.COLUMN) // 縦棒グラフ
    .addRange(dataRange)
    .setPosition(lastRow + 2, 1, 0, 0)    // データ下部に配置
    .setOption("title", "月次売上推移")
    .setOption("hAxis.title", "月")
    .setOption("vAxis.title", "合計売上（円）")
    .setOption("width", 600)
    .setOption("height", 400)
    .setOption("legend.position", "none")  // 凡例なし（系列が1つのため）
    .build();

  summarySheet.insertChart(chart);
  Logger.log("棒グラフを作成しました。");
}

/**
 * 毎朝9時に updateSummaryDashboard を自動実行するトリガーを登録する
 * ※ GASエディタからこの関数を一度だけ手動実行してください
 *   （重複登録を防ぐため、既存の同名トリガーは事前に削除します）
 */
function setDailyTrigger() {
  var functionName = "updateSummaryDashboard";

  // 同名の既存トリガーを削除して重複を防ぐ
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("既存トリガーを削除しました。");
    }
  }

  // 毎朝9時のタイムベーストリガーを登録
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log("毎朝9時の自動実行トリガーを登録しました。");
}

// ===================================================
// ユーティリティ関数
// ===================================================

/**
 * 数値を2桁のゼロ埋め文字列に変換する（例：1 → "01"）
 * @param {number} n - 対象の数値
 * @return {string} ゼロ埋めされた文字列
 */
function zeroPad(n) {
  return n < 10 ? "0" + n : String(n);
}
