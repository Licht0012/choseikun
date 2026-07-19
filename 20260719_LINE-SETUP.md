# 調整くん LINE連携手順

## 1. LINE公式アカウントとMessaging APIチャネル

1. LINE Official Account Managerで「調整くん」用のLINE公式アカウントを作成します。
2. LINE Official Account Managerの「設定」→「Messaging API」でMessaging APIを有効化します。
3. Providerを選択します。Providerは後から変更できないため、個人運用なら個人用、組織運用なら組織用を選びます。
4. LINE Developers Consoleで同じProviderを開き、作成されたMessaging APIチャネルを選びます。
5. 「Basic settings」のChannel secretを確認します。
6. 「Messaging API」のChannel access token（long-lived）を発行します。
7. Channel secretを `LINE_CHANNEL_SECRET`、Channel access tokenを `LINE_CHANNEL_ACCESS_TOKEN` としてSitesの本番環境へ登録します。

秘密情報はチャットやソースコードへ貼り付けず、本番環境変数として登録します。

## 2. Webhook

1. LINE Developers Consoleの「Messaging API」タブでWebhook URLに次を設定します。
   `https://choseikun.yucky0629.chatgpt.site/api/line/webhook`
2. 「Verify」を押し、Successになることを確認します。
3. 「Use webhook」を有効にします。
4. 必要に応じて「Webhook redelivery」も有効にします。
5. 「Allow bot to join group chats」を有効にします。

## 3. 対象LINEグループとの連携

1. Messaging APIタブにあるBotのQRコードからLINE公式アカウントを友だち追加します。
2. リマインド先のLINEグループを開き、メンバー追加からLINE公式アカウントを招待します。
3. 調整くんのイベント管理画面で「LINE連携コードを発行」を押します。
4. 対象グループへ、画面に表示された `調整くん 連携 XXXXXX` を送ります。
5. Botから「連携しました」と返信されれば完了です。

## 前日リマインド

Upstash ConsoleのQStashでScheduleを作成します。

- Destination: `https://choseikun.yucky0629.chatgpt.site/api/reminders/run`
- Method: `POST`
- Cron: `CRON_TZ=Asia/Tokyo 0 19 * * *`
- Forward header: `Authorization: Bearer <REMINDER_CRON_SECRET>`
- Retries: `3`

毎日19:00（日本時間）に処理が呼ばれ、入力期限が翌日の未送信イベントだけがLINEグループへ通知されます。
