# TimeBlock - Roam Research Plugin

A Roam Research plugin that displays time blocks in a calendar-like sidebar view.

## Features

- **Calendar Sidebar**: View your daily time blocks in a vertical calendar layout
- **Time Block Parsing**: Automatically detects time ranges like `10:00-12:00` in your blocks
- **Tag-based Coloring**: Color-code time blocks based on tags (e.g., `#longTerm`, `#shortTerm`)
- **Tag Inheritance**: Blocks inherit tags from parent blocks
- **Drag to Create**: Drag on the calendar to quickly create new time blocks (15-minute granularity)
- **Click to Navigate**: Click any time block to navigate to it in Roam

## Installation

### Via Roam Depot (Recommended)

1. Open Roam Research
2. Go to Settings > Roam Depot
3. Search for "TimeBlock"
4. Click Install

### Manual Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Upload `build/extension.js` to Roam

## Usage

### Time Block Format

Create blocks with time ranges in these formats:

- `10:00-12:00` - 24-hour format
- `10:00 - 12:00` - with spaces
- `10:00am-12:00pm` - 12-hour format

### Tags

Configure which tags trigger time block parsing in the settings:

- `#longTerm` - Hashtag format
- `[[Meeting]]` - Page reference format

Time blocks will be colored based on their associated tag.

### Tag Inheritance

If a time block doesn't have a tag, it will inherit the tag from its parent blocks. This allows you to organize time blocks under categorized parent blocks.

Example:
```
- #work
  - 09:00-10:00 Team standup
  - 10:00-12:00 Feature development
- #personal
  - 18:00-19:00 Exercise
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Day Start Hour | First hour shown in calendar | 6 |
| Day End Hour | Last hour shown in calendar | 22 |
| Time Block Tags | Tags that trigger parsing | `longTerm, shortTerm` |
| Tag Colors | Color for each tag | `longTerm:#4A90D9, shortTerm:#7CB342` |
| Default Color | Color for untagged blocks | `#9E9E9E` |

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build
```

## License

MIT
