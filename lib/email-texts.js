// Textes des emails écrits dans les 15 langues (sans traduction automatique, qui peut échouer au moment de l'envoi).
// Une ligne par texte, dans le même ordre pour chaque langue. {name} = nom de l'événement (en gras dans le corps),
// {who} = prénom d'un invité, {n} = nombre, {time} = heure.
const RAW = {
fr: `Bienvenue sur MaFeliza 💛
Votre compte est prêt ! Créez votre événement en quelques touches : faire-part, live pour les proches éloignés, photos et souvenirs, tout au même endroit.
✨ Créer mon événement
🎉 « {name} » est créé
Votre événement est créé 🎉
{name} est en ligne. Partagez le lien avec vos proches :
Code d'accès pour vos invités :
Code caméraman (pour filmer le live) :
👀 Voir mon événement
{who} vient
{who} viendra peut-être
{who} ne pourra pas venir
Nouvelle réponse pour {name}.
{n} personnes
Voir les réponses
✍️ {who} a écrit dans votre livre d'or
Nouveau message au livre d'or ✍️
{who} a laissé un souvenir pour {name}.
Lire le livre d'or
🎬 Votre live « {name} » est enregistré
Votre live est enregistré 🎬
Bonne nouvelle : le live de {name} est bien sauvegardé. Le replay sera envoyé par email à vos invités dès la fin du live.
▶ Ouvrir le live
Vous êtes invité·e : {name}
Rappel : « {name} », c'est demain !
Vous êtes invité·e 💌
C'est demain ! 🎉
Voir l'invitation
Code d'accès :
🎞️ Revivez « {name} » : le replay est disponible
Le replay est disponible 🎞️
Merci d'avoir partagé ce moment ! Revoyez {name} quand vous voulez, pendant 15 jours.
✨ Revivez l'événement : le film souvenir
▶ Voir le replay
📦 Télécharger le replay (.zip)
Photos, vidéos et messages des invités vous attendent aussi sur la page de l'événement.
⏰ « {name} » commence dans 1 heure
Ça commence bientôt ! 🔴
Le live de {name} commence à {time}. Installez-vous !
▶ Regarder le live`,
en: `Welcome to MaFeliza 💛
Your account is ready! Create your event in a few taps: invitation, live for loved ones far away, photos and memories, all in one place.
✨ Create my event
🎉 “{name}” is created
Your event is created 🎉
{name} is online. Share the link with your loved ones:
Access code for your guests:
Camera operator code (to film the live):
👀 See my event
{who} is coming
{who} might come
{who} can't come
New reply for {name}.
{n} people
See the replies
✍️ {who} wrote in your guestbook
New guestbook message ✍️
{who} left a memory for {name}.
Read the guestbook
🎬 Your live “{name}” is being recorded
Your live is recorded 🎬
Good news: the live of {name} is being saved. The replay will be sent to your guests by email as soon as the live ends.
▶ Open the live
You're invited: {name}
Reminder: “{name}” is tomorrow!
You're invited 💌
It's tomorrow! 🎉
See the invitation
Access code:
🎞️ Relive “{name}”: the replay is available
The replay is available 🎞️
Thank you for sharing this moment! Watch {name} again whenever you like, for 15 days.
✨ Relive the event: the memory film
▶ Watch the replay
📦 Download the replay (.zip)
Guests' photos, videos and messages are also waiting for you on the event page.
⏰ “{name}” starts in 1 hour
It starts soon! 🔴
The live of {name} starts at {time}. Get ready!
▶ Watch the live`,
tr: `MaFeliza'ya hoş geldiniz 💛
Hesabınız hazır! Etkinliğinizi birkaç dokunuşla oluşturun: davetiye, uzaktaki sevdikleriniz için canlı yayın, fotoğraflar ve anılar, hepsi tek bir yerde.
✨ Etkinliğimi oluştur
🎉 “{name}” oluşturuldu
Etkinliğiniz oluşturuldu 🎉
{name} yayında. Bağlantıyı sevdiklerinizle paylaşın:
Misafirleriniz için erişim kodu:
Kameraman kodu (canlı yayını çekmek için):
👀 Etkinliğimi gör
{who} geliyor
{who} belki gelecek
{who} gelemeyecek
{name} için yeni yanıt.
{n} kişi
Yanıtları gör
✍️ {who} anı defterinize yazdı
Anı defterinde yeni mesaj ✍️
{who}, {name} için bir anı bıraktı.
Anı defterini oku
🎬 “{name}” canlı yayınınız kaydediliyor
Canlı yayınınız kaydedildi 🎬
Güzel haber: {name} canlı yayını kaydediliyor. Tekrar, canlı yayın biter bitmez misafirlerinize e-postayla gönderilecek.
▶ Canlı yayını aç
Davetlisiniz: {name}
Hatırlatma: “{name}” yarın!
Davetlisiniz 💌
Yarın! 🎉
Davetiyeyi gör
Erişim kodu:
🎞️ “{name}” etkinliğini yeniden yaşayın: tekrar hazır
Tekrar hazır 🎞️
Bu anı paylaştığınız için teşekkürler! {name} etkinliğini 15 gün boyunca dilediğiniz zaman yeniden izleyin.
✨ Etkinliği yeniden yaşayın: hatıra filmi
▶ Tekrarı izle
📦 Tekrarı indir (.zip)
Misafirlerin fotoğrafları, videoları ve mesajları da etkinlik sayfasında sizi bekliyor.
⏰ “{name}” 1 saat sonra başlıyor
Birazdan başlıyor! 🔴
{name} canlı yayını saat {time}'de başlıyor. Yerinizi alın!
▶ Canlı yayını izle`,
de: `Willkommen bei MaFeliza 💛
Dein Konto ist bereit! Erstelle dein Event mit wenigen Klicks: Einladung, Livestream für Liebste in der Ferne, Fotos und Erinnerungen, alles an einem Ort.
✨ Mein Event erstellen
🎉 „{name}“ ist erstellt
Dein Event ist erstellt 🎉
{name} ist online. Teile den Link mit deinen Liebsten:
Zugangscode für deine Gäste:
Kameracode (um den Livestream zu filmen):
👀 Mein Event ansehen
{who} kommt
{who} kommt vielleicht
{who} kann nicht kommen
Neue Antwort für {name}.
{n} Personen
Antworten ansehen
✍️ {who} hat in dein Gästebuch geschrieben
Neue Nachricht im Gästebuch ✍️
{who} hat eine Erinnerung für {name} hinterlassen.
Gästebuch lesen
🎬 Dein Livestream „{name}“ wird aufgezeichnet
Dein Livestream wird aufgezeichnet 🎬
Gute Nachricht: Der Livestream von {name} wird gespeichert. Das Replay wird deinen Gästen per E-Mail geschickt, sobald der Livestream endet.
▶ Livestream öffnen
Du bist eingeladen: {name}
Erinnerung: „{name}“ ist morgen!
Du bist eingeladen 💌
Es ist morgen! 🎉
Einladung ansehen
Zugangscode:
🎞️ Erlebe „{name}“ noch einmal: das Replay ist da
Das Replay ist da 🎞️
Danke, dass du diesen Moment geteilt hast! Sieh dir {name} 15 Tage lang an, wann immer du willst.
✨ Das Event noch einmal erleben: der Erinnerungsfilm
▶ Replay ansehen
📦 Replay herunterladen (.zip)
Fotos, Videos und Nachrichten der Gäste warten auch auf der Eventseite auf dich.
⏰ „{name}“ beginnt in 1 Stunde
Gleich geht's los! 🔴
Der Livestream von {name} beginnt um {time}. Mach es dir bequem!
▶ Livestream ansehen`,
es: `Bienvenido a MaFeliza 💛
¡Tu cuenta está lista! Crea tu evento en unos toques: invitación, directo para los seres queridos lejanos, fotos y recuerdos, todo en un mismo lugar.
✨ Crear mi evento
🎉 «{name}» está creado
Tu evento está creado 🎉
{name} está en línea. Comparte el enlace con tus seres queridos:
Código de acceso para tus invitados:
Código de cámara (para grabar el directo):
👀 Ver mi evento
{who} viene
{who} quizá venga
{who} no podrá venir
Nueva respuesta para {name}.
{n} personas
Ver las respuestas
✍️ {who} escribió en tu libro de visitas
Nuevo mensaje en el libro de visitas ✍️
{who} dejó un recuerdo para {name}.
Leer el libro de visitas
🎬 Tu directo «{name}» se está grabando
Tu directo está grabado 🎬
Buenas noticias: el directo de {name} se está guardando. La repetición se enviará por correo a tus invitados en cuanto termine el directo.
▶ Abrir el directo
Estás invitado/a: {name}
Recordatorio: ¡«{name}» es mañana!
Estás invitado/a 💌
¡Es mañana! 🎉
Ver la invitación
Código de acceso:
🎞️ Revive «{name}»: la repetición está disponible
La repetición está disponible 🎞️
¡Gracias por compartir este momento! Vuelve a ver {name} cuando quieras, durante 15 días.
✨ Revive el evento: la película de recuerdos
▶ Ver la repetición
📦 Descargar la repetición (.zip)
Las fotos, vídeos y mensajes de los invitados también te esperan en la página del evento.
⏰ «{name}» empieza en 1 hora
¡Empieza pronto! 🔴
El directo de {name} empieza a las {time}. ¡Ponte cómodo!
▶ Ver el directo`,
it: `Benvenuto su MaFeliza 💛
Il tuo account è pronto! Crea il tuo evento in pochi tocchi: invito, diretta per i cari lontani, foto e ricordi, tutto nello stesso posto.
✨ Crea il mio evento
🎉 «{name}» è stato creato
Il tuo evento è stato creato 🎉
{name} è online. Condividi il link con i tuoi cari:
Codice di accesso per i tuoi ospiti:
Codice cameraman (per riprendere la diretta):
👀 Vedi il mio evento
{who} viene
{who} forse viene
{who} non potrà venire
Nuova risposta per {name}.
{n} persone
Vedi le risposte
✍️ {who} ha scritto nel tuo libro degli ospiti
Nuovo messaggio nel libro degli ospiti ✍️
{who} ha lasciato un ricordo per {name}.
Leggi il libro degli ospiti
🎬 La tua diretta «{name}» è in registrazione
La tua diretta è registrata 🎬
Buone notizie: la diretta di {name} viene salvata. Il replay sarà inviato via email ai tuoi ospiti appena finisce la diretta.
▶ Apri la diretta
Sei invitato/a: {name}
Promemoria: «{name}» è domani!
Sei invitato/a 💌
È domani! 🎉
Vedi l'invito
Codice di accesso:
🎞️ Rivivi «{name}»: il replay è disponibile
Il replay è disponibile 🎞️
Grazie per aver condiviso questo momento! Rivedi {name} quando vuoi, per 15 giorni.
✨ Rivivi l'evento: il film ricordo
▶ Guarda il replay
📦 Scarica il replay (.zip)
Foto, video e messaggi degli ospiti ti aspettano anche sulla pagina dell'evento.
⏰ «{name}» inizia tra 1 ora
Sta per iniziare! 🔴
La diretta di {name} inizia alle {time}. Mettiti comodo!
▶ Guarda la diretta`,
pt: `Bem-vindo ao MaFeliza 💛
A sua conta está pronta! Crie o seu evento em poucos toques: convite, direto para quem está longe, fotos e recordações, tudo no mesmo lugar.
✨ Criar o meu evento
🎉 «{name}» foi criado
O seu evento foi criado 🎉
{name} está online. Partilhe o link com os seus:
Código de acesso para os seus convidados:
Código de câmara (para filmar o direto):
👀 Ver o meu evento
{who} vem
{who} talvez venha
{who} não poderá vir
Nova resposta para {name}.
{n} pessoas
Ver as respostas
✍️ {who} escreveu no seu livro de honra
Nova mensagem no livro de honra ✍️
{who} deixou uma recordação para {name}.
Ler o livro de honra
🎬 O seu direto «{name}» está a ser gravado
O seu direto está gravado 🎬
Boa notícia: o direto de {name} está a ser guardado. O replay será enviado por email aos seus convidados assim que o direto terminar.
▶ Abrir o direto
Está convidado/a: {name}
Lembrete: «{name}» é amanhã!
Está convidado/a 💌
É amanhã! 🎉
Ver o convite
Código de acesso:
🎞️ Reviva «{name}»: o replay está disponível
O replay está disponível 🎞️
Obrigado por partilhar este momento! Volte a ver {name} quando quiser, durante 15 dias.
✨ Reviva o evento: o filme de recordações
▶ Ver o replay
📦 Descarregar o replay (.zip)
Fotos, vídeos e mensagens dos convidados também o esperam na página do evento.
⏰ «{name}» começa dentro de 1 hora
Está quase a começar! 🔴
O direto de {name} começa às {time}. Instale-se!
▶ Ver o direto`,
nl: `Welkom bij MaFeliza 💛
Je account is klaar! Maak je evenement in een paar tikken: uitnodiging, livestream voor dierbaren ver weg, foto's en herinneringen, alles op één plek.
✨ Mijn evenement maken
🎉 ‘{name}’ is aangemaakt
Je evenement is aangemaakt 🎉
{name} staat online. Deel de link met je dierbaren:
Toegangscode voor je gasten:
Cameracode (om de livestream te filmen):
👀 Mijn evenement bekijken
{who} komt
{who} komt misschien
{who} kan niet komen
Nieuw antwoord voor {name}.
{n} personen
Antwoorden bekijken
✍️ {who} schreef in je gastenboek
Nieuw bericht in het gastenboek ✍️
{who} liet een herinnering achter voor {name}.
Gastenboek lezen
🎬 Je livestream ‘{name}’ wordt opgenomen
Je livestream is opgenomen 🎬
Goed nieuws: de livestream van {name} wordt bewaard. De replay wordt naar je gasten gemaild zodra de livestream afloopt.
▶ Livestream openen
Je bent uitgenodigd: {name}
Herinnering: ‘{name}’ is morgen!
Je bent uitgenodigd 💌
Het is morgen! 🎉
Uitnodiging bekijken
Toegangscode:
🎞️ Beleef ‘{name}’ opnieuw: de replay staat klaar
De replay staat klaar 🎞️
Bedankt voor het delen van dit moment! Bekijk {name} opnieuw wanneer je wilt, 15 dagen lang.
✨ Beleef het evenement opnieuw: de herinneringsfilm
▶ Replay bekijken
📦 Replay downloaden (.zip)
Foto's, video's en berichten van de gasten wachten ook op je op de evenementpagina.
⏰ ‘{name}’ begint over 1 uur
Het begint zo! 🔴
De livestream van {name} begint om {time}. Ga er lekker voor zitten!
▶ Livestream bekijken`,
ar: `مرحبًا بك في MaFeliza 💛
حسابك جاهز! أنشئ مناسبتك ببضع لمسات: بطاقة دعوة، بث مباشر للأحبة البعيدين، صور وذكريات، كل ذلك في مكان واحد.
✨ إنشاء مناسبتي
🎉 تم إنشاء «{name}»
تم إنشاء مناسبتك 🎉
{name} متاحة الآن. شارك الرابط مع أحبائك:
رمز الدخول لضيوفك:
رمز المصوّر (لتصوير البث المباشر):
👀 عرض مناسبتي
{who} سيحضر
{who} قد يحضر
{who} لن يتمكن من الحضور
رد جديد على {name}.
{n} أشخاص
عرض الردود
✍️ {who} كتب في دفتر الذكريات
رسالة جديدة في دفتر الذكريات ✍️
{who} ترك ذكرى لـ {name}.
قراءة دفتر الذكريات
🎬 يتم تسجيل بثك المباشر «{name}»
تم تسجيل بثك المباشر 🎬
خبر سار: يتم حفظ البث المباشر لـ {name}. سيُرسل التسجيل إلى ضيوفك بالبريد الإلكتروني فور انتهاء البث.
▶ فتح البث المباشر
أنت مدعو: {name}
تذكير: «{name}» غدًا!
أنت مدعو 💌
إنه غدًا! 🎉
عرض الدعوة
رمز الدخول:
🎞️ عِش «{name}» من جديد: التسجيل متاح
التسجيل متاح 🎞️
شكرًا لمشاركتك هذه اللحظة! شاهد {name} من جديد متى شئت، لمدة 15 يومًا.
✨ عِش المناسبة من جديد: فيلم الذكريات
▶ مشاهدة التسجيل
📦 تنزيل التسجيل (.zip)
صور الضيوف ومقاطعهم ورسائلهم بانتظارك أيضًا في صفحة المناسبة.
⏰ «{name}» تبدأ بعد ساعة
ستبدأ قريبًا! 🔴
يبدأ البث المباشر لـ {name} الساعة {time}. استعد!
▶ مشاهدة البث المباشر`,
pl: `Witaj w MaFeliza 💛
Twoje konto jest gotowe! Utwórz wydarzenie kilkoma dotknięciami: zaproszenie, transmisja dla bliskich z daleka, zdjęcia i wspomnienia — wszystko w jednym miejscu.
✨ Utwórz moje wydarzenie
🎉 „{name}” zostało utworzone
Twoje wydarzenie zostało utworzone 🎉
{name} jest online. Udostępnij link bliskim:
Kod dostępu dla gości:
Kod operatora kamery (do filmowania transmisji):
👀 Zobacz moje wydarzenie
{who} przyjdzie
{who} może przyjdzie
{who} nie przyjdzie
Nowa odpowiedź dla {name}.
Liczba osób: {n}
Zobacz odpowiedzi
✍️ {who} wpisał(a) się do księgi gości
Nowy wpis w księdze gości ✍️
{who} zostawił(a) wspomnienie dla {name}.
Czytaj księgę gości
🎬 Twoja transmisja „{name}” jest nagrywana
Twoja transmisja jest nagrana 🎬
Dobra wiadomość: transmisja {name} jest zapisywana. Powtórka zostanie wysłana e-mailem do gości zaraz po zakończeniu transmisji.
▶ Otwórz transmisję
Zaproszenie: {name}
Przypomnienie: „{name}” już jutro!
Jesteś zaproszony/a 💌
To już jutro! 🎉
Zobacz zaproszenie
Kod dostępu:
🎞️ Przeżyj „{name}” jeszcze raz: powtórka jest dostępna
Powtórka jest dostępna 🎞️
Dziękujemy za wspólny moment! Oglądaj {name} kiedy chcesz, przez 15 dni.
✨ Przeżyj wydarzenie jeszcze raz: film wspomnień
▶ Obejrzyj powtórkę
📦 Pobierz powtórkę (.zip)
Zdjęcia, filmy i wiadomości gości czekają też na stronie wydarzenia.
⏰ „{name}” zaczyna się za 1 godzinę
Zaraz się zaczyna! 🔴
Transmisja {name} zaczyna się o {time}. Rozgość się!
▶ Oglądaj transmisję`,
ro: `Bine ai venit pe MaFeliza 💛
Contul tău este gata! Creează-ți evenimentul în câteva atingeri: invitație, live pentru cei dragi de departe, fotografii și amintiri, totul într-un singur loc.
✨ Creează evenimentul meu
🎉 „{name}” a fost creat
Evenimentul tău a fost creat 🎉
{name} este online. Distribuie linkul celor dragi:
Cod de acces pentru invitații tăi:
Cod cameraman (pentru a filma live-ul):
👀 Vezi evenimentul meu
{who} vine
{who} poate vine
{who} nu poate veni
Răspuns nou pentru {name}.
{n} persoane
Vezi răspunsurile
✍️ {who} a scris în cartea ta de oaspeți
Mesaj nou în cartea de oaspeți ✍️
{who} a lăsat o amintire pentru {name}.
Citește cartea de oaspeți
🎬 Live-ul tău „{name}” se înregistrează
Live-ul tău este înregistrat 🎬
Vești bune: live-ul {name} este salvat. Reluarea va fi trimisă invitaților prin email imediat ce se termină live-ul.
▶ Deschide live-ul
Ești invitat/ă: {name}
Memento: „{name}” este mâine!
Ești invitat/ă 💌
E mâine! 🎉
Vezi invitația
Cod de acces:
🎞️ Retrăiește „{name}”: reluarea este disponibilă
Reluarea este disponibilă 🎞️
Mulțumim că ai împărtășit acest moment! Revezi {name} oricând vrei, timp de 15 zile.
✨ Retrăiește evenimentul: filmul amintirilor
▶ Vezi reluarea
📦 Descarcă reluarea (.zip)
Fotografiile, videoclipurile și mesajele invitaților te așteaptă și pe pagina evenimentului.
⏰ „{name}” începe în 1 oră
Începe în curând! 🔴
Live-ul {name} începe la {time}. Pregătește-te!
▶ Urmărește live-ul`,
ru: `Добро пожаловать в MaFeliza 💛
Ваш аккаунт готов! Создайте событие в несколько касаний: приглашение, трансляция для близких издалека, фото и воспоминания — всё в одном месте.
✨ Создать моё событие
🎉 «{name}» создано
Ваше событие создано 🎉
{name} уже онлайн. Поделитесь ссылкой с близкими:
Код доступа для гостей:
Код оператора (чтобы снимать трансляцию):
👀 Открыть моё событие
{who} придёт
{who}, возможно, придёт
{who} не сможет прийти
Новый ответ на {name}.
Человек: {n}
Посмотреть ответы
✍️ {who} написал(а) в вашей гостевой книге
Новая запись в гостевой книге ✍️
{who} оставил(а) воспоминание для {name}.
Читать гостевую книгу
🎬 Ваша трансляция «{name}» записывается
Ваша трансляция записана 🎬
Хорошая новость: трансляция {name} сохраняется. Запись будет отправлена гостям по email сразу после окончания трансляции.
▶ Открыть трансляцию
Вы приглашены: {name}
Напоминание: «{name}» уже завтра!
Вы приглашены 💌
Это завтра! 🎉
Посмотреть приглашение
Код доступа:
🎞️ Переживите «{name}» снова: запись доступна
Запись доступна 🎞️
Спасибо, что разделили этот момент! Смотрите {name} снова когда угодно в течение 15 дней.
✨ Пережить событие снова: памятный фильм
▶ Смотреть запись
📦 Скачать запись (.zip)
Фото, видео и сообщения гостей тоже ждут вас на странице события.
⏰ «{name}» начнётся через 1 час
Скоро начало! 🔴
Трансляция {name} начнётся в {time}. Устраивайтесь поудобнее!
▶ Смотреть трансляцию`,
uk: `Ласкаво просимо до MaFeliza 💛
Ваш акаунт готовий! Створіть подію кількома дотиками: запрошення, трансляція для близьких здалеку, фото й спогади — усе в одному місці.
✨ Створити мою подію
🎉 «{name}» створено
Вашу подію створено 🎉
{name} уже онлайн. Поділіться посиланням з близькими:
Код доступу для гостей:
Код оператора (щоб знімати трансляцію):
👀 Відкрити мою подію
{who} прийде
{who}, можливо, прийде
{who} не зможе прийти
Нова відповідь на {name}.
Людей: {n}
Переглянути відповіді
✍️ {who} написав(-ла) у вашій гостьовій книзі
Новий запис у гостьовій книзі ✍️
{who} залишив(-ла) спогад для {name}.
Читати гостьову книгу
🎬 Ваша трансляція «{name}» записується
Вашу трансляцію записано 🎬
Добра новина: трансляцію {name} зберігається. Запис надішлемо гостям email-ом одразу після завершення трансляції.
▶ Відкрити трансляцію
Вас запрошено: {name}
Нагадування: «{name}» уже завтра!
Вас запрошено 💌
Це завтра! 🎉
Переглянути запрошення
Код доступу:
🎞️ Переживіть «{name}» знову: запис доступний
Запис доступний 🎞️
Дякуємо, що розділили цю мить! Переглядайте {name} знову коли завгодно протягом 15 днів.
✨ Пережити подію знову: пам'ятний фільм
▶ Дивитися запис
📦 Завантажити запис (.zip)
Фото, відео й повідомлення гостей теж чекають на вас на сторінці події.
⏰ «{name}» почнеться за 1 годину
Скоро початок! 🔴
Трансляція {name} почнеться о {time}. Влаштовуйтеся зручніше!
▶ Дивитися трансляцію`,
zh: `欢迎来到 MaFeliza 💛
你的账号已准备好！轻点几下即可创建活动：请柬、为远方亲友直播、照片与回忆，一站搞定。
✨ 创建我的活动
🎉 “{name}”已创建
你的活动已创建 🎉
{name} 已上线。把链接分享给亲友：
宾客访问码：
摄像师代码（用于拍摄直播）：
👀 查看我的活动
{who} 会来
{who} 可能会来
{who} 无法前来
{name} 有新的回复。
{n} 人
查看回复
✍️ {who} 在你的留言簿中留言了
留言簿有新留言 ✍️
{who} 为 {name} 留下了一段回忆。
阅读留言簿
🎬 你的直播“{name}”正在录制
你的直播已录制 🎬
好消息：{name} 的直播正在保存。直播一结束，回放就会通过邮件发送给你的宾客。
▶ 打开直播
诚邀你参加：{name}
提醒：“{name}”就在明天！
诚邀你参加 💌
就在明天！🎉
查看请柬
访问码：
🎞️ 重温“{name}”：回放已上线
回放已上线 🎞️
感谢你分享这一刻！15 天内可随时重温 {name}。
✨ 重温活动：纪念影片
▶ 观看回放
📦 下载回放 (.zip)
宾客的照片、视频和留言也在活动页面等你查看。
⏰ “{name}”将在 1 小时后开始
马上开始！🔴
{name} 的直播将于 {time} 开始，请做好准备！
▶ 观看直播`,
hi: `MaFeliza में आपका स्वागत है 💛
आपका खाता तैयार है! कुछ ही टैप में अपना कार्यक्रम बनाएँ: निमंत्रण, दूर बैठे अपनों के लिए लाइव, फ़ोटो और यादें, सब एक जगह।
✨ मेरा कार्यक्रम बनाएँ
🎉 “{name}” बन गया
आपका कार्यक्रम बन गया 🎉
{name} ऑनलाइन है। लिंक अपनों के साथ साझा करें:
आपके मेहमानों के लिए एक्सेस कोड:
कैमरा ऑपरेटर कोड (लाइव फ़िल्म करने के लिए):
👀 मेरा कार्यक्रम देखें
{who} आ रहे हैं
{who} शायद आएँ
{who} नहीं आ पाएँगे
{name} के लिए नया जवाब।
{n} लोग
जवाब देखें
✍️ {who} ने आपकी अतिथि पुस्तिका में लिखा
अतिथि पुस्तिका में नया संदेश ✍️
{who} ने {name} के लिए एक याद छोड़ी।
अतिथि पुस्तिका पढ़ें
🎬 आपका लाइव “{name}” रिकॉर्ड हो रहा है
आपका लाइव रिकॉर्ड हो गया 🎬
अच्छी खबर: {name} का लाइव सहेजा जा रहा है। लाइव खत्म होते ही रीप्ले आपके मेहमानों को ईमेल से भेजा जाएगा।
▶ लाइव खोलें
आपको आमंत्रित किया गया है: {name}
याद दिलाना: “{name}” कल है!
आपको आमंत्रित किया गया है 💌
कल है! 🎉
निमंत्रण देखें
एक्सेस कोड:
🎞️ “{name}” को फिर से जिएँ: रीप्ले उपलब्ध है
रीप्ले उपलब्ध है 🎞️
यह पल साझा करने के लिए धन्यवाद! {name} को 15 दिनों तक जब चाहें फिर से देखें।
✨ कार्यक्रम को फिर से जिएँ: यादों की फ़िल्म
▶ रीप्ले देखें
📦 रीप्ले डाउनलोड करें (.zip)
मेहमानों की फ़ोटो, वीडियो और संदेश भी कार्यक्रम पेज पर आपका इंतज़ार कर रहे हैं।
⏰ “{name}” 1 घंटे में शुरू होगा
जल्द शुरू हो रहा है! 🔴
{name} का लाइव {time} बजे शुरू होगा। तैयार हो जाइए!
▶ लाइव देखें`,
};
const T = Object.fromEntries(Object.entries(RAW).map(([l, s]) => [l, s.split("\n")]));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const MAIL_KEYS = ["welcomeSubj", "welcomeBody", "welcomeBtn", "createdSubj", "createdTitle", "createdBody", "createdCode", "createdCam", "createdBtn",
  "rsvpYes", "rsvpMaybe", "rsvpNo", "rsvpBody", "rsvpPeople", "rsvpBtn", "gbSubj", "gbTitle", "gbBody", "gbBtn", "recSubj", "recTitle", "recBody", "recBtn",
  "invSubj", "remSubj", "invTitle", "remTitle", "invBtn", "accessCode", "repSubj", "repTitle", "repBody", "repFilm", "repWatch", "repZip", "repFoot",
  "soonSubj", "soonTitle", "soonBody", "soonBtn"];
// m(lang)("createdBody", { name }) : texte de la langue (anglais à défaut) ; html=true met le nom en gras et échappe les valeurs.
export const mailText = (lang) => (key, vars = {}, html = true) => {
  const list = T[lang] || T.en, i = MAIL_KEYS.indexOf(key);
  return String(list[i] ?? T.en[i] ?? key).replace(/\{(\w+)\}/g, (_, k) => (html ? (k === "name" ? `<b>${esc(vars[k])}</b>` : esc(vars[k])) : String(vars[k] ?? "")));
};
export const MAIL_LANGS = Object.keys(T);
