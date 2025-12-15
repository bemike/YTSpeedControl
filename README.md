# ⚡ YT Speed Control

> **Take control of your YouTube viewing experience with elegant keyboard shortcuts and a beautiful glassmorphism UI.**

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## ✨ Features

### 🎹 Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Shift + 1` | Set speed to **1.0x** (normal) |
| `Shift + 2` | Set speed to **1.5x** |
| `Shift + 3` | Set speed to **2.0x** |
| `Shift + 4` | Set speed to **3.0x** |
| `+` or `=` | Increase speed by **0.25x** |
| `-` | Decrease speed by **0.25x** |

### 🎨 Elegant UI
- **Glassmorphism Design**: Modern frosted glass aesthetics with smooth animations
- **Speed Indicator**: Beautiful overlay that appears when you change speed, then gracefully fades away
- **Control Panel**: Click the extension icon for a sleek popup with sliders and preset buttons

### 💾 Smart Memory
- **Speed Persistence**: Your preferred speed is remembered across sessions
- **Cross-device Sync**: Settings sync across all your Chrome browsers
- **Instant Apply**: Saved speed is applied automatically when you open a new video

---

## 🚀 Installation

### From Source (Developer Mode)

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/bemike/YTSpeedControl.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable **Developer mode** (toggle in the top right)

4. Click **Load unpacked** and select the `YTSpeedControl` folder

5. The extension icon should now appear in your toolbar!

---

## 📖 Usage

### Quick Start

1. Go to any YouTube video
2. Press `Shift + 3` to set 2x speed, or use `+`/`-` for fine-tuning
3. A beautiful indicator will briefly show your current speed

### Popup Panel

Click the extension icon to access:
- **Current Speed Display**: Large, easy-to-read speed indicator
- **Speed Slider**: Drag to set any speed from 0.25x to 3.0x
- **Preset Buttons**: One-click access to 1x, 1.5x, 2x, and 3x
- **Keyboard Shortcuts Reference**: Quick reminder of available shortcuts

---

## 🛠️ Technical Details

### Speed Range
- **Minimum**: 0.25x
- **Maximum**: 3.0x
- **Step**: 0.25x increments

### Compatibility
- ✅ Regular YouTube videos
- ✅ YouTube Shorts
- ✅ Embedded YouTube players
- ✅ Fullscreen mode
- ✅ Theater mode

### Project Structure
```
YTSpeedControl/
├── manifest.json          # Extension configuration
├── popup/
│   ├── popup.html         # Popup UI structure
│   ├── popup.css          # Glassmorphism styles
│   └── popup.js           # Popup logic
├── content/
│   ├── content.js         # Keyboard & speed control
│   └── indicator.css      # Speed indicator styles
├── background/
│   └── service-worker.js  # Message handling
└── icons/                 # Extension icons
```

---

## 🔮 Roadmap

| Version | Features |
|---------|----------|
| **V1** ✅ | Keyboard shortcuts, speed indicator, popup panel, speed memory |
| **V2** | Custom shortcut mapping, per-channel default speeds |
| **V3** | Inline control bar button, settings import/export |
| **V4** | Support for Bilibili, Vimeo, and other platforms |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

---

## 📄 License

MIT License - feel free to use and modify as you like!

---

<p align="center">
  Made with ❤️ for YouTube power users
</p>
