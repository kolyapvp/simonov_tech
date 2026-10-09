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

Подходит любой статический хостинг: GitHub Pages, Netlify, Vercel, Cloudflare Pages —
достаточно загрузить содержимое папки.
