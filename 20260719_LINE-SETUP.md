# 調整くん LINE連携手順

1. LINE DevelopersでMessaging APIチャネルを作成します。
2. `LINE_CHANNEL_SECRET` と `LINE_CHANNEL_ACCESS_TOKEN` をSitesの本番環境変数へ登録します。
3. Webhook URLを `https://公開URL/api/line/webhook` に設定し、Webhookを有効にします。
4. LINE公式アカウントをリマインド先のグループへ招待します。
5. イベント管理画面で「LINE連携コードを発行」を押します。
6. 対象グループへ、画面に表示された `調整くん 連携 XXXXXX` を送ります。

## 前日リマインド

`POST https://公開URL/api/reminders/run` を毎日実行し、`Authorization: Bearer <REMINDER_CRON_SECRET>` を付けます。QStashなどのCron実行サービスから、日本時間の毎朝に呼び出してください。入力期限が翌日の未送信イベントだけがLINEグループへ通知されます。
