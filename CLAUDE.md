# Time Tracker — правила разработки

## Стек
- Tauri + React + TypeScript
- Inline styles (НЕ Tailwind, НЕ CSS modules)
- SQLite через @tauri-apps/plugin-sql

## Размеры окна
- Ширина: 440px (фиксированная, не менять)
- Высота компактная: 120px
- Высота расширенная: авто по контенту

## Шрифт
- Везде: 'Inter', sans-serif
- Цифры: fontVariantNumeric: 'tabular-nums'
- Никогда не использовать monospace

## Цвета (не менять)
- Текст основной: #181A2C
- Текст вторичный: #908F8F
- Фон: #FFFFFF
- Граница: #E3E5EA
- Фон карточки Summary: #F6F6F6
- Фон badge: #F6F6F6
- Зелёная точка активной задачи: #34C759

## Структура App.tsx
- Шапка: удалена
- Строка таймера: position absolute, top 0, left 0, width 440, height 80
- Иконки Copy/More: position absolute, top 0, right 16, height 80, поверх таймера
- Блоки контента: top 80, left 24, width 392, gap 12
- Handle-бокс: сразу после блоков, width 100%, height 24, marginTop 0

## Кнопка Play/Stop
- Контейнер button: width 48, height 48, overflow visible
- SVG: width 48, height 48, viewBox "0 0 48 48", overflow visible
- Play градиент: #8FD75F → #31D877
- Stop градиент: #FF7552 → #FF5125
- Никогда не менять размер и позицию кнопки

## Today.tsx
- Контейнер: border "1px solid #E3E5EA", borderRadius 12, paddingTop 16, paddingLeft 8, paddingRight 8, gap 16
- Строка задачи: padding "8px 12px", width 376
- Левая часть строки: width 264, gap 4
- Время справа: width 72, textAlign right
- Progress bar: height 12, borderRadius 40

## Summary.tsx
- Контейнер: background #F6F6F6, borderRadius 12, padding "12px 16px", gap 8
- Колонки: название 111px, время 102px, сумма 99px, gap 24
- This month: fontWeight 500, остальные 400

## Правила
1. Никогда не менять отступы без явной команды
2. Никогда не менять шрифты
3. Никогда не добавлять Tailwind классы
4. isExpanded меняется ТОЛЬКО через клик на handle
5. handleToggle меняет ТОЛЬКО isActive и elapsedSeconds
6. Все данные — из SQLite, не localStorage
