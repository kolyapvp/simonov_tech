# Simonov Tech — лендинг

Статический сайт без сборки: HTML + CSS + JS.

## Запуск локально

```bash
python3 scripts/serve.py
```

Открыть http://127.0.0.1:8137. Сервер доступен только с этого компьютера
и обслуживает временную копию публичных файлов, без `.git`, документации,
скриптов деплоя и листинга каталогов. После изменения файлов перезапустите сервер.

## Как добавить свой проект

Все проекты и контакты лежат в `js/data.js`.

```js
{
  id: 'my-game',                     // уникальный id латиницей
  title: 'My Game',
  platform: 'steam',                 // 'steam' или 'vk'
  genres: ['Аркада', 'Платформер'],
  short: 'Короткое описание для плитки.',
  description: ['Абзац 1', 'Абзац 2'],
  link: 'https://store.steampowered.com/app/...',
  cover: 'assets/projects/my-game/cover.jpg',   // необязательно, иначе первый скриншот
  images: [
    'assets/projects/my-game/1.jpg',
    'assets/projects/my-game/2.jpg',
  ],
  palette: ['#8b5cf6', '#f472b6', '#22d3ee'],   // цвета заглушки, если images пустой
}
```

Скриншоты кладите в `assets/projects/<id>/`, рекомендуемое соотношение — 16:9.
Если `images` пустой, сайт рисует сгенерированную заглушку.

## Защита сайта

CSP в `index.html` применяется при обычной публикации файлов: скрипты разрешены
только с того же origin, встроенные обработчики и `eval` запрещены. Ранний
скрипт инициализации вынесен в `js/init.js`. Внешние источники разрешены только
для CSS Google Fonts и их шрифтов; изображения — локальные и `data:` SVG.
Inline CSS сохранён для текущих анимаций и задержек появления элементов.
Добавление inline JavaScript завершает проверку сайта ошибкой.

`deploy/nginx.conf` дополнительно задаёт CSP с `frame-ancestors 'none'`,
`X-Frame-Options: DENY` и HSTS на год для основного домена, без preload
и распространения на поддомены. HSTS учитывается браузером только при HTTPS.
Эти HTTP-заголовки требуют отдельного применения конфигурации Nginx
администратором: workflow обновляет только публичные файлы.
В локальном Python preview работают ограничения CSP из HTML; HTTP-заголовки
Nginx проверяются отдельно на контейнере с конфигурацией из `deploy/`.

## Публикация

Адрес: https://simonov-tech.ru/. Сервер: `82.114.226.110`.

GitHub Actions (`.github/workflows/site.yml`) проверяет изменения в pull request
и в `main`. После успешных проверок `main` публикуется отдельным раннером
`simonov-tech-production-82` с меткой `simonov-tech-production-82`. Ручной запуск доступен через
Actions → Site CI/CD → Run workflow, для ветки `main`.

Проверки локально (Python 3.10+ и Node.js):

```bash
python3 scripts/check_site.py
python3 -m unittest discover -s tests -v
```

Раннер работает под пользователем `simonov-tech-runner`, без sudo и доступа
к Docker. Он пишет только версии сайта в `/srv/simonov-tech/releases` и атомарно
переключает ссылку `current`. HTTP-проверка сверяет `version.txt` с SHA коммита
и проверяет главную страницу; при ошибке возвращается предыдущая версия.
После публикации workflow также сверяет SHA через публичный HTTPS. Несовпадение
или недоступность публичного адреса завершает workflow ошибкой.
Хранятся последние пять версий и предыдущая активная версия.
Публикуются только `index.html`, `css/`, `js/` и `assets/`.

Nginx работает в контейнере `simonov-tech-web` с конфигурацией из
`/opt/simonov-tech-runtime`. Образ закреплён по digest в серверном `.env`.
Изменения `deploy/compose.yml`, `deploy/nginx.conf` и `deploy/traefik.yml`
применяются администратором; раннер обновляет только содержимое сайта.
Traefik использует существующую сеть `proxy`, entrypoint
`websecure` и Let's Encrypt resolver `myresolver`. Маршрут из
`deploy/traefik.yml` расположен в `/opt/traefik/dynamic/simonov-tech.yml`.
Порт Nginx `8098` открыт только на localhost для проверки деплоя.

Для HTTPS A-запись корня домена (`@`) должна указывать на `82.114.226.110`.
Если есть AAAA-запись, она должна вести на этот же сервер с рабочим IPv6
или быть удалена. HTTPS-сертификат выдаёт Traefik после настройки DNS.

Диагностика на сервере:

```bash
systemctl status actions.runner.kolyapvp-simonov_tech.simonov-tech-production-82.service
docker logs --tail 50 simonov-tech-web
curl --fail http://127.0.0.1:8098/version.txt
curl --fail https://simonov-tech.ru/version.txt
```

Ручной откат под пользователем раннера: выбрать каталог нужной версии
из `releases`, создать временную относительную ссылку и заменить `current`:

```bash
cd /srv/simonov-tech
ln -s releases/<каталог-версии> .rollback
mv -Tf .rollback current
curl --fail http://127.0.0.1:8098/version.txt
```

Откат выполнять после завершения текущего workflow деплоя.
