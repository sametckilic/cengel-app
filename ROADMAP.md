# Çengel — Kalan İşler Yol Haritası

Güncelleme: 29 Ağustos 2026

Bu belge, mevcut çalışan sistemden mağaza yayınına kadar kalan işleri uygulama sırasıyla tanımlar. Mimari kararların ayrıntısı [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) içindedir. Her aşama kendi doğrulamaları ve UAT kapısı tamamlanmadan sonraki aşamaya geçmez.

## Tamamlanan temel

- Değişken boyutlu, deterministik ve gazete tipi V2 bulmaca üretimi
- Türkçe giriş, cevap onayı, kilitleme, ipucu, tamamlama ve yerel devam etme akışı
- Ana sayfa, arşiv ve paketlerin ortak katalog/progress kaynağına bağlanması
- Railway PostgreSQL, bağımsız API ve zamanlanmış generator worker
- İsteğe bağlı Supabase e-posta/şifre hesabı ve progress senkronizasyonu
- Backend tarafından hesaplanan başarımlar
- RevenueCat Test Store offering, Android SDK, satın alma ve restore akışı
- Android development client ve emülatörde başarılı test satın alımı

## Aşama 1 — Hazır datasetin tamamını etkinleştirme

Amaç: Kaynak dosyadaki bütün `gameplay_status: ready` satırlarını kaybetmeden generator havuzuna taşımak.

- [x] `commercial_use_allowed` alanını yalnızca bu proje-owned dataset için yok say.
- [x] Hazır satırlara uygulanan geçici skor, flag, fit ve cevap uzunluğu eşiklerini kapat.
- [x] Aynı cevaba ait alternatif soru satırlarını katalogda koru.
- [x] Tek bir bulmacada aynı normalize cevabın iki kez seçilmesini engelle.
- [x] Uzun cevapları katalogda tut; yalnızca o anki grid/slot ölçüsüne sığmayanları ilgili üretim isteğinde ele.
- [x] Tam kataloğu yeniden üret ve zorunlu dataset/generator/puzzle kontrollerini geçir.
- [x] Yeni katalog sürümünü staging PostgreSQL'e idempotent olarak aktar.
- [x] Worker ile yeni katalogdan en az bir gelecek gün bulmacası üretip kalite raporunu doğrula.

UAT kapısı: staging API yeni katalog sürümünü göstermeli ve üretilen bulmacada tekrar eden cevap, okunamayan soru veya kalite-gate hatası bulunmamalı.

## Aşama 2 — RevenueCat backend senkronizasyonu

Amaç: Mobilde etkinleşen aboneliği güvenilir biçimde backend entitlement kaydına dönüştürmek.

- [x] Railway staging için `REVENUECAT_WEBHOOK_AUTHORIZATION` secret'ı oluştur.
- [x] RevenueCat Webhooks entegrasyonuna staging endpoint ve aynı Authorization değerini ekle.
- [x] Sandbox/Test Store olaylarını aç; dashboard test event'ini `200` ile doğrula.
- [x] Başarılı test satın alımının `premium_access` kaydını oluşturduğunu doğrula; gerekirse olayı Retry ile yeniden gönder.
- [x] Duplicate, eski sırada gelen, renewal, cancellation, expiration ve transfer olaylarını staging'de doğrula.
- [x] `GET /v1/me/entitlements` ile mobil SDK durumunun aynı olduğunu doğrula.

UAT kapısı: RevenueCat, API ve PostgreSQL aynı kullanıcı için aynı aktif/pasif premium durumunu göstermeli.

## Aşama 3 — İçerik hattını ürünleştirme

Amaç: Günün bulmacası dışındaki bütün kullanıcı içeriklerini aynı gazete tipi üretim hattına taşımak.

- [x] Dataset build ve katalog importunu kontrollü deployment adımı haline getir; yeni dataset pushlandığında elle veri taşıma gerektirmesin.
- [x] 7×7, 8×8, 9×10, 10×10 ve 10×12 için başlangıç/kolay/orta/zor recipe matrisi oluştur.
- [x] Kategori ağırlıklı tariflerde adlandırılmış kategorilerin payını `%50` üzerinde garanti et; kalan kelimeleri aynı zorluktaki karma havuzdan seç.
- [x] Arşiv ve tematik paket bulmacalarını V2 gazete formatında backend üzerinden üretip yayımla.
- [x] Ücretsiz, premium ve günlük yayın politikasını tanımlayıp `required_entitlement` alanlarına uygula.
- [ ] Premium katalog/list/detail erişiminin aktif hesapta açıldığını, anonim veya süresi dolmuş hesapta kapalı kaldığını UAT et.
- [ ] Günlük en az yedi günlük yayın tamponunu yeni recipe matrisiyle koru.
- [ ] Katalog büyüdüğünde uygulanacak editoryal azaltma raporunu hazırla; azaltmayı yalnızca ölçülebilir kapsama kaybı olmadan etkinleştir.
- [ ] Kullanıcıya açık ekranlardan eski prototip/UAT içeriklerini kaldır veya yalnızca development build'e sınırla.

UAT kapısı: ana sayfa, arşiv, kategori paketi ve günün bulmacası farklı boyutlarda aynı gazete tipi görsel/oynanış sözleşmesini kullanmalı.

## Aşama 4 — Son UI ve oynanış cilası

Amaç: İşlevsel prototipi mağaza kalitesindeki son deneyime dönüştürmek.

- [ ] Gazete görünümünü, clue hücresi tipografisini, hizalamayı ve kontrastı bütün grid ölçülerinde son kez düzenle.
- [ ] Tek parmak pan, pinch zoom, elastik sınırlar, klavye açılış/kapanış ve odak ortalama akışlarını regresyon testiyle sabitle.
- [ ] Küçük/büyük Android ekranları, tablet, web ve erişilebilir font ölçeklerinde taşma kontrolü yap.
- [ ] Loading, boş, çevrimdışı, API hatası, kilitli premium ve tamamlanma durumlarını ortak görsel dilde tamamla.
- [ ] Ekran okuyucu etiketleri, dokunma alanları, kontrast ve hareket azaltma davranışlarını doğrula.
- [ ] Paket, profil ve abonelik metinlerindeki son Türkçe içerik/editoryal kontrolü yap.

UAT kapısı: Android cihaz matrisi ve web üzerinde kritik bulmaca akışında görsel bozulma veya ani kayma kalmamalı.

## Aşama 5 — Hesap, güvenlik ve operasyon hazırlığı

Amaç: Gerçek kullanıcı ve ödeme verisini güvenli biçimde işletmek.

- [ ] Şifre sıfırlama, hesap silme ve abonelik yönetimi bağlantılarını ekle.
- [ ] Gizlilik politikası, kullanım koşulları ve abonelik açıklamalarını uygulama içinde erişilebilir yap.
- [ ] API rate limit, güvenli log redaksiyonu, hata izleme ve temel operasyon alarmlarını etkinleştir.
- [ ] Staging ve production Railway/Supabase/RevenueCat ortamlarını ve secret'larını tamamen ayır.
- [ ] PostgreSQL otomatik backup durumunu doğrula ve production öncesi restore provası yap.
- [ ] Offline katalog/progress, yeniden kurulum, çıkış-giriş, restore purchase ve çoklu cihaz senaryolarını uçtan uca test et.
- [ ] CI'da lint, typecheck, unit/integration, generator, puzzle validation ve Expo export kontrollerini zorunlu tut.

UAT kapısı: kritik auth, ödeme, progress ve içerik akışları temiz production benzeri ortamda tekrarlanabilir olmalı.

## Aşama 6 — Android mağaza yayını

Amaç: Önce Android internal testing, ardından kontrollü production rollout.

- [ ] Google Play Console geliştirici hesabı ve uygulama kaydını oluştur.
- [ ] Play subscription ürünü/base planı ile RevenueCat Android uygulamasını bağla.
- [ ] Test Store anahtarını release build'den çıkar; Android production public SDK anahtarını kullan.
- [ ] EAS production signing/build yapılandırmasını ve sürüm numaralandırmasını doğrula.
- [ ] Uygulama ikonu, splash, store görselleri, açıklamalar, içerik derecelendirmesi ve Data Safety formunu tamamla.
- [ ] Internal testing'de gerçek Google Play sandbox satın alma, yenileme, iptal, expiration ve restore UAT'i yap.
- [ ] Crash-free ve backend metriklerini izleyerek aşamalı production rollout başlat.

## Aşama 7 — iOS yayını

Apple Developer hesabı açılabildiğinde Android'de doğrulanan ürün akışı iOS'a taşınacak.

- [ ] Bundle ID, App Store Connect uygulaması ve subscription ürünlerini oluştur.
- [ ] RevenueCat App Store bağlantısını ve iOS production public SDK anahtarını ekle.
- [ ] EAS iOS development/production build, sandbox purchase ve restore UAT'i yap.
- [ ] App Store metadata, privacy ve review gerekliliklerini tamamlayıp rollout başlat.

## MVP sonrasına bırakılanlar

- AI ile yeni soru adayı üretimi ve insan/editoryal onay kuyruğu
- Reklam izleyerek ipucu/cevap açma
- Rekabetçi skorlar ve `server-verified` cevap modu
- Sosyal özellikler, liderlik tabloları ve bildirim kampanyaları

Bu maddeler mevcut içerik, oynanış, ödeme ve yayın akışı production seviyesine gelmeden ana roadmap'e alınmaz.
