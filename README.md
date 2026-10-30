<p align="center">
  <a href="https://www.gnu.org/licenses/gpl-3.0.html">
    <img src="https://img.shields.io/badge/license-GPL-yellow.svg?style=plastic&logo=GNU&label=Lisans" alt="GPL">
  </a>
  <a href="https://discord.gg/ue9x6TnMC3">
    <img src="https://img.shields.io/badge/Discord'a%20Kat%C4%B1l-blue?style=flat&logo=discord" alt="Discord">
  </a>
</p>

<p align="center">
  <b>Android için Among Us hile menüsü</b><br>
  PC sürümü <a href="https://github.com/scp222thj/MalumMenu">MalumMenu</a>'nün Android'e taşınmış hâli (Frida + frida-il2cpp-bridge)
</p>

# 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Kurulum](#-kurulum)
- [Sık Sorulan Sorular](#-sık-sorulan-sorular)
- [Derleme](#-derleme)
- [Katkı](#-katkı)
- [Teşekkürler](#-teşekkürler)
- [Sorumluluk Reddi](#️-sorumluluk-reddi)

# 🎉 Özellikler

Menü, oyun içinde ekranda duran yüzen bir paneldir. En üstteki **Hızlı Seçenekler** bölümünde en çok kullanılanlar önem sırasına göre dizilidir. Aynı ayarın iki ayrı düğmesi yoktur: Hızlı Seçenekler'deki düğmeler diğer bölümlerden kaldırılmıştır.

### ⚡ Hızlı Seçenekler (önem sırasıyla)

1. **Gölge Yok** (varsayılan: açık) — her zaman aydınlık, maça veya odaya girerken kapanmaz
2. **Free Chat + Online Kilidi** (varsayılan: açık) — oturum açmadan Free Chat ve çevrimiçi oyun
3. Rolleri Göster
4. Görevlerimi Tamamla
5. Hepsini Sabote Et
6. Toplantı Çağır
7. Duvardan Geç (NoClip)
8. Hız (kaydırıcı + düğme)
9. Havalandırmaları Aç
10. Uzaklaş / Yakınlaş / Sıfırla
11. Hayaletleri Gör
12. Oyları Göster
13. Herkesi Öldürebil
14. Kozmetikleri Aç (varsayılan: açık)

### Hareket
- Moonwalk, Kontrolleri Ters Çevir

### ESP
- Sohbet Hep Açık

### Oyuncu
- Hedef seç (sıradaki / listeden), hedefi öldür, uzaktan öldür, hedefe ışınlan, herkesi yanıma ışınla
- Hedefi izle, ceset olarak bildir, toplantıda at
- Hepsini / mürettebatı / hainleri öldür, sahte ölüm, canlan

### Roller
- Sahte rol (yerel), Öldürme Beklemesi Yok (sadece host), Sonsuz Öldürme / Sorgu / Takip Mesafesi, Görünmezken Öldür
- Şekil değiştirme: animasyon yok, sınırsız süre
- Mühendis: sınırsız havalandırma süresi, bekleme yok
- Bilim insanı: sınırsız pil, bekleme yok
- Takipçi: sınırsız takip, bekleme ve gecikme yok

### Gemi
- Tüm sabotajlar ve onarımları, onarılamaz ışıklar, Mantar Karışıklığı (Fungle)
- Tüm kapıları aç / kapat, sabotaj haritasını aç
- Toplantıyı atla / kapat, oyunu zorla başlat (host)
- Havalandırmadakileri at, havalandırmada yürü

### Pasif
- Tam Çözünürlük (oyun varsayılan olarak yarım çözünürlükte çalışır)
- Analitiği Kapat, UwUify, Keyboard Mode (fiziksel klavye gerekir)

### Hata Ayıklama
- Kendini test et, ayrıntılı günlük, hata raporunu kopyala / paylaş
- **Oyun API raporu**: oyunun sınıf ve metot imzalarını dosyaya yazar. Bir özellik çalışmazsa bu rapor sorunu bulmayı kolaylaştırır.

> [!NOTE]
> Bazı özellikler oyun sürümüne ve sunucu kurallarına bağlıdır. Çalışmayan bir özellik görürseniz Hata Ayıklama bölümünden raporu paylaşın.

# 💾 Kurulum

Önce platformunuzun desteklendiğinden emin olun:

- ✅ Among Us'ın çalıştığı tüm Android sürümleri (root gerekmez)
- ❓ Özel / OEM ROM'lar (çalışabilir de çalışmayabilir de)
- ❌ Emülatörler (menü için gereken `frida-java-bridge` çalışmaz)

[Sürümler](https://github.com/realmirac/MalumMenu-Forkum/releases) sayfasından veya GitHub Actions çıktısından `.apk` dosyasını indirip yükleyin.

> [!WARNING]
> Bu mod kararsız olan `frida-java-bridge`'e dayanır. Rastgele çökmeler ve tutarsız davranışlar olabilir.

# ❓ Sık Sorulan Sorular

- **S:** Menünün yüklendiğini nasıl anlarım?  
**C:** Among Us açıldığında sol üst köşede mod simgesi görürsünüz.

- **S:** Menü görünmüyor.  
**C:** "Diğer uygulamaların üzerinde göster" iznini verdiğinizden emin olun. Oyun ilk açılışta ister, istemezse elle verin.

- **S:** MalumMenu'yü kullanmadan önce orijinal Among Us'ı silmem gerekiyor mu?  
**C:** Şimdilik evet, paket adı aynı. Paket adını değiştiren [APK Explorer & Editor](https://github.com/apk-editor/APK-Explorer-Editor) veya [ReVanced](https://github.com/revanced/revanced-manager) gibi bir uygulama kullanabilirsiniz.

- **S:** Free Chat lobileri görünmüyor.  
**C:** Hızlı Seçenekler'de "Free Chat + Online Kilidi" açık olmalı. Yine de görünmüyorsa Hata Ayıklama'dan "Oyun API raporu oluştur" ile raporu alın ve paylaşın. Hata günlüğünde `force chat mode` satırına bakın.

# 👷‍♂️ Derleme

Gereksinimler:

- Android SDK Build Tools (objection için)
- Python 3.10+ (Frida ve objection için)
- Node.js
- Java Development Kit (APKEditor ve apktool için)

## Temel kurulum

```sh
# Depoyu klonla
git clone https://github.com/realmirac/MalumMenu-Forkum
cd MalumMenu-Forkum

# Sanal ortam oluştur ve etkinleştir (zorunlu değil, ama iyi pratik)
python -m venv .venv
source .venv/bin/activate

# Frida ve objection'ı kur
pip install -r requirements.txt

# Node.js bağımlılıklarını kur
npm install
```

### Orijinal oyun APK'sını al

- `pip install gplaydl && gplaydl download com.innersloth.spacemafia -a arm64 -o data/split`
- Telefonunuzdan APK'yı çıkarın (bunu yapan birçok uygulama var)
- [itch.io](https://innersloth.itch.io/among-us) sayfasından "Demo" APK'yı indirin

APK'yı `data/AmongUs.apk` olarak kaydedin. Birden fazla parçaya bölünmüşse [APKEditor](https://github.com/REAndroid/APKEditor/releases/latest) ile birleştirin:
`java -jar APKEditor.jar m -i data/split -o data/AmongUs.apk`

## Geliştirme

Script `./dist/agent.js` dosyasına derlenir:

- `npm run build:release` — sürüm (küçültülmüş)
- `npm run build:dev` — geliştirme sürümü
- `npm run watch` — dosya değişince otomatik yeniden derler

Kod kalitesi için:

- `npm run lint` — [eslint](https://eslint.org/)
- `npm run prettier` — [prettier](https://prettier.io/)

### Script Modu

Kodu değiştirmiyorsanız: script APK'nın içine gömülür.

```sh
# Script'i APK'ya göm
objection patchapk -c objection.cfg.json -s data/AmongUs.apk -l dist/agent.js -a arm64-v8a -V 17.18.0 --pause

# Yeni bir terminalde manifest'e overlay izni ekle
# TEMP_DIR yerine objection'ın gösterdiği geçici klasörü yazın
python tools/patch_manifest.py TEMP_DIR
# İlk terminale dönüp objection'a devam etmesi için Enter'a basın

# Cihazı ADB ile bağlayıp APK'yı yükle
adb install -i com.android.vending data/AmongUs.objection.apk
```

Oyunu başlatın. İlk açılışta "Diğer uygulamaların üzerinde göster" izni istenir. Sol üstte mod simgesini görmelisiniz.

### Dinleme (Listen) Modu

Kodu değiştiriyorsanız: her değişiklikte APK'yı yeniden yüklemeniz gerekmez.

```sh
# frida-gadget'ı APK'ya göm
objection patchapk -s data/AmongUs.apk -a arm64-v8a -V 17.18.0 --pause

# Yeni bir terminalde manifest'e overlay izni ekle
python tools/patch_manifest.py TEMP_DIR
# İlk terminale dönüp Enter'a basın

adb install -i com.android.vending data/AmongUs.objection.apk
```

- Oyunu başlatın. Her açılışta script'i elle başlatana kadar bekler (`adb logcat`'te `Frida: Listening on TCP port 27042` benzeri bir satır görünür).
- `npm run spawn` — gadget modunda script'i başlat
- `npm run spawn:server` — frida-server ile başlat (uygulama adı "Among Us" olmalı)

# 👨‍💻 Katkı

[CONTRIBUTING.md](docs/CONTRIBUTING.md) dosyasına bakın.

# 🙏 Teşekkürler

- [Frida](https://frida.re/) — dinamik enstrümantasyon aracı
- [frida-il2cpp-bridge](https://github.com/vfsfitvnm/frida-il2cpp-bridge/) — çalışma anında IL2CPP oyunlarına erişim
- [frida-java-menu](https://github.com/astra1dev/frida-java-menu) — Android için yüzen menüler
- [objection](https://github.com/sensepost/objection) — frida-gadget'ı APK'ya gömmek için
- [fallguys-frida-modmenu](https://github.com/repinek/fallguys-frida-modmenu) — bu projenin ana ilham kaynağı
- [MalumMenu](https://github.com/scp222thj/MalumMenu) — PC için Among Us hile menüsü
- [MalumMenu-Android](https://github.com/astra1dev/MalumMenu-Android) — bu deponun çatalladığı Android sürümü
- [gplaydl](https://github.com/rehmatworks/gplaydl) — Play Store APK indirici
- [AndroidUtilities](https://github.com/All-Of-Us-Mods/AndroidUtilities) — Keyboard Mode için ilham

# ⚠️ Sorumluluk Reddi

Bu mod Among Us veya Innersloth LLC ile bağlantılı değildir; içeriği Innersloth LLC tarafından onaylanmamış veya desteklenmemiştir. Buradaki materyallerin bir kısmı Innersloth LLC'nin mülkiyetindedir. © Innersloth LLC.

Bu mod, Innersloth'un hizmetlerine, oyunun işleyişine, bütünlüğüne veya diğer oyuncuların normal oyun deneyimine müdahale edecek şekilde kullanılmak üzere tasarlanmamıştır. Geliştirici, modun oyunları bozmak, diğer kullanıcıları olumsuz etkilemek, kuralları veya korumaları aşmak ya da yasak olan yerlerde haksız avantaj sağlamak için kullanılmasını onaylamaz. Kötüye kullanımın sorumluluğu kullanıcıya aittir.

Modun kullanımı Among Us hizmet şartlarını ihlal edebilir ve geçici veya kalıcı oyun yasağı dâhil yaptırımlara yol açabilir. Doğabilecek sonuçlardan geliştirici sorumlu değildir. Kullanım riski size aittir.
