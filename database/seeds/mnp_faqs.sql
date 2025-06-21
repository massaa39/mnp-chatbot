-- MNP Chatbot FAQ Seed Data
-- Insert comprehensive FAQ data for MNP support

-- Clear existing data
DELETE FROM faqs WHERE category = 'mnp_basic';

-- Insert MNP Basic FAQs
INSERT INTO faqs (id, category, subcategory, question, answer, keywords, priority, carrier_specific, is_active, version, created_at, updated_at) VALUES
(uuid_generate_v4(), 'mnp_basic', 'overview', 'MNPとは何ですか？', 'MNP（モバイルナンバーポータビリティ）とは、携帯電話番号を変更することなく、他の携帯電話会社に乗り換えできるサービスです。現在お使いの電話番号をそのまま新しい携帯電話会社でご利用いただけます。', ARRAY['MNP', 'ポータビリティ', '番号', '乗り換え'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'procedure', 'MNPの手続きの流れを教えてください', 'MNP手続きの基本的な流れは以下の通りです：\n\n1. **MNP予約番号の取得**: 現在のキャリアからMNP予約番号を取得\n2. **事前準備**: 本人確認書類、支払い方法の準備\n3. **新しいキャリアへの申込み**: MNP予約番号を使って新しいキャリアに申込み\n4. **SIMカードの受け取り・設定**: 物理SIMまたはeSIMの設定\n5. **回線切替**: 新しいキャリアへの回線切替\n6. **APN設定**: インターネット接続のための設定\n\n通常、手続き完了まで1-3営業日かかります。', ARRAY['手続き', '流れ', 'ステップ', 'MNP予約番号'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'timing', 'MNP予約番号の有効期限はどのくらいですか？', 'MNP予約番号の有効期限は取得日から15日間です。\n\n格安SIM事業者の多くは、転入手続き時にMNP予約番号の残り有効期限が10日以上必要としています。そのため、MNP予約番号を取得したら、できるだけ早く（取得から5日以内）に転入手続きを行うことをお勧めします。\n\n有効期限が切れた場合は、再度MNP予約番号を取得する必要があります。', ARRAY['MNP予約番号', '有効期限', '15日', '10日'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'cost', 'MNP転出にかかる費用はいくらですか？', '2021年4月から、MNP転出手数料は原則無料になりました。\n\n**主な費用**：\n• **MNP転出手数料**: 無料（大手キャリア・格安SIM共通）\n• **契約解除料**: 契約内容により異なる（2019年10月以降の契約は原則1,100円以下）\n• **端末代金残債**: 分割払い中の場合は残債の支払いが必要\n• **新しいキャリアの事務手数料**: 3,300円程度（キャリアにより異なる）\n\n合計で0円～6,600円程度が一般的です。', ARRAY['費用', '手数料', 'MNP転出手数料', '無料'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'sim_types', '物理SIMとeSIMの違いは何ですか？', '**物理SIM**：\n• 実際のSIMカードを挿入する従来の方式\n• SIMカードの配送が必要（1-3日程度）\n• すべての端末で利用可能\n• SIMカードの差し替えが必要\n\n**eSIM**：\n• 端末内蔵のSIMを電子的に書き込む方式\n• 即日開通が可能（最短30分）\n• 対応端末が限定的（iPhone XS以降、一部Android）\n• SIMカードの物理的な交換が不要\n\n**おすすめ**：\n• 急いでいる場合・対応端末をお持ちの場合：eSIM\n• 確実性を重視する場合：物理SIM', ARRAY['物理SIM', 'eSIM', '違い', '即日', '対応端末'], 2, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'documents', 'MNP手続きに必要な書類は何ですか？', 'MNP手続きに必要な書類：\n\n**必須書類**：\n• **本人確認書類**（運転免許証、マイナンバーカード、パスポート等）\n• **MNP予約番号**（現在のキャリアから取得）\n• **支払い方法**（クレジットカードまたは銀行口座情報）\n\n**場合により必要**：\n• **補助書類**（健康保険証利用時：住民票、公共料金領収書等）\n• **家族証明書類**（家族名義での契約時）\n• **印鑑**（一部の店舗契約時）\n\n**注意点**：\n• 書類の名前と契約者名が一致している必要があります\n• 有効期限内の書類をご用意ください', ARRAY['必要書類', '本人確認', '身分証明書', 'MNP予約番号'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'timing_process', 'MNP手続きにはどのくらい時間がかかりますか？', 'MNP手続きの所要時間：\n\n**物理SIM**：\n• 申込みから開通まで：1-3営業日\n• SIMカード配送：1-2日\n• 回線切替：数分-1時間\n\n**eSIM**：\n• 申込みから開通まで：30分-2時間\n• 設定作業：10-30分\n• 24時間いつでも手続き可能\n\n**影響する要因**：\n• 申込み時間（営業時間外は翌営業日処理）\n• 配送地域（離島等は日数が増加）\n• 審査状況（本人確認等）\n• 在庫状況（特定のSIMカード）\n\n**おすすめタイミング**：平日の午前中に申込みを行うと最も早く完了します。', ARRAY['時間', '期間', '所要時間', '営業日', 'eSIM', '物理SIM'], 2, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'backup', 'MNP時にデータのバックアップは必要ですか？', 'MNP手続き自体でデータが消えることはありませんが、念のためバックアップをおすすめします：\n\n**推奨バックアップ項目**：\n• **連絡先・電話帳**：GoogleアカウントやiCloudで同期\n• **写真・動画**：クラウドストレージ（Googleフォト、iCloud等）\n• **LINEトーク履歴**：LINEのバックアップ機能\n• **アプリデータ**：各アプリの引き継ぎ設定\n\n**バックアップ方法**：\n1. クラウドサービスへの自動バックアップ設定\n2. 端末の標準バックアップ機能を利用\n3. 重要なデータは手動でエクスポート\n\n**所要時間**：30分-1時間程度\n\n**注意**：SIM交換時の操作ミスに備えて、必ずバックアップを取ることをお勧めします。', ARRAY['バックアップ', 'データ保存', '連絡先', '写真', 'LINEトーク'], 2, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'contract_end', 'MNP後の前のキャリアとの契約はどうなりますか？', 'MNP転入完了と同時に、前のキャリアとの契約は自動的に解約されます：\n\n**解約について**：\n• **自動解約**：MNP転入完了と同時\n• **解約手続き**：別途手続きは不要\n• **解約日**：新しいキャリアの回線が開通した日\n\n**料金について**：\n• **最終月料金**：解約日までの日割り計算\n• **未払い料金**：通常通り請求される\n• **最終請求書**：解約から1-2ヶ月後に到着\n\n**継続する項目**：\n• **端末分割代金**：完済まで支払い継続\n• **コンテンツサービス**：別途解約が必要な場合あり\n\n**SIMカード返却**：\n• 物理SIMは返却が必要な場合があります\n• 返却しない場合、損害金が発生する可能性があります', ARRAY['契約終了', '自動解約', '最終料金', 'SIM返却'], 2, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'mnp_basic', 'online_procedure', 'MNP手続きはオンラインでできますか？', 'はい、多くの事業者でオンライン手続きが可能です：\n\n**オンライン対応事業者**：\n• **ドコモ**：My docomoから24時間受付\n• **au**：My auから手続き可能\n• **ソフトバンク**：My SoftBankから手続き可能\n• **楽天モバイル**：my 楽天モバイルから手続き可能\n• **格安SIM各社**：各社のマイページから手続き可能\n\n**オンライン手続きの流れ**：\n1. 各事業者のマイページにログイン\n2. MNP予約番号取得メニューを選択\n3. 必要事項を入力・確認\n4. MNP予約番号をSMSまたはメールで受け取り\n\n**メリット**：\n• 24時間いつでも手続き可能\n• 待ち時間なし\n• 即座にMNP予約番号を取得\n\n**注意**：一部の契約内容では電話での手続きが必要な場合があります。', ARRAY['オンライン手続き', 'Webサイト', 'マイページ', '24時間', 'my'], 2, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert carrier-specific FAQs
INSERT INTO faqs (id, category, subcategory, question, answer, keywords, priority, carrier_specific, is_active, version, created_at, updated_at) VALUES
(uuid_generate_v4(), 'carrier_process', 'docomo', 'ドコモからMNP転出する方法を教えてください', 'ドコモからのMNP転出方法：\n\n**オンライン手続き**：\n• My docomoにログイン\n• 「契約内容・手続き」→「携帯電話番号ポータビリティ予約」\n• 24時間受付（システムメンテナンス時除く）\n\n**電話手続き**：\n• ドコモ携帯から：151（無料）\n• 一般電話から：0120-800-000\n• 受付時間：9:00-20:00（年中無休）\n\n**店舗手続き**：\n• ドコモショップで手続き可能\n• 本人確認書類が必要\n• 待ち時間が発生する場合があります\n\n**取得できる情報**：\n• MNP予約番号（10桁）\n• 有効期限（15日間）\n• 転出手数料：無料', ARRAY['ドコモ', 'MNP転出', 'My docomo', '151'], 1, 'docomo', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'carrier_process', 'au', 'auからMNP転出する方法を教えてください', 'auからのMNP転出方法：\n\n**オンライン手続き**：\n• My auにログイン\n• 「ご契約内容/手続き」→「MNPご予約」\n• 24時間受付（システムメンテナンス時除く）\n\n**電話手続き**：\n• au携帯から：157（無料）\n• 一般電話から：0077-75470\n• 受付時間：9:00-20:00（年中無休）\n\n**店舗手続き**：\n• auショップ・au Styleで手続き可能\n• 本人確認書類が必要\n\n**注意事項**：\n• 一部のプランでは電話での手続きが必要\n• 家族割引等の割引サービスに影響する場合があります\n• 転出手数料：無料', ARRAY['au', 'MNP転出', 'My au', '157'], 1, 'au', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'carrier_process', 'softbank', 'ソフトバンクからMNP転出する方法を教えてください', 'ソフトバンクからのMNP転出方法：\n\n**オンライン手続き**：\n• My SoftBankにログイン\n• 「設定・申込」→「契約者情報の変更」→「番号ポータビリティ(MNP)予約関連手続き」\n• 24時間受付\n\n**電話手続き**：\n• ソフトバンク携帯から：*5533（無料）\n• 一般電話から：0800-100-5533\n• 受付時間：9:00-20:00（年中無休）\n\n**店舗手続き**：\n• ソフトバンクショップで手続き可能\n• 本人確認書類が必要\n\n**特記事項**：\n• Y!mobileへの移行は一部手続きが異なります\n• PayPayポイント等の引き継ぎに注意\n• 転出手数料：無料', ARRAY['ソフトバンク', 'MNP転出', 'My SoftBank', '*5533'], 1, 'softbank', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'carrier_process', 'rakuten', '楽天モバイルからMNP転出する方法を教えてください', '楽天モバイルからのMNP転出方法：\n\n**オンライン手続き**：\n• my 楽天モバイルにログイン\n• 「契約プラン」→「各種手続き」→「MNP予約番号発行・確認」\n• 24時間受付\n\n**注意事項**：\n• Rakuten UN-LIMIT VIIは最低利用期間・解約金なし\n• 楽天ポイントの有効期限に注意\n• 楽天市場等のSPU（スーパーポイントアッププログラム）倍率が変わります\n\n**引き継ぎ確認項目**：\n• 楽天ペイの利用設定\n• 楽天でんきの契約情報\n• その他楽天サービスとの連携\n\n**転出手数料**：無料\n**MNP予約番号の発行**：即時（my 楽天モバイルで確認可能）', ARRAY['楽天モバイル', 'MNP転出', 'my 楽天モバイル', 'Rakuten UN-LIMIT'], 1, 'rakuten', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert troubleshooting FAQs
INSERT INTO faqs (id, category, subcategory, question, answer, keywords, priority, carrier_specific, is_active, version, created_at, updated_at) VALUES
(uuid_generate_v4(), 'troubleshooting', 'mnp_failed', 'MNP手続きがうまくいかない場合はどうすればいいですか？', 'MNP手続きでトラブルが発生した場合の対処方法：\n\n**よくある原因と対処法**：\n\n**1. MNP予約番号が取得できない**\n• 未払い料金がある→料金を支払ってから再度手続き\n• 契約者情報が不一致→本人確認書類で情報を確認\n\n**2. 転入手続きでエラーが発生**\n• MNP予約番号の有効期限切れ→新しい予約番号を取得\n• 入力情報の誤り→契約者情報を正確に入力\n\n**3. 回線切替ができない**\n• SIMカードの差し込み不良→SIMカードを正しく挿入\n• APN設定の不備→正しいAPN設定を確認\n\n**サポート連絡先**：\n• 転出元キャリアのサポートセンター\n• 転入先キャリアのサポートセンター\n• 契約書類と本人確認書類を準備してお問い合わせください', ARRAY['MNP失敗', 'トラブル', 'エラー', '手続きできない'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'troubleshooting', 'slow_process', 'MNP手続きが予定より遅れている場合はどうすればいいですか？', 'MNP手続きが遅れている場合の確認方法と対処法：\n\n**確認すべき項目**：\n\n**1. 手続き状況の確認**\n• 転入先キャリアのマイページで進捗を確認\n• 申込み完了メールの内容を再確認\n• 審査状況や配送状況をチェック\n\n**2. 遅れる主な原因**\n• 審査に時間がかかっている（書類不備等）\n• 配送の遅延（悪天候、地域等）\n• システム障害やメンテナンス\n• 在庫不足（特定のSIMカード）\n\n**3. 対処方法**\n• キャリアサポートセンターに状況確認\n• 必要に応じて書類の再提出\n• 配送先住所の確認\n\n**連絡時に準備する情報**：\n• 申込み時の受付番号\n• 契約者の氏名・電話番号\n• 申込み日時', ARRAY['遅れ', '手続き遅延', '進捗確認', '審査'], 1, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

(uuid_generate_v4(), 'troubleshooting', 'cancel_mnp', 'MNP手続きをキャンセルしたい場合はどうすればいいですか？', 'MNP手続きのキャンセル方法：\n\n**キャンセル可能なタイミング**：\n\n**1. MNP予約番号取得後、転入申込み前**\n• MNP予約番号の有効期限（15日）が切れれば自動的にキャンセル\n• 特別な手続きは不要\n\n**2. 転入申込み後、回線切替前**\n• 転入先キャリアに連絡してキャンセル手続き\n• 申込み完了前であればキャンセル可能な場合が多い\n• キャンセル料が発生する場合があります\n\n**3. 回線切替後**\n• 基本的にキャンセル不可\n• 再度MNPで元のキャリアに戻る必要\n\n**注意事項**：\n• SIMカードを受け取った場合は返送が必要\n• 事務手数料等が発生している場合は返金されない場合があります\n• 早めにキャリアサポートに相談することをお勧めします', ARRAY['キャンセル', 'MNP取り消し', '手続き中止', '有効期限'], 2, NULL, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_faqs_keywords_gin ON faqs USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_faqs_category_carrier ON faqs(category, carrier_specific);
CREATE INDEX IF NOT EXISTS idx_faqs_fulltext ON faqs USING gin(to_tsvector('japanese', question || ' ' || answer));

-- Show completion message
SELECT 'MNP FAQ seed data inserted successfully!' as status;