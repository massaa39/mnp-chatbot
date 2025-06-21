-- FAQシードデータ（格安SIM特化版）
-- Purpose: 格安SIM事業者間MNP手続きサポート用FAQデータ

INSERT INTO faqs (category, subcategory, question, answer, keywords, carrier_specific, priority, is_active) VALUES

-- MNP基本知識
('mnp_basic', 'overview', '格安SIMのMNPとは何ですか？', 
'MNP（Mobile Number Portability）とは、電話番号を変えずに格安SIM事業者間で乗り換えができる制度です。楽天モバイル、mineo、UQモバイル、Y!mobile、IIJmio等の事業者間での移行が可能です。', 
ARRAY['MNP', '格安SIM', '乗り換え', '電話番号', 'ポータビリティ'], NULL, 5, true),

('mnp_basic', 'process', '格安SIMのMNP手続きの流れを教えてください', 
'格安SIM間のMNP手続きは以下の流れです：1) 現在の格安SIM事業者でMNP予約番号を取得 2) 新しい格安SIM事業者に申込み 3) SIMカード受取・開通手続き 4) APN設定・動作確認。全体で1-3営業日程度かかります。', 
ARRAY['手続き', '流れ', 'プロセス', 'ステップ'], NULL, 5, true),

('mnp_basic', 'cost', '格安SIMのMNP手数料はかかりますか？', 
'2021年4月より、MNP転出手数料は原則無料になりました。ただし、転入先での契約事務手数料（通常3,300円）やSIMカード発行手数料（400-500円程度）はかかります。', 
ARRAY['手数料', '料金', '無料', '2021年4月', 'コスト'], NULL, 5, true),

('mnp_basic', 'timing', 'MNP予約番号の有効期限はどのくらいですか？', 
'MNP予約番号の有効期限は取得日を含めて15日間です。格安SIM事業者では申込み時点で10日以上の有効期限が残っている必要がある場合が多いため、取得後は速やかに手続きを進めてください。', 
ARRAY['有効期限', '15日', '10日以上', 'タイミング'], NULL, 4, true),

-- 楽天モバイル固有
('carrier_specific', 'rakuten', '楽天モバイルのMNP予約番号取得方法は？', 
'楽天モバイルのMNP予約番号は以下の方法で取得できます：1) my 楽天モバイル（24時間、即時発行） 2) 電話：050-5434-4653（9:00-20:00、約10分）。オンラインでの取得が便利でおすすめです。', 
ARRAY['楽天モバイル', 'MNP予約番号', 'my楽天モバイル', '取得方法'], 'rakuten', 5, true),

('carrier_specific', 'rakuten', '楽天モバイルから他社への注意点は？', 
'楽天モバイルから他社への乗り換え時の注意点：1) Rakuten Linkアプリは使用不可になる 2) 楽天ポイント還元率が下がる場合がある 3) 無制限プランを失う 4) 楽天SPUの特典対象外になる。これらを考慮して乗り換えを検討してください。', 
ARRAY['楽天モバイル', '注意点', 'Rakuten Link', '楽天ポイント', 'SPU'], 'rakuten', 4, true),

-- mineo固有
('carrier_specific', 'mineo', 'mineoのMNP予約番号取得方法は？', 
'mineoのMNP予約番号は以下の方法で取得できます：1) マイページ（24時間、即時発行） 2) 電話：0120-977-384（9:00-18:00、約10分）。マイページからの取得が簡単で手数料も無料です。', 
ARRAY['mineo', 'MNP予約番号', 'マイページ', '取得方法'], 'mineo', 5, true),

('carrier_specific', 'mineo', 'mineoから他社への注意点は？', 
'mineoから他社への乗り換え時の注意点：1) フリータンクが使用できなくなる 2) パケット放題 Plusが使用不可 3) マイネ王コミュニティから退会 4) 家族割引が解除される 5) 余ったパケットは失効。特にフリータンクをよく利用している方は注意が必要です。', 
ARRAY['mineo', '注意点', 'フリータンク', 'パケット放題 Plus', 'マイネ王'], 'mineo', 4, true),

-- UQモバイル固有
('carrier_specific', 'uq', 'UQモバイルのMNP予約番号取得方法は？', 
'UQモバイルのMNP予約番号は以下の方法で取得できます：1) My UQ mobile（24時間、即時発行） 2) 電話：0120-001-659（9:00-20:00、約10分）。オンラインでの手続きが24時間いつでも可能で便利です。', 
ARRAY['UQモバイル', 'MNP予約番号', 'My UQ mobile', '取得方法'], 'uq', 5, true),

('carrier_specific', 'uq', 'UQモバイルから他社への注意点は？', 
'UQモバイルから他社への注意点：1) 自宅セット割が適用されなくなる 2) 節約モードが使用不可 3) au品質の高速通信を失う 4) 店舗サポートを受けられなくなる場合がある。自宅セット割で大幅割引を受けている方は特に料金面での検討が必要です。', 
ARRAY['UQモバイル', '注意点', '自宅セット割', '節約モード', 'au品質'], 'uq', 4, true),

-- Y!mobile固有
('carrier_specific', 'ymobile', 'Y!mobileのMNP予約番号取得方法は？', 
'Y!mobileのMNP予約番号は以下の方法で取得できます：1) My Y!mobile（24時間、即時発行） 2) 電話：0120-921-156（9:00-20:00、約15分）。My Y!mobileからの手続きが最も迅速で確実です。', 
ARRAY['Y!mobile', 'MNP予約番号', 'My Y!mobile', '取得方法'], 'ymobile', 5, true),

('carrier_specific', 'ymobile', 'Y!mobileから他社への注意点は？', 
'Y!mobileから他社への注意点：1) 家族割サービスが解除される 2) Yahoo!プレミアム特典が使用不可 3) ソフトバンクWi-Fiスポットが利用不可 4) PayPayボーナス特典の対象外 5) ソフトバンク品質の通信速度を失う。家族でまとめて利用している場合は特に注意が必要です。', 
ARRAY['Y!mobile', '注意点', '家族割サービス', 'Yahoo!プレミアム', 'PayPay'], 'ymobile', 4, true),

-- IIJmio固有
('carrier_specific', 'iijmio', 'IIJmioのMNP予約番号取得方法は？', 
'IIJmioのMNP予約番号は以下の方法で取得できます：1) 会員専用ページ（24時間、即時発行） 2) 電話：0570-09-4400（9:00-19:00、約10分）。会員ページからの取得が手数料無料で推奨されます。', 
ARRAY['IIJmio', 'MNP予約番号', '会員専用ページ', '取得方法'], 'iijmio', 5, true),

('carrier_specific', 'iijmio', 'IIJmioから他社への注意点は？', 
'IIJmioから他社への注意点：1) 業界最安級の料金を失う 2) データシェア機能が使用不可 3) 通話料半額（11円/30秒）が適用されなくなる 4) 技術サポートの質が下がる可能性 5) 複数回線割引が解除される。特に料金重視で選んでいた方は乗り換え先の料金を慎重に比較してください。', 
ARRAY['IIJmio', '注意点', '最安級料金', 'データシェア', '通話料半額'], 'iijmio', 4, true),

-- トラブルシューティング
('troubleshooting', 'reservation_expired', 'MNP予約番号の有効期限が切れてしまいました', 
'MNP予約番号の有効期限が切れた場合は、再度同じ格安SIM事業者で新しい予約番号を取得してください。再取得の手数料は無料です。取得後は速やかに（10日以上の有効期限がある状態で）転入先に申込みを行ってください。', 
ARRAY['有効期限', '期限切れ', '再取得', '無料'], NULL, 4, true),

('troubleshooting', 'activation_delay', '開通手続きをしたのに回線が切り替わりません', 
'開通手続き後の回線切り替えには時間がかかります：物理SIMは30分-2時間、eSIMは即時-30分程度です。2時間経過しても切り替わらない場合は、転入先の事業者サポートに連絡してください。開通と同時に前の回線は自動停止します。', 
ARRAY['開通手続き', '回線切り替え', '時間', 'サポート'], NULL, 4, true),

('troubleshooting', 'apn_settings', 'APN設定がうまくできません', 
'APN設定でお困りの場合：1) 事業者の公式サイトで最新のAPN情報を確認 2) 既存のAPN設定を削除してから新規作成 3) 端末の再起動を実行 4) SIMカードの挿し直し。iPhoneの場合は構成プロファイルのダウンロードが必要です。', 
ARRAY['APN設定', '設定方法', 'iPhone', 'Android', 'プロファイル'], NULL, 4, true),

('troubleshooting', 'name_mismatch', '契約者名義が一致しないと言われました', 
'MNP手続きでは、転出元と転入先の契約者名義が完全に一致している必要があります。結婚等で姓が変わった場合は、まず転出元で名義変更を行うか、転入先で同じ名義での契約が必要です。家族間での乗り換えは名義統一が必須です。', 
ARRAY['名義', '契約者', '一致', '名義変更', '家族'], NULL, 4, true),

('troubleshooting', 'sim_not_recognized', 'SIMカードが認識されません', 
'SIMカードが認識されない場合の対処法：1) SIMカードを正しい向きで挿入し直す 2) SIMトレイの汚れを清拭 3) 端末の再起動 4) SIMロック解除の確認（他社端末使用時） 5) SIMカードの破損確認。解決しない場合は事業者にSIMカード交換を依頼してください。', 
ARRAY['SIMカード', '認識', 'SIMロック解除', '交換'], NULL, 3, true),

-- 比較・選択支援
('comparison', 'price', '格安SIM事業者の料金を比較したいです', 
'主要格安SIM事業者の料金比較（月額、税込）：楽天モバイル 1,078円-3,278円（段階制）、mineo 1,298円-2,178円、UQモバイル 1,628円-3,828円、Y!mobile 2,178円-4,158円、IIJmio 850円-2,000円。データ容量、通話オプション、割引条件も含めて総合的に比較検討してください。', 
ARRAY['料金比較', '月額', '格安SIM', '楽天モバイル', 'mineo', 'UQモバイル'], NULL, 4, true),

('comparison', 'speed', '通信速度で格安SIM事業者を選びたいです', 
'通信速度の特徴：UQモバイル・Y!mobile（サブブランド）は大手キャリア並みの高速通信、楽天モバイルは自社回線エリアで高速、mineo・IIJmio等MVNOは平日昼間に速度低下あり。速度重視ならUQモバイル・Y!mobile、コスパ重視ならMVNOがおすすめです。', 
ARRAY['通信速度', 'サブブランド', 'MVNO', 'UQモバイル', 'Y!mobile'], NULL, 4, true),

('comparison', 'features', '格安SIM事業者の特徴を教えてください', 
'主要事業者の特徴：楽天モバイル（楽天経済圏・無制限）、mineo（トリプルキャリア・コミュニティ）、UQモバイル（au品質・家族割）、Y!mobile（ソフトバンク品質・Yahoo!特典）、IIJmio（最安級・技術力）。利用パターンとこだわりポイントで選択してください。', 
ARRAY['特徴', '楽天経済圏', 'トリプルキャリア', 'コミュニティ', '家族割'], NULL, 4, true);

-- インデックス用SQL（参考）
-- CREATE INDEX idx_faqs_category_active ON faqs(category, is_active);
-- CREATE INDEX idx_faqs_carrier_specific ON faqs(carrier_specific, is_active);
-- CREATE INDEX idx_faqs_keywords_gin ON faqs USING gin(keywords);
-- CREATE INDEX idx_faqs_priority_active ON faqs(priority DESC, is_active);