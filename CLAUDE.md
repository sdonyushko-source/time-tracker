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

## Тема (светлая/тёмная)
- Токены темы — в `src/theme.ts`, живая тема — через `useTheme()` из `src/ThemeContext.tsx` (React Context)
- Настройка хранится в Settings.theme: "system" | "light" | "dark", "system" следит за ОС через Tauri `onThemeChanged` и живо переключается
- При смене темы вызывается `getCurrentWindow().setTheme(...)`, чтобы нативный титлбар тоже совпадал
- Компонент, использующий цвет, ДОЛЖЕН брать его из `colors` (useTheme), а не хардкодить hex — иначе тема не применится
- Значения не менять без explicit команды:

| Токен | Светлая | Тёмная |
|---|---|---|
| pageBg | #FFFFFF | #101010 |
| cardBg | #F6F6F6 | #1A1A1B |
| inputBg | #FFFFFF | #1A1A1B |
| border | #E3E5EA | #2D2D2D |
| textPrimary | #181A2C | #F3F4F6 |
| textSecondary | #908F8F | #949599 |
| progressTrack | #F6F6F6 | #545454 |
| badgeBg | #F6F6F6 | #626262 |
| badgeText | #908F8F | #F3F4F6 |
| menuBg (попапы/дропдауны, 3 точки) | #FFFFFF | #1A1A1B |
| menuItemHover | #F6F6F6 | #2D2D2D |
| footerBorder (верх блока Earned) | 1px solid #E3E5EA | none — в тёмной теме бордер отсутствует по дизайну |

- Не зависят от темы (одинаковы всегда): accent #7381D3, danger #FF5429, зелёная точка активной задачи #34C759, градиенты Play/Stop/Save/progress-bar, toast (bg #181A2C / white text)

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
