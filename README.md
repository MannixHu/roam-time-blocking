# TimeBlock - Roam Research Plugin

A Roam Research plugin that displays time blocks in a calendar-like sidebar view.

## Features

- **Calendar Sidebar**: View your daily time blocks in a vertical calendar layout
- **Time Block Parsing**: Automatically detects time ranges like `10:00-12:00` in your blocks
- **Tag-based Coloring**: Color-code time blocks based on tags (e.g., `#longTerm`, `#shortTerm`)
- **Tag Inheritance**: Blocks inherit tags from parent blocks
- **Drag to Create**: Drag on the calendar to quickly create new time blocks (15-minute granularity)
- **Drag to Move**: Select a block and drag to change its time
- **Drag to Resize**: Drag the top/bottom edges of a selected block to change duration
- **Multi-select**: Ctrl/Cmd+Click to select multiple blocks
- **Keyboard Navigation**: Use arrow keys to move selected blocks up/down
- **Tag Management**: Click tag buttons to apply tags to selected blocks, right-click to remove tag

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
4. Upload `extension.js` to Roam

## Usage

### Time Block Format

Create blocks with time ranges in these formats:

- `10:00-12:00` - 24-hour format
- `10:00 - 12:00` - with spaces
- `10:00am-12:00pm` - 12-hour format

### Creating Time Blocks

1. Position your cursor in a Roam block where you want the new time block
2. Drag on the calendar grid to create a new time block
3. The new block will be inserted as a sibling at your cursor position

### Selecting and Editing

- **Single click**: Select a block
- **Ctrl/Cmd+Click**: Multi-select blocks
- **Drag center**: Move block to a new time (requires selection first)
- **Drag edges**: Resize block duration (requires selection first)
- **Arrow keys**: Move selected blocks by 15 minutes
- **Right-click**: Remove tag from block (keeps time)
- **Remove button**: Remove both tag and time from selected blocks

### Tags

Configure which tags trigger time block display in the settings:

- `#longTerm` - Hashtag format
- `[[Meeting]]` - Page reference format

Time blocks will be colored based on their associated tag. Click a tag button in the sidebar to:
- Select it as the default tag for new blocks
- Apply it to currently selected blocks

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
| Day End Hour | Last hour shown (supports >24 for next day) | 22 |
| Hour Height | Pixels per hour in the calendar | 48 |
| Tag Colors | Configure tags and their colors | - |

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build
```

### Tech Stack

- React 18
- TypeScript
- @dnd-kit/core - Drag and drop interactions
- Tailwind CSS - Styling (with `tb-` prefix)
- Webpack - Bundling

## License

MIT
