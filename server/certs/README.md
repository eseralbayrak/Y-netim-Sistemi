# HTTPS Sertifikası Kurulumu (telefon kamerasının çalışması için)

Telefon tarayıcıları, kamera erişimine (QR okuma) **sadece HTTPS veya
`localhost` üzerinden** izin verir. Düz `http://192.168.x.x` veya
`http://hammadde` gibi adreslerde telefon kamerası **hiçbir zaman** açılmaz —
bu bir GKYS Solo hatası değil, tüm modern tarayıcıların (Chrome, Safari)
güvenlik kuralıdır.

Bu klasöre `key.pem` ve `cert.pem` dosyalarını koyarsanız, sunucu bir
sonraki başlatışında **otomatik olarak HTTPS ile** çalışır (kod değişikliği
gerekmez). Dosyalar burada yoksa sunucu eskisi gibi düz HTTP ile çalışmaya
devam eder — hiçbir şey bozulmaz.

En kolay ve ücretsiz yöntem **mkcert** aracıdır. Aşağıdaki adımları sunucu
bilgisayarında (RDP ile bağlanıp) uygulayın.

## 1. mkcert'i indirin ve kurun

1. https://github.com/FiloSottile/mkcert/releases adresine gidin
2. En son sürümdeki `mkcert-vX.X.X-windows-amd64.exe` dosyasını indirin
3. İndirilen dosyayı `mkcert.exe` olarak yeniden adlandırıp, örneğin
   `C:\mkcert\mkcert.exe` konumuna koyun

## 2. Yerel bir "Certificate Authority" (CA) kurun (bir kere yapılır)

Yönetici olarak PowerShell açıp:

```powershell
cd C:\mkcert
.\mkcert.exe -install
```

Bu, bilgisayarınıza (ve bu bilgisayardan üretilen tüm sertifikalara) diğer
cihazların güvenmesini sağlayan bir "kök sertifika" kurar.

## 3. Sunucu için bir sertifika üretin

Sunucunun hem IP adresini (örn. `192.168.1.34`) hem de kullanacağınız DNS
adını (örn. `hammadde`) ve `localhost`'u aynı sertifikaya ekleyin:

```powershell
.\mkcert.exe -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 192.168.1.34 hammadde
```

(IP adresini ve ismi kendi durumunuza göre değiştirin — birden fazla IP/isim
eklemek isterseniz hepsini yan yana yazabilirsiniz.)

Bu komut sonucunda `key.pem` ve `cert.pem` adında iki dosya oluşur. Bu iki
dosyayı bu klasöre (`server/certs/`) kopyalayın.

## 4. Sertifikayı telefona da tanıtın (mkcert -install sadece bu PC'yi kapsar)

`mkcert -install` yalnızca üretildiği bilgisayarı (sunucuyu) etkiler; telefon
ve diğer bilgisayarların da bu sertifikaya güvenmesi için kök sertifikayı
onlara da yüklemeniz gerekir:

1. Sunucuda kök sertifikanın nerede olduğunu görmek için: `.\mkcert.exe -CAROOT`
   (genelde `...\AppData\Local\mkcert\rootCA.pem` gibi bir yoldur)
2. Bu `rootCA.pem` dosyasını telefona (WhatsApp, e-posta, veya USB ile) gönderin
3. **Android**: Ayarlar → Güvenlik → Şifreleme ve kimlik bilgileri → Sertifika
   Yükle → `rootCA.pem` dosyasını seçin
4. **iPhone**: Dosyayı açıp "Profil Yükle" ile kurun, sonra Ayarlar → Genel →
   Hakkında → Sertifika Güven Ayarları'ndan bu sertifikayı "tam güvenilir"
   yapın

## 5. Sunucuyu yeniden başlatın

`start-server.bat` dosyasını kapatıp tekrar çalıştırın (veya NSSM servisini
yeniden başlatın). Konsolda şu satırı görmelisiniz:

```
GKYS Solo sunucusu (HTTPS) çalışıyor: https://0.0.0.0:...
```

Artık tarayıcıdan `https://hammadde` (veya `https://192.168.1.34`) adresine
giderek erişebilir, telefon kamerası düzgün çalışır.

**Not — port numarası:** HTTPS'in standart portu 443'tür (böylece adres
çubuğunda port yazmanıza gerek kalmaz). `start-server.bat` içindeki `PORT=80`
satırını `PORT=443` olarak değiştirin. 80 portunda olduğu gibi, sunucuda
başka bir program zaten 443'ü kullanıyorsa `8443` gibi boş bir port seçip
adres çubuğuna `https://hammadde:8443` yazmanız gerekir. Güvenlik duvarında
da o portu açmayı unutmayın (bkz. ana README madde 7 — `-LocalPort 443` yaparak).

## Sertifikanın süresi dolarsa

mkcert sertifikaları uzun ömürlüdür (yaklaşık 2-3 yıl) ama süresi dolarsa
3. adımdaki komutu tekrar çalıştırıp yeni `key.pem`/`cert.pem` dosyalarını bu
klasöre koymanız yeterlidir — kök sertifikayı tekrar telefona yüklemenize
gerek yoktur.
