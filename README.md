# Simonov Tech — лендинг

Статический сайт без сборки: HTML + CSS + JS.

## Запуск локально

```bash
python3 -m http.server 8137
```

Открыть http://localhost:8137

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

## Публикация

Адрес: https://simonov-tech.ru/. Сервер: `93.183.71.196`.

GitHub Actions (`.github/workflows/site.yml`) проверяет изменения в pull request
и в `main`. После успешных проверок `main` публикуется отдельным раннером
`simonov-tech-runner` с меткой `simonov-tech`. Ручной запуск доступен через
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
Хранятся последние пять версий и предыдущая активная версия.
Публикуются только `index.html`, `css/`, `js/` и `assets/`.

Nginx работает в контейнере `simonov-tech-web` с конфигурацией из
`/opt/simonov-tech/deploy`. Образ закреплён по digest в серверном `.env`.
Изменения `deploy/compose.yml`, `deploy/nginx.conf` и `deploy/traefik.yml`
применяются администратором; раннер обновляет только содержимое сайта.
Traefik использует существующую сеть `mafia_mafia-network`, entrypoint
`websecure` и Let's Encrypt resolver `myresolver`. Маршрут из
`deploy/traefik.yml` добавлен в `/opt/mafia/traefik/dynamic_config.yml`.
Порт Nginx `8098` открыт только на localhost для проверки деплоя.

Для HTTPS A-запись корня домена (`@`) должна указывать на `93.183.71.196`.
Если есть AAAA-запись, она должна вести на этот же сервер с рабочим IPv6
или быть удалена. HTTPS-сертификат выдаёт Traefik после настройки DNS.

Диагностика на сервере:

```bash
systemctl status actions.runner.kolyapvp-simonov_tech.simonov-tech-runner.service
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
